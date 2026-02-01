import RAPIER from '@dimforge/rapier3d-compat';
import { Color, type Group, Mesh, MeshStandardMaterial, type Object3D, type Scene, Vector3 } from 'three';

import { DASH_COOLDOWN, DASH_DURATION, DASH_SPEED, MOVEMENT_SPEED } from '../constants';
import type { ResourceState, ResourceType } from '../types';
import { Debug } from '../util/Debug';
import { GamepadManager, type PlayerId } from '../util/input/GamepadManager';
import { Physics } from '../util/Physics';
import { Resources } from '../util/Resources';
import { Time } from '../util/Time';
import { Crate } from './object/Crate';
import { SmokeParticleSystem } from './SmokeParticleSystem';

const PLAYER_COLORS = new Map<PlayerId, number>([
  [1, 0xffb6c1],
  [2, 0x00ff00],
]);

export class Player {
  #screenGroup: Group;
  #scene: Scene;
  #resources: Resources;
  #physics: Physics;
  #spawnPosition: Vector3;

  #mesh: Object3D | null = null;
  #rigidBody: RAPIER.RigidBody | null = null;

  // Body parts for procedural animation (pig only)
  #body: Object3D | null = null;
  #head: Object3D | null = null;
  #handLeft: Object3D | null = null;
  #handRight: Object3D | null = null;

