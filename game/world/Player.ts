import type RAPIER from '@dimforge/rapier3d-compat';
import { Color, type Group, Mesh, MeshStandardMaterial, type Object3D, type Scene, SpotLight, Vector3 } from 'three';

import { DASH_COOLDOWN, DASH_DURATION, DASH_SPEED, MOVEMENT_SPEED, SMOKE_DASH_ARC_ANGLE, SMOKE_DASH_ARC_COUNT } from '../constants';
import type { GripConfig, ResourceState, ResourceType } from '../types';
import { Debug } from '../util/Debug';
import { GamepadManager, type PlayerId } from '../util/input/GamepadManager';
import { Physics } from '../util/Physics';
import { Resources } from '../util/Resources';
import { Time } from '../util/Time';
import { Crate } from './object/Crate';
import { RepairAnimation } from './RepairAnimation';
import { SmokeParticleSystem } from './SmokeParticleSystem';


const PLAYER_COLORS: Record<PlayerId, string> = {
  1: '#e1a3ac',
  2: '#004200',
};

type GripKey = `${ResourceType}_${ResourceState}`;

function gripKey(type: ResourceType, state: ResourceState): GripKey {
  return `${type}_${state}`;
}

const GRIP_LABELS: Record<GripKey, string> = {
  battery_broken: 'Battery (empty)',
  battery_repaired: 'Battery (full)',
  frame_broken: 'Frame (broken)',
  frame_repaired: 'Frame (repaired)',
  screen_broken: 'Screen (broken)',
  screen_repaired: 'Screen (repaired)',
  phone_broken: 'Phone',
  phone_repaired: 'Phone',
  package_broken: 'Package (open)',
  package_repaired: 'Package (closed)',
};

const GRIP_CONFIGS: Record<GripKey, GripConfig> = {
  battery_broken: { objectOffsetX: 0, objectOffsetY: 0.59, objectOffsetZ: 1.09, objectRotationX: 0.1, objectRotationY: 0, objectRotationZ: 0, objectScale: 1.33, handOffsetX: 0.71, handOffsetY: 0.82, handOffsetZ: 0.61, handRotationX: 0.2, handRotationY: -0.01, handRotationZ: -0.62 },
  battery_repaired: { objectOffsetX: 0, objectOffsetY: 0.59, objectOffsetZ: 1.09, objectRotationX: 0.1, objectRotationY: 0, objectRotationZ: 0, objectScale: 1.33, handOffsetX: 0.71, handOffsetY: 0.82, handOffsetZ: 0.61, handRotationX: 0.2, handRotationY: -0.01, handRotationZ: -0.62 },
  frame_broken: { objectOffsetX: 0.02, objectOffsetY: 1, objectOffsetZ: 1.28, objectRotationX: -1.05, objectRotationY: 0, objectRotationZ: 0, objectScale: 1.33, handOffsetX: 0.67, handOffsetY: 0.51, handOffsetZ: 0.46, handRotationX: -0.46, handRotationY: -0.21, handRotationZ: -0.62 },
  frame_repaired: { objectOffsetX: 0.02, objectOffsetY: 1, objectOffsetZ: 1.28, objectRotationX: -1.05, objectRotationY: 0, objectRotationZ: 0, objectScale: 1.33, handOffsetX: 0.67, handOffsetY: 0.51, handOffsetZ: 0.46, handRotationX: -0.46, handRotationY: -0.21, handRotationZ: -0.62 },
  screen_broken: { objectOffsetX: -0.09, objectOffsetY: 1, objectOffsetZ: 1.28, objectRotationX: -1.05, objectRotationY: 0, objectRotationZ: 0, objectScale: 1.33, handOffsetX: 0.62, handOffsetY: 0.51, handOffsetZ: 0.46, handRotationX: -0.46, handRotationY: -0.21, handRotationZ: -0.62 },
  screen_repaired: { objectOffsetX: 0.02, objectOffsetY: 1, objectOffsetZ: 1.28, objectRotationX: -1.05, objectRotationY: 0, objectRotationZ: 0, objectScale: 1.33, handOffsetX: 0.67, handOffsetY: 0.51, handOffsetZ: 0.46, handRotationX: -0.46, handRotationY: -0.21, handRotationZ: -0.62 },
  phone_broken: { objectOffsetX: 0, objectOffsetY: 0.15, objectOffsetZ: 0.35, objectRotationX: 0, objectRotationY: 0, objectRotationZ: 0, objectScale: 1.33, handOffsetX: 0.12, handOffsetY: 0.15, handOffsetZ: 0.35, handRotationX: 0.35, handRotationY: 0, handRotationZ: 0 },
  phone_repaired: { objectOffsetX: 0.02, objectOffsetY: 1, objectOffsetZ: 1.28, objectRotationX: -1.05, objectRotationY: 0, objectRotationZ: 0, objectScale: 1.33, handOffsetX: 0.67, handOffsetY: 0.51, handOffsetZ: 0.46, handRotationX: -0.46, handRotationY: -0.21, handRotationZ: -0.62 },
  package_broken: { objectOffsetX: 0.04, objectOffsetY: 0.92, objectOffsetZ: 1.3, objectRotationX: -0.23, objectRotationY: 0, objectRotationZ: 0, objectScale: 1.03, handOffsetX: 0.48, handOffsetY: 0.23, handOffsetZ: 0.89, handRotationX: -0.9, handRotationY: -0.19, handRotationZ: -0.42 },
  package_repaired: { objectOffsetX: 0.02, objectOffsetY: 1, objectOffsetZ: 1.28, objectRotationX: -1.05, objectRotationY: 0, objectRotationZ: 0, objectScale: 1.33, handOffsetX: 0.52, handOffsetY: 0.51, handOffsetZ: 0.46, handRotationX: -0.46, handRotationY: -0.21, handRotationZ: -0.62 },
};

