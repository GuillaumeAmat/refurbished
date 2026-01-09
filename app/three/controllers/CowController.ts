import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { Box3, BoxGeometry, Mesh, MeshStandardMaterial, type Object3D, type Scene, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { InputController } from '../../../game/utils/InputController';
import type { PhysicsManager } from '../utils/PhysicsManager';

/**
 * Cow controller for level editor test mode
 * Adapted from game/world/Player.ts
 */
export class CowController {
  private scene: Scene;
  private physicsManager: PhysicsManager;

  private mesh: Object3D | null = null;
  private rigidBody: RAPIER.RigidBody | null = null;

  private currentRotationY = 0;
  private targetRotationY = 0;

  private properties = {
    width: 1, // Will be calculated from bounding box
    height: 1, // Will be calculated from bounding box
    depth: 1, // Will be calculated from bounding box
    movementSpeed: 12.5, // 2x faster than previous speed (6.25 * 2)
  };

  private inputController: InputController;
  private preloadedModel: THREE.Group | null = null;

  constructor(scene: Scene, physicsManager: PhysicsManager, preloadedModel?: THREE.Group | null) {
    this.scene = scene;
    this.physicsManager = physicsManager;
    this.inputController = new InputController();
    this.preloadedModel = preloadedModel || null;

    // Async initialization handled separately
    this.init();
  }

  /**
   * Initialize the controller (async)
   */
  private async init(): Promise<void> {
    await this.createMesh();
    this.createPhysicsBody();
  }

  /**
   * Create the cow mesh by loading cow.glb
   */
  private async createMesh(): Promise<void> {
    try {
      let model: THREE.Group;

      // Use preloaded model if available, otherwise load it
      if (this.preloadedModel) {
        model = this.preloadedModel.clone();
      } else {
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync('/models/cow.glb');
        model = gltf.scene;
      }

      // Apply shadows to all meshes (materials come from GLTF)
      model.traverse((child) => {
        if (child instanceof Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Scale and position the model
      model.scale.setScalar(0.9);
      model.position.set(0, 0, 0);

      this.mesh = model;

      // Calculate bounding box for collider dimensions
      model.updateMatrixWorld(true);
      const bbox = new Box3().setFromObject(model);
      const size = new Vector3();
      bbox.getSize(size);

      // Update properties with actual model dimensions
      this.properties.width = size.x;
      this.properties.height = size.y;
      this.properties.depth = size.z;

      this.scene.add(this.mesh);
    } catch (error) {
      console.error('Error loading cow.glb:', error);
      // Fallback: create a simple placeholder
      this.createFallbackMesh();
    }
  }

  /**
   * Create a fallback mesh if cow.glb fails to load
   */
  private createFallbackMesh(): void {
    const geometry = new BoxGeometry(this.properties.width, this.properties.height, this.properties.width);
    const material = new MeshStandardMaterial({ color: 0x8b4513 });
    this.mesh = new Mesh(geometry, material);

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.position.set(0, 0.5, 0);

    this.scene.add(this.mesh);
  }

  /**
   * Create the physics body with capsule collider
   * Same configuration as Player in the game
   */
  private createPhysicsBody(): void {
    if (!this.mesh) return;

    // Start at height equal to half the model height plus some margin
    const initialPosition = new Vector3(0, this.properties.height / 2 + 1, 0);
    this.rigidBody = this.physicsManager.createDynamicRigidBody(initialPosition);

    // Create capsule collider based on bounding box
    // Use average of width and depth for radius, and height for the capsule height
    // Multiply by 1.3 to make the collider slightly larger than the visual model
    const radius = Math.max(this.properties.width, this.properties.depth) / 2 * 1.3;
    const halfHeight = this.properties.height / 2 * 1.1;
    this.physicsManager.createCapsuleCollider(this.rigidBody, halfHeight, radius, 0.0);

    // Lock rotations to prevent tipping over
    this.rigidBody.lockRotations(true, true);

    // Apply damping for smooth movement
    this.rigidBody.setLinearDamping(8.0);
    this.rigidBody.setAngularDamping(1.0);
  }

  /**
   * Update movement based on keyboard input
   * Same logic as Player.updateMovement()
   */
  private updateMovement(): void {
    if (!this.rigidBody) return;

    const { movementSpeed } = this.properties;

    // Determine movement direction based on input
    let x = 0;
    let z = 0;

    // Left/Right Movement
    if (
      this.inputController.isKeyPressed('ArrowLeft') ||
      this.inputController.isKeyPressed('KeyA') ||
      this.inputController.isKeyPressed('KeyQ')
    ) {
      x = -1;
    } else if (this.inputController.isKeyPressed('ArrowRight') || this.inputController.isKeyPressed('KeyD')) {
      x = 1;
    }

    // Forward/Backward Movement
    if (
      this.inputController.isKeyPressed('ArrowUp') ||
      this.inputController.isKeyPressed('KeyW') ||
      this.inputController.isKeyPressed('KeyZ')
    ) {
      z = -1;
    } else if (this.inputController.isKeyPressed('ArrowDown') || this.inputController.isKeyPressed('KeyS')) {
      z = 1;
    }

    // Get current velocity to preserve Y component
    const currentVel = this.rigidBody.linvel();

    // Calculate desired velocity
    const desiredVelX = x * movementSpeed;
    const desiredVelZ = z * movementSpeed;

    // Apply velocity
    const forceVector = new RAPIER.Vector3(desiredVelX, currentVel.y, desiredVelZ);
    this.rigidBody.setLinvel(forceVector, true);
  }

  /**
   * Update rotation to face movement direction
   * Same logic as Player.updateRotation()
   */
  private updateRotation(): void {
    if (!this.mesh || !this.rigidBody) return;

    const velocity = this.rigidBody.linvel();
    const vx = velocity.x;
    const vz = velocity.z;

    // Update target rotation when moving
    const isMoving = Math.abs(vx) > 0.01 || Math.abs(vz) > 0.01;

    if (isMoving) {
      // Calculate angle from velocity (adjusted for cow model orientation)
      // The cow model faces forward along -Z axis by default, so we need different calculation
      this.targetRotationY = Math.atan2(vx, vz);
    }

    // Smooth interpolation with angle wrapping
    let angleDiff = this.targetRotationY - this.currentRotationY;

    // Normalize to [-PI, PI] for shortest rotation path
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    this.currentRotationY += angleDiff * 0.15;

    this.mesh.rotation.y = this.currentRotationY;
  }

  /**
   * Synchronize mesh position with physics body
   * Same logic as Player.syncMeshWithPhysics()
   */
  private syncMeshWithPhysics(): void {
    if (!this.mesh || !this.rigidBody) return;

    const position = this.rigidBody.translation();
    // Offset by half the height so the model sits on the ground
    this.mesh.position.set(position.x, position.y - this.properties.height / 2, position.z);
  }

  /**
   * Update the cow controller
   * Called every frame from test mode animation loop
   */
  public update(): void {
    this.updateMovement();
    this.updateRotation();
    this.syncMeshWithPhysics();
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    // Cleanup input controller
    this.inputController.cleanup();

    // Remove mesh from scene
    if (this.mesh) {
      this.scene.remove(this.mesh);

      // Dispose geometry and material
      if (this.mesh instanceof Mesh) {
        this.mesh.geometry.dispose();
        if (this.mesh.material instanceof MeshStandardMaterial) {
          this.mesh.material.dispose();
        }
      }

      this.mesh = null;
    }

    // Remove rigid body from physics world
    if (this.rigidBody && this.physicsManager.getWorld()) {
      this.physicsManager.getWorld().removeRigidBody(this.rigidBody);
      this.rigidBody = null;
    }
  }
}