  // Animation parameters (tunable via debug GUI)
  #animParams = {
    headBobFreq: 9,
    headBobAmp: 0.06,
    headSwayFreq: 14,
    headSwayAmp: 0.16,
    handsFreq: 32,
    handsAmp: 0.2,
    bodyTilt: 0.5,
    bodyTwistFreq: 16,
    bodyTwistAmp: 0.41,
  };

  // Current tilt values for smooth interpolation
  #currentBodyTilt = 0;

  #currentRotationY = 0;
  #targetRotationY = 0;

  #properties = {
    movementSpeed: MOVEMENT_SPEED,
  };

  #dashState = {
    isDashing: false,
    timer: 0,
    cooldownTimer: 0,
    direction: { x: 0, z: 0 },
  };

  #carriedResource: { type: ResourceType; state: ResourceState; mesh: Object3D } | null = null;

  #smokeSystem: SmokeParticleSystem | null = null;
  #hasDashBurst = false;

  #interactCallback: (() => void) | null = null;

  #gamepadManager: GamepadManager;
  #playerId: PlayerId;
  #time: Time;

  // Cached vectors to avoid allocations
  #cachedPosition = new Vector3();
  #cachedFacingDirection = new Vector3();
  #cachedVelocity = new Vector3();

  public get mesh() {
    return this.#mesh;
  }

  public getPosition(): Vector3 | null {
    if (!this.#rigidBody) return null;
    const t = this.#rigidBody.translation();
    return this.#cachedPosition.set(t.x, t.y, t.z);
  }

  public getFacingDirection(): Vector3 {
    return this.#cachedFacingDirection.set(
      Math.cos(this.#currentRotationY),
      0,
      -Math.sin(this.#currentRotationY),
    );
  }

  public getPlayerId(): PlayerId {
    return this.#playerId;
  }

  constructor(screenGroup: Group, scene: Scene, playerId: PlayerId, spawnPosition: Vector3) {
    this.#screenGroup = screenGroup;
    this.#scene = scene;
    this.#resources = Resources.getInstance();
    this.#physics = Physics.getInstance();
    this.#spawnPosition = spawnPosition;

    this.#gamepadManager = GamepadManager.getInstance();
    this.#time = Time.getInstance();
    this.#playerId = playerId;

    this.createMesh();
    this.createPhysicsBody();
    this.#setupInputCallbacks();
    this.#setupSmokeSystem();

    this.#setupAnimationDebug();
  }

  #setupInputCallbacks(): void {
    const inputSource = this.#gamepadManager.getInputSource(this.#playerId);
    if (inputSource) {
      inputSource.onButtonUp((button) => {
        if (button === 'a' && this.#interactCallback) {
          this.#interactCallback();
        }
      });
    }
  }

  public onInteract(callback: () => void): void {
    this.#interactCallback = callback;
  }

  #setupSmokeSystem(): void {
    this.#smokeSystem = new SmokeParticleSystem(this.#scene);
  }

  #setupAnimationDebug(): void {
    const debug = Debug.getInstance();
    if (!debug?.active) return;

    const characterName = this.#playerId === 1 ? 'Pig' : 'Croco';
    const folder = debug.gui.addFolder(`${characterName} Animation`);

    const headFolder = folder.addFolder('Head');
    headFolder.add(this.#animParams, 'headBobFreq', 1, 50, 1).name('Bob Freq');
    headFolder.add(this.#animParams, 'headBobAmp', 0, 0.5, 0.01).name('Bob Amp');
    headFolder.add(this.#animParams, 'headSwayFreq', 1, 50, 1).name('Sway Freq');
    headFolder.add(this.#animParams, 'headSwayAmp', 0, 0.5, 0.01).name('Sway Amp');

    const handsFolder = folder.addFolder('Hands');
    handsFolder.add(this.#animParams, 'handsFreq', 1, 50, 1).name('Frequency');
    handsFolder.add(this.#animParams, 'handsAmp', 0, 1, 0.01).name('Amplitude');

    const bodyFolder = folder.addFolder('Body');
    bodyFolder.add(this.#animParams, 'bodyTilt', 0, 0.5, 0.01).name('Forward Tilt');
    bodyFolder.add(this.#animParams, 'bodyTwistFreq', 1, 30, 1).name('Twist Freq');
    bodyFolder.add(this.#animParams, 'bodyTwistAmp', 0, 0.5, 0.01).name('Twist Amp');

    folder.open();
  }

  private createMesh() {
    const modelName = this.#playerId === 1 ? 'pigModel' : 'crocoModel';
    const model = this.#resources.getGLTFAsset(modelName);

    if (!model) {
      return;
    }

    this.#mesh = model.scene.clone();
    this.#mesh.scale.setScalar(1);
    this.#mesh.position.copy(this.#spawnPosition);
    this.#mesh.rotation.y = Math.PI / 2;

    const playerColor = new Color(PLAYER_COLORS.get(this.#playerId)!);

    this.#mesh.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        if (child.material instanceof MeshStandardMaterial) {
          child.material = child.material.clone();
          child.material.color.add(playerColor);
        }
      }
    });

    // Get references to body parts for procedural animation
    if (this.#playerId === 1) {
      // Pig
      this.#body = this.#mesh.getObjectByName('Sphere') ?? null;
      this.#head = this.#mesh.getObjectByName('Sphere002') ?? null;
      this.#handLeft = this.#mesh.getObjectByName('Cylinder') ?? null;
      this.#handRight = this.#mesh.getObjectByName('Cylinder001') ?? null;
    } else {
      // Croco
      this.#body = this.#mesh.getObjectByName('Sphere006') ?? null;
      this.#head = this.#mesh.getObjectByName('Sphere005') ?? null;
      this.#handLeft = this.#mesh.getObjectByName('Cylinder003') ?? null;
      this.#handRight = this.#mesh.getObjectByName('Cylinder002') ?? null;
    }

    // Reparent hands under body so they rotate with body twist
    if (this.#body && this.#handLeft && this.#handRight) {
      const bodyPos = this.#body.position;
      const leftPos = this.#handLeft.position.clone().sub(bodyPos);
      const rightPos = this.#handRight.position.clone().sub(bodyPos);
      this.#body.add(this.#handLeft);
      this.#body.add(this.#handRight);
      this.#handLeft.position.copy(leftPos);
      this.#handRight.position.copy(rightPos);
    }

    this.#screenGroup.add(this.#mesh);
  }

  private createPhysicsBody() {
    if (!this.#mesh) return;

    this.#rigidBody = this.#physics.createDynamicRigidBody(this.#spawnPosition);

    this.#physics.createCapsuleCollider(this.#rigidBody, 0, 0.6, 0.3);

    this.#rigidBody.lockRotations(true, true);
    this.#rigidBody.setLinearDamping(8.0);
    this.#rigidBody.setAngularDamping(1.0);
  }

  private updateMovement() {
    if (!this.#rigidBody) return;

    const inputSource = this.#gamepadManager.getInputSource(this.#playerId);
    if (!inputSource?.connected) return;

    const deltaTime = this.#time.delta * 0.001;

    // Update dash timers
    if (this.#dashState.timer > 0) {
      this.#dashState.timer -= deltaTime;
      if (this.#dashState.timer <= 0) {
        this.#dashState.isDashing = false;
        this.#dashState.timer = 0;
      }
    }

    if (this.#dashState.cooldownTimer > 0) {
      this.#dashState.cooldownTimer -= deltaTime;
      if (this.#dashState.cooldownTimer < 0) {
        this.#dashState.cooldownTimer = 0;
      }
    }

    const { movementSpeed } = this.#properties;
    const { x, z } = inputSource.getMovement();

    // Check for dash button press (B button like in Overcooked)
    const isDashButtonPressed = inputSource.isButtonPressed('b');
    const isMoving = Math.abs(x) > 0.01 || Math.abs(z) > 0.01;

    if (isDashButtonPressed && !this.#dashState.isDashing && this.#dashState.cooldownTimer <= 0 && isMoving) {
      // Initiate dash
      this.#dashState.isDashing = true;
      this.#dashState.timer = DASH_DURATION;
      this.#dashState.cooldownTimer = DASH_COOLDOWN;
      this.#dashState.direction = { x, z };
      this.#hasDashBurst = false;
    }

    const currentVel = this.#rigidBody.linvel();
    let desiredVelX: number;
    let desiredVelZ: number;

    // Normalize movement vector to prevent faster diagonal movement
    const magnitude = Math.sqrt(x * x + z * z);
    const normalizedX = magnitude > 0 ? x / magnitude : 0;
    const normalizedZ = magnitude > 0 ? z / magnitude : 0;
    // Use original magnitude clamped to 1 for analog stick sensitivity
    const inputMagnitude = Math.min(magnitude, 1);

    if (this.#dashState.isDashing) {
      // Apply dash velocity (also normalize dash direction)
      const dashMag = Math.sqrt(this.#dashState.direction.x ** 2 + this.#dashState.direction.z ** 2);
      const dashNormX = dashMag > 0 ? this.#dashState.direction.x / dashMag : 0;
      const dashNormZ = dashMag > 0 ? this.#dashState.direction.z / dashMag : 0;
      desiredVelX = dashNormX * DASH_SPEED;
      desiredVelZ = dashNormZ * DASH_SPEED;
    } else {
      // Apply normal movement velocity with normalized direction
      desiredVelX = normalizedX * inputMagnitude * movementSpeed;
      desiredVelZ = normalizedZ * inputMagnitude * movementSpeed;
    }

    const forceVector = new RAPIER.Vector3(desiredVelX, currentVel.y, desiredVelZ);
    this.#rigidBody.setLinvel(forceVector, true);
  }

  private updateRotation() {
    if (!this.#mesh || !this.#rigidBody) return;

    const velocity = this.#rigidBody.linvel();
    const vx = velocity.x;
    const vz = velocity.z;

    const isMoving = Math.abs(vx) > 0.01 || Math.abs(vz) > 0.01;

    if (isMoving) {
      this.#targetRotationY = Math.atan2(-vz, vx);
    }

    let angleDiff = this.#targetRotationY - this.#currentRotationY;

    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    this.#currentRotationY += angleDiff * 0.15;

    this.#mesh.rotation.y = this.#currentRotationY + Math.PI / 2;
  }

  private syncMeshWithPhysics() {
    if (!this.#mesh || !this.#rigidBody) return;

    const position = this.#rigidBody.translation();
    this.#mesh.position.set(position.x, position.y - 0.5, position.z);
  }

  public isCarrying(): boolean {
    return this.#carriedResource !== null;
  }

  public getCarriedResourceType(): ResourceType | null {
    return this.#carriedResource?.type ?? null;
  }

  public getCarriedResourceState(): ResourceState | null {
    return this.#carriedResource?.state ?? null;
  }

  public grabResource(type: ResourceType, state: ResourceState = 'broken'): void {
    if (this.#carriedResource || !this.#mesh) return;

    const modelName = state === 'repaired'
      ? Crate.getRepairedModelName(type)
      : Crate.getResourceModelName(type);
    if (!modelName) return;

    const model = this.#resources.getGLTFAsset(modelName);
    if (!model) return;

    const resourceMesh = model.scene.clone();
    resourceMesh.position.set(0, 0.3, 1.1);

    resourceMesh.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.#mesh.add(resourceMesh);
    this.#carriedResource = { type, state, mesh: resourceMesh };
  }

  public dropResource(): { type: ResourceType; state: ResourceState } | null {
    if (!this.#carriedResource) return null;

    const { type, state } = this.#carriedResource;
    this.#carriedResource.mesh.removeFromParent();
    this.#carriedResource = null;
    return { type, state };
  }

  #updateAnimation(): void {
    if (!this.#rigidBody) return;

    const velocity = this.#rigidBody.linvel();
    const speed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2);
    const isMoving = speed > 0.1;

    const time = this.#time.elapsed * 0.001;
    const { headBobFreq, headBobAmp, headSwayFreq, headSwayAmp, handsFreq, handsAmp, bodyTilt, bodyTwistFreq, bodyTwistAmp } =
      this.#animParams;
    const lerpFactor = isMoving ? 0.1 : 0.25;

    // Body & Head: tilt forward when moving
    const targetTilt = isMoving ? bodyTilt : 0;
    this.#currentBodyTilt += (targetTilt - this.#currentBodyTilt) * lerpFactor;

    if (this.#body) {
      this.#body.rotation.x = this.#currentBodyTilt;
      if (isMoving) {
        const twistWave = Math.sin(time * bodyTwistFreq);
        this.#body.rotation.y = twistWave * bodyTwistAmp;
      } else {
        this.#body.rotation.y *= 1 - lerpFactor;
      }
    }

    if (isMoving) {
      // Head: bobbing up-down and left-right, plus forward tilt
      if (this.#head) {
        const headBobWave = Math.sin(time * headBobFreq);
        const headSwayWave = Math.sin(time * headSwayFreq);
        this.#head.rotation.x = this.#currentBodyTilt + headBobWave * headBobAmp;
        this.#head.rotation.y = headSwayWave * headSwayAmp;
      }

      // Hands: opposite swinging motion
      const handsWave = Math.sin(time * handsFreq);
      if (this.#handLeft) {
        this.#handLeft.rotation.x = handsWave * handsAmp;
      }
      if (this.#handRight) {
        this.#handRight.rotation.x = -handsWave * handsAmp;
      }
    } else {
      // Smoothly return to neutral position
      if (this.#head) {
        this.#head.rotation.x += (this.#currentBodyTilt - this.#head.rotation.x) * lerpFactor;
        this.#head.rotation.y *= 1 - lerpFactor;
      }
      if (this.#handLeft) {
        this.#handLeft.rotation.x *= 1 - lerpFactor;
      }
      if (this.#handRight) {
        this.#handRight.rotation.x *= 1 - lerpFactor;
      }
    }
  }

  #updateSmoke(): void {
    if (!this.#smokeSystem || !this.#rigidBody) return;

    const position = this.getPosition();
    const linvel = this.#rigidBody.linvel();
    const velocity = this.#cachedVelocity.set(linvel.x, linvel.y, linvel.z);

    // Burst on dash start
    if (this.#dashState.isDashing && !this.#hasDashBurst && position) {
      this.#smokeSystem.spawnBurst(position, velocity, 5);
      this.#hasDashBurst = true;
    }

    this.#smokeSystem.update(position, velocity, this.#dashState.isDashing);
  }

  public update() {
    this.updateMovement();
    this.updateRotation();
    this.syncMeshWithPhysics();
    this.#updateAnimation();
    this.#updateSmoke();
  }
}