export class Player {
  static #screwdriverOffset = new Vector3(-0.76, 0.85, 0.79);
  static #screwdriverRot = new Vector3(2.2884, -0.6415, 0.2);
  static #screwdriverScale = 1.1;
  static #handRepairRot = new Vector3(-1.4, 0, 0);
  static #screwdriverDebugSetup = false;

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

  // Hand rest positions for grip animation
  #handLeftRestPos: Vector3 | null = null;
  #handRightRestPos: Vector3 | null = null;

  // Animation parameters (tunable via debug GUI)
  #animParams = {
    headBobFreq: 12,
    headBobAmp: 0.13,
    headSwayFreq: 13,
    headSwayAmp: 0.07,
    handsFreq: 31,
    handsAmp: 0.14,
    bodyTilt: 0.36,
    bodyTwistFreq: 15,
    bodyTwistAmp: 0.3,
    // Body params when holding an object
    holdingBodyTilt: 0.4,
    holdingBodyTwistFreq: 14,
    holdingBodyTwistAmp: 0.19,
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
  #playerSpotlight: SpotLight | null = null;

  #baseMaterialColors: { material: MeshStandardMaterial; base: Color }[] = [];
  #screwdriverMesh: Object3D | null = null;
  #repairAnimation = new RepairAnimation();
  #repairZonePos = new Vector3();
  #isRepairing = false;

  #interactCallback: (() => void) | null = null;

  #gamepadManager: GamepadManager;
  #playerId: PlayerId;
  #time: Time;


  // Cached vectors to avoid allocations
  #cachedPosition = new Vector3();
  #cachedFacingDirection = new Vector3();
  #cachedVelocity = new Vector3();
  #cachedLeftGripTarget = new Vector3();
  #cachedRightGripTarget = new Vector3();

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
    this.#setupSmokeSystem();

