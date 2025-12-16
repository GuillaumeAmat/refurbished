import RAPIER from '@dimforge/rapier3d-compat';
import { Box3, Vector3 } from 'three';
import type { PhysicsManager } from './PhysicsManager';

/**
 * Manages collision bodies for prefabs in test mode
 * Creates static box colliders for all placed prefabs
 */
export class PrefabColliderManager {
  private physicsManager: PhysicsManager;
  private rigidBodies: RAPIER.RigidBody[] = [];

  constructor(physicsManager: PhysicsManager) {
    this.physicsManager = physicsManager;
  }

  /**
   * Create box colliders for all prefabs in the scene
   */
  public createCollidersForPrefabs(prefabs: THREE.Group[]): void {
    prefabs.forEach((prefab) => {
      this.createColliderForPrefab(prefab);
    });
  }

  /**
   * Create a box collider for a single prefab
   */
  private createColliderForPrefab(prefab: THREE.Group): void {
    // Calculate bounding box
    const bbox = new Box3().setFromObject(prefab);

    // Get center and size
    const center = new Vector3();
    bbox.getCenter(center);

    const size = new Vector3();
    bbox.getSize(size);

    // Half extents for box collider
    const halfExtents = new Vector3(size.x / 2, size.y / 2, size.z / 2);

    // Create static rigid body at center
    const rigidBody = this.physicsManager.createStaticRigidBody(center);

    // Create box collider with no friction
    this.physicsManager.createBoxCollider(rigidBody, halfExtents, 0.0);

    // Store reference for cleanup
    this.rigidBodies.push(rigidBody);
  }

  /**
   * Create a floor collider to prevent falling
   */
  public createFloorCollider(): void {
    // Floor dimensions match level editor floor (100x50 grid)
    const position = new Vector3(0, -0.1, 0);
    const halfExtents = new Vector3(50, 0.1, 25); // 100x0.2x50 box

    const rigidBody = this.physicsManager.createStaticRigidBody(position);
    this.physicsManager.createBoxCollider(rigidBody, halfExtents, 0.5);

    this.rigidBodies.push(rigidBody);
  }

  /**
   * Clean up all created colliders
   */
  public dispose(): void {
    // Remove all rigid bodies from physics world
    const world = this.physicsManager.getWorld();
    this.rigidBodies.forEach((rigidBody) => {
      world.removeRigidBody(rigidBody);
    });

    this.rigidBodies = [];
  }
}
