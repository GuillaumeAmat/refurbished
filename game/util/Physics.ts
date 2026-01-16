import RAPIER, { type RigidBody, type World } from '@dimforge/rapier3d-compat';
import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments, type Scene, type Vector3 } from 'three';

import { Debug } from './Debug';

export class Physics {
  private static instance: Physics | null = null;
  private world: World | null = null;
  private initialized = false;
  private debug: Debug;
  private debugRenderer: LineSegments | null = null;
  private scene: Scene | null = null;

  private constructor() {
    this.debug = Debug.getInstance();
  }

  public static getInstance() {
    if (!Physics.instance) {
      Physics.instance = new Physics();
    }
    return Physics.instance;
  }

  public async init(scene?: Scene) {
    if (this.initialized) return;

    await RAPIER.init();

    const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
    this.world = new RAPIER.World(gravity);

    if (scene) {
      this.scene = scene;
      this.setupDebugRenderer();
    }

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

  public update() {
    if (!this.world) return;
    this.world.step();
    this.updateDebugRenderer();
  }

  private setupDebugRenderer(): void {
    if (!this.debug.active || !this.scene) return;

    const material = new LineBasicMaterial({
      color: 0x00ff00,
      linewidth: 1,
    });

    const geometry = new BufferGeometry();
    this.debugRenderer = new LineSegments(geometry, material);
    this.scene.add(this.debugRenderer);
  }

  private updateDebugRenderer(): void {
    if (!this.debug.active || !this.debugRenderer || !this.world) return;

    const buffers = this.world.debugRender();
    this.debugRenderer.geometry.setAttribute('position', new BufferAttribute(buffers.vertices, 3));
    this.debugRenderer.geometry.setAttribute('color', new BufferAttribute(buffers.colors, 4));
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