    this.#setupAnimationDebug();
    Player.#setupScrewdriverDebug();
  }

  public onInteract(callback: () => void): void {
    this.#interactCallback = callback;
  }

  public cleanup(): void {
    this.#repairAnimation.stop();
    this.#screwdriverMesh?.removeFromParent();
    this.#screwdriverMesh = null;
    this.#smokeSystem?.dispose();
    if (this.#playerSpotlight) {
      this.#scene.remove(this.#playerSpotlight);
      this.#scene.remove(this.#playerSpotlight.target);
      this.#playerSpotlight.dispose();
      this.#playerSpotlight = null;
    }

    if (this.#carriedResource) {
      this.#carriedResource.mesh.traverse((child) => {
        if (child instanceof Mesh) {
          child.geometry?.dispose();
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          for (const mat of mats) mat?.dispose();
        }
      });
      this.#carriedResource.mesh.removeFromParent();
      this.#carriedResource = null;
    }

    if (this.#mesh) {
      this.#mesh.traverse((child) => {
        if (child instanceof Mesh) {
          child.geometry?.dispose();
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          for (const mat of mats) mat?.dispose();
        }
      });
      this.#mesh.removeFromParent();
      this.#mesh = null;
    }

    this.#baseMaterialColors.length = 0;
  }

  public setNightMode(isNight: boolean): void {
    if (isNight) {
      const light = new SpotLight('#fff8e5', 10, 7, 0.4, 0.4, 2);
      light.castShadow = false;
      this.#scene.add(light);
      this.#scene.add(light.target);
      this.#playerSpotlight = light;
    } else if (this.#playerSpotlight) {
      this.#scene.remove(this.#playerSpotlight);
      this.#scene.remove(this.#playerSpotlight.target);
      this.#playerSpotlight.dispose();
      this.#playerSpotlight = null;
    }
  }

  #updateInteract(): void {
    const inputSource = this.#gamepadManager.getInputSource(this.#playerId);
    if (inputSource?.isButtonJustPressed('a') && this.#interactCallback) {
      this.#interactCallback();
    }
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

    const gripFolder = folder.addFolder('Grip');
    const gripKeys = Object.keys(GRIP_CONFIGS) as GripKey[];
    const gripSelectOptions = Object.fromEntries(gripKeys.map(k => [GRIP_LABELS[k], k]));
    const gripState = { resource: 'screen_broken' as GripKey };
    const gripControllers: { destroy(): void }[] = [];

    const buildGripSliders = (key: GripKey) => {
      for (const c of gripControllers) c.destroy();
      gripControllers.length = 0;
      const grip = GRIP_CONFIGS[key];
      gripControllers.push(
        gripFolder.add(grip, 'objectOffsetX', -0.5, 0.5, 0.01).name('Object X'),
        gripFolder.add(grip, 'objectOffsetY', -0.5, 1, 0.01).name('Object Y'),
        gripFolder.add(grip, 'objectOffsetZ', 0, 1.5, 0.01).name('Object Z'),
        gripFolder.add(grip, 'objectRotationX', -3.14, 3.14, 0.01).name('Object Rot X'),
        gripFolder.add(grip, 'objectRotationY', -3.14, 3.14, 0.01).name('Object Rot Y'),
        gripFolder.add(grip, 'objectRotationZ', -3.14, 3.14, 0.01).name('Object Rot Z'),
        gripFolder.add(grip, 'objectScale', 0.1, 3, 0.01).name('Object Scale'),
        gripFolder.add(grip, 'handOffsetX', 0, 1, 0.01).name('Hand X (width)'),
        gripFolder.add(grip, 'handOffsetY', -0.5, 1, 0.01).name('Hand Y'),
        gripFolder.add(grip, 'handOffsetZ', 0, 1.5, 0.01).name('Hand Z'),
        gripFolder.add(grip, 'handRotationX', -1.5, 1.5, 0.01).name('Hand Rot X'),
        gripFolder.add(grip, 'handRotationY', -1.5, 1.5, 0.01).name('Hand Rot Y'),
        gripFolder.add(grip, 'handRotationZ', -1.5, 1.5, 0.01).name('Hand Rot Z'),
      );
    };

    gripFolder.add(gripState, 'resource', gripSelectOptions).name('Resource').onChange((v: GripKey) => {
      buildGripSliders(v);
    });
    buildGripSliders(gripState.resource);

    const tintState = { color: PLAYER_COLORS[this.#playerId] };
    folder.addColor(tintState, 'color').name('Tint').onChange((v: string) => {
      const tint = new Color(v);
      for (const { material, base } of this.#baseMaterialColors) {
        material.color.copy(base).add(tint);
      }
    });

    folder.close();
  }

  static #setupScrewdriverDebug(): void {
    if (Player.#screwdriverDebugSetup) return;
    const debug = Debug.getInstance();
    if (!debug?.active) return;
    Player.#screwdriverDebugSetup = true;

    const off = Player.#screwdriverOffset;
    const rot = Player.#screwdriverRot;
    const folder = debug.gui.addFolder('Screwdriver (hand)');

    for (const axis of ['x', 'y', 'z'] as const) {
      folder.add(off, axis, -3, 3, 0.01).name(`Pos ${axis.toUpperCase()}`);
    }
    for (const axis of ['x', 'y', 'z'] as const) {
      folder.add(rot, axis, -Math.PI, Math.PI, 0.01).name(`Rot ${axis.toUpperCase()}`);
    }
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

    const playerColor = new Color(PLAYER_COLORS[this.#playerId]);
    this.#baseMaterialColors = [];

    this.#mesh.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        if (child.material instanceof MeshStandardMaterial) {
          child.material = child.material.clone();
          this.#baseMaterialColors.push({ material: child.material, base: child.material.color.clone() });
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

      // Store rest positions for grip animation
      this.#handLeftRestPos = this.#handLeft.position.clone();
      this.#handRightRestPos = this.#handRight.position.clone();
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
    if (this.#isRepairing) return;

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

    if (isDashButtonPressed && !this.#dashState.isDashing && this.#dashState.cooldownTimer <= 0) {
      // Initiate dash — fall back to facing direction when idle
      const facing = this.getFacingDirection();
      const dashDir = isMoving
        ? { x, z }
        : { x: facing.x, z: facing.z };
      this.#dashState.isDashing = true;
      this.#dashState.timer = DASH_DURATION;
      this.#dashState.cooldownTimer = DASH_COOLDOWN;
      this.#dashState.direction = dashDir;
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

    this.#rigidBody.setLinvel({ x: desiredVelX, y: currentVel.y, z: desiredVelZ }, true);
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

    const dt60 = this.#time.delta * 0.001 * 60;
    this.#currentRotationY += angleDiff * (1 - Math.pow(1 - 0.15, dt60));

    this.#mesh.rotation.y = this.#currentRotationY + Math.PI / 2;
  }

  private syncMeshWithPhysics() {
    if (!this.#mesh || !this.#rigidBody) return;

    const position = this.#rigidBody.translation();
    this.#mesh.position.set(position.x, position.y - 0.5, position.z);

    if (this.#playerSpotlight) {
      this.#playerSpotlight.position.set(position.x, position.y + 4, position.z);
      this.#playerSpotlight.target.position.set(position.x, 0, position.z);
      this.#playerSpotlight.target.updateMatrixWorld();
    }
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
    if (this.#carriedResource || !this.#mesh || !this.#body) return;

    const modelName = state === 'repaired'
      ? Crate.getRepairedModelName(type)
      : Crate.getResourceModelName(type);
    if (!modelName) return;

    const model = this.#resources.getGLTFAsset(modelName);
    if (!model) return;

    const grip = GRIP_CONFIGS[gripKey(type, state)];
    const resourceMesh = model.scene.clone();
    resourceMesh.position.set(grip.objectOffsetX, grip.objectOffsetY, grip.objectOffsetZ);

    resourceMesh.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Parent to body so object follows body twist
    this.#body.add(resourceMesh);
    this.#carriedResource = { type, state, mesh: resourceMesh };
  }

  public dropResource(): { type: ResourceType; state: ResourceState } | null {
    if (!this.#carriedResource) return null;

    const { type, state } = this.#carriedResource;
    this.#carriedResource.mesh.removeFromParent();
    this.#carriedResource = null;
    return { type, state };
  }

  public startRepairing(onHit: () => void, screwdriverMesh: Object3D, repairZonePos: Vector3): void {
    if (this.#isRepairing || !this.#handRight) return;
    this.#isRepairing = true;
    this.#screwdriverMesh = screwdriverMesh;
    this.#repairZonePos.copy(repairZonePos);

    // Parent screwdriver to handRight so it follows hand animation automatically
    this.#handRight.add(screwdriverMesh);
    screwdriverMesh.position.copy(Player.#screwdriverOffset);
    screwdriverMesh.rotation.set(Player.#screwdriverRot.x, Player.#screwdriverRot.y, Player.#screwdriverRot.z);
    screwdriverMesh.scale.setScalar(Player.#screwdriverScale);
    Player.#setupScrewdriverDebug();

    this.#repairAnimation.onHit(() => {
      onHit();
      this.#spawnRepairSmoke();
    });
    this.#repairAnimation.start();
  }

  public stopRepairing(): void {
    if (!this.#isRepairing) return;
    this.#isRepairing = false;

    // Detach and dispose cloned screwdriver to free GPU memory
    if (this.#screwdriverMesh) {
      this.#screwdriverMesh.removeFromParent();
      this.#screwdriverMesh.traverse((child) => {
        if (child instanceof Mesh) {
          child.geometry.dispose();
          if (child.material instanceof MeshStandardMaterial) {
            child.material.dispose();
          }
        }
      });
      this.#screwdriverMesh = null;
    }

    this.#repairAnimation.stop();
  }

  #spawnRepairSmoke(): void {
    if (!this.#smokeSystem) return;
    this.#smokeSystem.spawnImpact(this.#repairZonePos, 6);
  }

  public get isRepairing(): boolean {
    return this.#isRepairing;
  }

  #updateAnimation(): void {
    if (!this.#rigidBody) return;

    const velocity = this.#rigidBody.linvel();
    const speed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2);
    const isMoving = speed > 0.1;

    const time = this.#time.elapsed * 0.001;
    const { headBobFreq, headBobAmp, headSwayFreq, headSwayAmp, handsFreq, handsAmp, bodyTilt, bodyTwistFreq, bodyTwistAmp, holdingBodyTilt, holdingBodyTwistFreq, holdingBodyTwistAmp } =
      this.#animParams;
    const dt60 = this.#time.delta * 0.001 * 60;
    const lerpFactor = 1 - Math.pow(1 - (isMoving ? 0.1 : 0.25), dt60);
    const isHolding = this.#carriedResource !== null;

    // Use different body params when holding
    const currentBodyTilt = isHolding ? holdingBodyTilt : bodyTilt;
    const currentTwistFreq = isHolding ? holdingBodyTwistFreq : bodyTwistFreq;
    const currentTwistAmp = isHolding ? holdingBodyTwistAmp : bodyTwistAmp;

    // Body & Head: tilt forward when moving (skipped during repair — handled below)
    if (!this.#isRepairing) {
      const targetTilt = isMoving ? currentBodyTilt : 0;
      this.#currentBodyTilt += (targetTilt - this.#currentBodyTilt) * lerpFactor;

      if (this.#body) {
        this.#body.rotation.x = this.#currentBodyTilt;
        if (isMoving) {
          const twistWave = Math.sin(time * currentTwistFreq);
          this.#body.rotation.y = twistWave * currentTwistAmp;
        } else {
          this.#body.rotation.y *= 1 - lerpFactor;
        }
      }

      // Head animation (independent of holding state)
      if (isMoving) {
        if (this.#head) {
          const headBobWave = Math.sin(time * headBobFreq);
          const headSwayWave = Math.sin(time * headSwayFreq);
          this.#head.rotation.x = this.#currentBodyTilt + headBobWave * headBobAmp;
          this.#head.rotation.y = headSwayWave * headSwayAmp;
        }
      } else {
        if (this.#head) {
          this.#head.rotation.x += (this.#currentBodyTilt - this.#head.rotation.x) * lerpFactor;
          this.#head.rotation.y *= 1 - lerpFactor;
        }
      }
    }

    // Hands animation - different behavior when holding/repairing
    const handLerpFactor = 1 - Math.pow(1 - 0.8, dt60);

    if (this.#isRepairing) {
      this.#repairAnimation.update(this.#time.delta);

      // Body & head oscillate with the repair motion (body leads the hand)
      const bodyTarget = this.#repairAnimation.bodyTiltX;
      if (this.#body) {
        this.#body.rotation.x += (bodyTarget - this.#body.rotation.x) * handLerpFactor;
        this.#body.rotation.y *= 1 - handLerpFactor;
      }
      if (this.#head) {
        this.#head.rotation.x += (bodyTarget - this.#head.rotation.x) * handLerpFactor;
        this.#head.rotation.y *= 1 - handLerpFactor;
      }

      if (this.#handRight && this.#handRightRestPos) {
        const offset = this.#repairAnimation.targetOffset;
        const targetPos = this.#cachedRightGripTarget.copy(this.#handRightRestPos).add(offset);
        // Shift forward for "working on the object" posture
        targetPos.z += 0.3;
        targetPos.x = Math.abs(targetPos.x) * 0.5;

        this.#handRight.position.lerp(targetPos, handLerpFactor);
        this.#handRight.rotation.x += (this.#repairAnimation.targetRotationX + Player.#handRepairRot.x - this.#handRight.rotation.x) * handLerpFactor;
        this.#handRight.rotation.y += (Player.#handRepairRot.y - this.#handRight.rotation.y) * handLerpFactor;
        this.#handRight.rotation.z += (Player.#handRepairRot.z - this.#handRight.rotation.z) * handLerpFactor;
      }

      // Screwdriver follows handRight automatically — apply debug-tunable offset/rotation each frame
      if (this.#screwdriverMesh) {
        this.#screwdriverMesh.position.copy(Player.#screwdriverOffset);
        this.#screwdriverMesh.rotation.set(Player.#screwdriverRot.x, Player.#screwdriverRot.y, Player.#screwdriverRot.z);
      }

      // Left hand: return to rest
      if (this.#handLeft) {
        this.#handLeft.rotation.x *= 1 - lerpFactor;
        this.#handLeft.rotation.y *= 1 - lerpFactor;
        this.#handLeft.rotation.z *= 1 - lerpFactor;
        if (this.#handLeftRestPos) {
          this.#handLeft.position.lerp(this.#handLeftRestPos, handLerpFactor);
        }
      }
    } else if (isHolding && this.#carriedResource) {
      // When holding: hands move to grip position, no swing
      // Read grip config dynamically for real-time debug adjustments
      const grip = GRIP_CONFIGS[gripKey(this.#carriedResource.type, this.#carriedResource.state)];

      // Update carried resource position, rotation and scale from current grip config
      this.#carriedResource.mesh.position.set(grip.objectOffsetX, grip.objectOffsetY, grip.objectOffsetZ);
      this.#carriedResource.mesh.rotation.set(grip.objectRotationX, grip.objectRotationY, grip.objectRotationZ);
      this.#carriedResource.mesh.scale.setScalar(grip.objectScale);

      // Calculate hand target positions from independent hand offsets
      const leftTarget = this.#cachedLeftGripTarget.set(-grip.handOffsetX, grip.handOffsetY, grip.handOffsetZ);
      const rightTarget = this.#cachedRightGripTarget.set(grip.handOffsetX, grip.handOffsetY, grip.handOffsetZ);

      if (this.#handLeft) {
        this.#handLeft.position.lerp(leftTarget, handLerpFactor);
        this.#handLeft.rotation.x += (grip.handRotationX - this.#handLeft.rotation.x) * handLerpFactor;
        this.#handLeft.rotation.y += (grip.handRotationY - this.#handLeft.rotation.y) * handLerpFactor;
        this.#handLeft.rotation.z += (grip.handRotationZ - this.#handLeft.rotation.z) * handLerpFactor;
      }
      if (this.#handRight) {
        this.#handRight.position.lerp(rightTarget, handLerpFactor);
        this.#handRight.rotation.x += (grip.handRotationX - this.#handRight.rotation.x) * handLerpFactor;
        this.#handRight.rotation.y += (-grip.handRotationY - this.#handRight.rotation.y) * handLerpFactor;
        this.#handRight.rotation.z += (-grip.handRotationZ - this.#handRight.rotation.z) * handLerpFactor;
      }
    } else {
      // When not holding: normal swing animation + return to rest position
      if (isMoving) {
        const handsWave = Math.sin(time * handsFreq);
        if (this.#handLeft) {
          this.#handLeft.rotation.x = handsWave * handsAmp;
          this.#handLeft.rotation.y *= 1 - handLerpFactor;
          this.#handLeft.rotation.z *= 1 - handLerpFactor;
          if (this.#handLeftRestPos) {
            this.#handLeft.position.lerp(this.#handLeftRestPos, handLerpFactor);
          }
        }
        if (this.#handRight) {
          this.#handRight.rotation.x = -handsWave * handsAmp;
          this.#handRight.rotation.y *= 1 - handLerpFactor;
          this.#handRight.rotation.z *= 1 - handLerpFactor;
          if (this.#handRightRestPos) {
            this.#handRight.position.lerp(this.#handRightRestPos, handLerpFactor);
          }
        }
      } else {
        if (this.#handLeft) {
          this.#handLeft.rotation.x *= 1 - lerpFactor;
          this.#handLeft.rotation.y *= 1 - lerpFactor;
          this.#handLeft.rotation.z *= 1 - lerpFactor;
          if (this.#handLeftRestPos) {
            this.#handLeft.position.lerp(this.#handLeftRestPos, handLerpFactor);
          }
        }
        if (this.#handRight) {
          this.#handRight.rotation.x *= 1 - lerpFactor;
          this.#handRight.rotation.y *= 1 - lerpFactor;
          this.#handRight.rotation.z *= 1 - lerpFactor;
          if (this.#handRightRestPos) {
            this.#handRight.position.lerp(this.#handRightRestPos, handLerpFactor);
          }
        }
      }
    }
  }

  #updateSmoke(): void {
    if (!this.#smokeSystem || !this.#rigidBody) return;

    const position = this.getPosition();
    // #cachedVelocity holds the physics-resolved velocity captured at the top of update(),
    // before input overwrites linvel — so it reflects actual movement, not desired movement.
    const velocity = this.#cachedVelocity;

    // Burst on dash start
    if (this.#dashState.isDashing && !this.#hasDashBurst && position) {
      const dashDir = new Vector3(this.#dashState.direction.x, 0, this.#dashState.direction.z);
      this.#smokeSystem.spawnArc(position, dashDir, SMOKE_DASH_ARC_COUNT, SMOKE_DASH_ARC_ANGLE);
      this.#hasDashBurst = true;
    }

    this.#smokeSystem.update(position, velocity, this.#dashState.isDashing);
  }

  public update() {
    // Capture physics-resolved velocity before updateMovement() overwrites linvel with
    // gamepad input. This ensures smoke only appears when the player actually moves,
    // not when they are pressing a direction while blocked by a bench.
    if (this.#rigidBody) {
      const v = this.#rigidBody.linvel();
      this.#cachedVelocity.set(v.x, v.y, v.z);
    }

    this.updateMovement();
    this.updateRotation();
    this.syncMeshWithPhysics();
    this.#updateAnimation();
    this.#updateSmoke();
    this.#updateInteract();
  }
}
