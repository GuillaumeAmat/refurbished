import RAPIER from '@dimforge/rapier3d-compat';
import { Color, type Group, Mesh, MeshStandardMaterial, type Object3D, type Scene, Vector3 } from 'three';

import { DASH_COOLDOWN, DASH_DURATION, DASH_SPEED, MOVEMENT_SPEED } from '../constants';
import type { ResourceType } from '../types';
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

  #carriedResource: { type: ResourceType; mesh: Object3D } | null = null;

  #smokeSystem: SmokeParticleSystem | null = null;
  #hasDashBurst = false;

  #interactCallback: (() => void) | null = null;

  #gamepadManager: GamepadManager;
  #playerId: PlayerId;
  #time: Time;

  public get mesh() {
    return this.#mesh;
  }

  public getPosition(): Vector3 | null {
    if (!this.#rigidBody) return null;
    const t = this.#rigidBody.translation();
    return new Vector3(t.x, t.y, t.z);
  }

  public getFacingDirection(): Vector3 {
    return new Vector3(Math.cos(this.#currentRotationY), 0, -Math.sin(this.#currentRotationY));
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

    if (this.#dashState.isDashing) {
      // Apply dash velocity
      desiredVelX = this.#dashState.direction.x * DASH_SPEED;
      desiredVelZ = this.#dashState.direction.z * DASH_SPEED;
    } else {
      // Apply normal movement velocity
      desiredVelX = x * movementSpeed;
      desiredVelZ = z * movementSpeed;
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

  public grabResource(type: ResourceType): void {
    if (this.#carriedResource || !this.#mesh) return;

    const modelName = Crate.getResourceModelName(type);
    if (!modelName) return;

    const model = this.#resources.getGLTFAsset(modelName);
    if (!model) return;

    const resourceMesh = model.scene.clone();
    resourceMesh.position.set(0, 1.8, 0);

    resourceMesh.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.#mesh.add(resourceMesh);
    this.#carriedResource = { type, mesh: resourceMesh };
  }

  public dropResource(): ResourceType | null {
    if (!this.#carriedResource) return null;

    const type = this.#carriedResource.type;
    this.#carriedResource.mesh.removeFromParent();
    this.#carriedResource = null;
    return type;
  }

  #updateSmoke(): void {
    if (!this.#smokeSystem || !this.#rigidBody) return;

    const position = this.getPosition();
    const linvel = this.#rigidBody.linvel();
    const velocity = new Vector3(linvel.x, linvel.y, linvel.z);

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
    this.#updateSmoke();
  }
}
