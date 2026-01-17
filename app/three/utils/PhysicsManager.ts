import RAPIER, { type Collider, type RigidBody, type World } from '@dimforge/rapier3d-compat';
import { Vector3 } from 'three';

/**
 * Physics manager for level editor test mode
 * Simplified version of game/utils/Physics.ts without singleton pattern and debug renderer
 */
export class PhysicsManager {
  private world: World | null = null;
  private initialized = false;

  /**
   * Initialize RAPIER physics world
   */
  public async init(): Promise<void> {
    if (this.initialized) return;

    await RAPIER.init();

    const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
    this.world = new RAPIER.World(gravity);

    this.initialized = true;
  }

  /**
   * Get the physics world instance
   */
  public getWorld(): World {
    if (!this.world) {
      throw new Error('Physics world not initialized. Call init() first.');
    }
    return this.world;
  }

  /**
   * Create a static (fixed) rigid body at the given position
   */
  public createStaticRigidBody(position: Vector3): RigidBody {
    const world = this.getWorld();
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);

    return world.createRigidBody(rigidBodyDesc);
  }

  /**
   * Create a dynamic rigid body at the given position
   */
  public createDynamicRigidBody(position: Vector3): RigidBody {
    const world = this.getWorld();
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x, position.y, position.z);

    return world.createRigidBody(rigidBodyDesc);
  }

  /**
   * Create a box collider for the given rigid body
   */
  public createBoxCollider(rigidBody: RigidBody, halfExtents: Vector3, friction = 0.0): Collider {
    const world = this.getWorld();
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setFriction(
      friction
    );

    return world.createCollider(colliderDesc, rigidBody);
  }

  /**
   * Create a capsule collider for the given rigid body
   */
  public createCapsuleCollider(rigidBody: RigidBody, halfHeight: number, radius: number, friction = 0.0): Collider {
    const world = this.getWorld();
    const colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius).setFriction(friction);

    return world.createCollider(colliderDesc, rigidBody);
  }

  /**
   * Step the physics simulation forward
   */
  public update(): void {
    if (!this.world) return;
    this.world.step();
  }

  /**
   * Clean up physics resources
   */
  public dispose(): void {
    if (this.world) {
      this.world.free();
      this.world = null;
    }
    this.initialized = false;
  }
}
