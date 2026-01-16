import type RAPIER from '@dimforge/rapier3d-compat';
import { type Group, Mesh, type Object3D, Vector3 } from 'three';

import { Physics } from '../../util/Physics';

export abstract class LevelObject {
  protected mesh: Object3D | null = null;
  protected rigidBody: RAPIER.RigidBody | null = null;

  abstract create(group: Group): void;

  public dispose(): void {
    if (this.mesh) {
      this.mesh.removeFromParent();
      this.mesh = null;
    }
  }

  public getMesh(): Object3D | null {
    return this.mesh;
  }

  public getRigidBody(): RAPIER.RigidBody | null {
    return this.rigidBody;
  }

  protected createPhysics(xIndex: number, zIndex: number, tileSize: number): void {
    const physics = Physics.getInstance();
    const position = new Vector3(xIndex * tileSize + 1, 0.5, zIndex * tileSize + 1);
    this.rigidBody = physics.createStaticRigidBody(position);

    const halfExtents = new Vector3(1, 0.5, 1);
    physics.createBoxCollider(this.rigidBody, halfExtents, 0.0);
  }

  protected applyEdgeRotation(
    mesh: Group,
    xIndex: number,
    zIndex: number,
    tileSize: number,
    levelWidth: number,
    levelDepth: number,
  ): void {
    const isBottomEdge = zIndex === levelDepth - 1;
    const isLeftEdge = xIndex === 0;
    const isRightEdge = xIndex === levelWidth - 1;

    if (isBottomEdge) {
      mesh.rotation.y = Math.PI;
      mesh.position.x += tileSize;
      mesh.position.z += tileSize;
    } else if (isLeftEdge) {
      mesh.rotation.y = Math.PI / 2;
      mesh.position.z += tileSize;
    } else if (isRightEdge) {
      mesh.rotation.y = -Math.PI / 2;
      mesh.position.x += tileSize;
    }
  }

  protected setupShadows(mesh: Group): void {
    mesh.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }
}
