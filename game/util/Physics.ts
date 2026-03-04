import RAPIER, { type RigidBody, type World } from '@dimforge/rapier3d-compat';
import type { Vector3 } from 'three';

export class Physics {
  private static instance: Physics | null = null;
  private world: World | null = null;
  private initialized = false;

  private constructor() {}

  public static getInstance() {
    if (!Physics.instance) {
      Physics.instance = new Physics();
    }
    return Physics.instance;
  }

  public async init() {
    this.#accumulator = 0;
    if (this.initialized) return;

    await RAPIER.init();

    const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
    this.world = new RAPIER.World(gravity);

    this.initialized = true;
  }

  public getWorld() {
    if (!this.world) {
      throw new Error('Physics world not initialized. Call init() first.');
    }
    return this.world;
  }

  public createStaticRigidBody(position: Vector3) {
    const world = this.getWorld();
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);

    return world.createRigidBody(rigidBodyDesc);
  }

  public createDynamicRigidBody(position: Vector3) {
    const world = this.getWorld();
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x, position.y, position.z);

    return world.createRigidBody(rigidBodyDesc);
  }

  public createBoxCollider(rigidBody: RigidBody, halfExtents: Vector3, friction = 0.0) {
    const world = this.getWorld();
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setFriction(friction);

    return world.createCollider(colliderDesc, rigidBody);
  }

  public createCapsuleCollider(rigidBody: RigidBody, halfHeight: number, radius: number, friction = 0.0) {
    const world = this.getWorld();
    const colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius).setFriction(friction);

    return world.createCollider(colliderDesc, rigidBody);
  }

  // Fixed-timestep accumulator: Rapier's step() advances by a constant dt (1/60s).
  // Without accumulation, a single step() per frame ties physics speed to framerate —
  // at 30 FPS characters move at half speed. The accumulator catches up by running
  // multiple steps when frames are slow, keeping movement consistent regardless of FPS.
  // Capped at 100ms to prevent a "spiral of death" after long pauses (e.g. tab in background).
  #accumulator = 0;

  public update(deltaMs: number) {
    if (!this.world) return;
    const fixedDt = this.world.timestep * 1000; // ~16.67ms
    this.#accumulator += Math.min(deltaMs, 100);
    while (this.#accumulator >= fixedDt) {
      this.world.step();
      this.#accumulator -= fixedDt;
    }
  }

  public dispose(): void {
    if (this.world) {
      this.world.free();
      this.world = null;
    }
    this.initialized = false;
    Physics.instance = null;
  }
}
