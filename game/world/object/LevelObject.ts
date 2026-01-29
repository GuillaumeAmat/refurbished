import type RAPIER from '@dimforge/rapier3d-compat';
import { Box3, Color, type Group, Mesh, MeshStandardMaterial, type Object3D, Vector3 } from 'three';

import { HIGHLIGHT_EMISSIVE } from '../../constants';
import { Physics } from '../../util/Physics';

export abstract class LevelObject {
  protected mesh: Object3D | null = null;
  protected rigidBody: RAPIER.RigidBody | null = null;

  public isInteractable = false;
  #isHighlighted = false;
  #originalEmissive: Map<Mesh, Color> = new Map();

  abstract create(group: Group): void;

  public getPosition(): Vector3 | null {
    if (!this.mesh) return null;
    const box = new Box3().setFromObject(this.mesh);
    const center = new Vector3();
    box.getCenter(center);
    return center;
  }

  /**
   * Returns the closest point on this object to the given position (XZ plane).
   * Defaults to getPosition(). Override for multi-tile objects.
   */
  public getClosestPoint(from: Vector3): Vector3 | null {
    return this.getPosition();
  }

  public get isHighlighted(): boolean {
    return this.#isHighlighted;
  }

  public setHighlight(enabled: boolean): void {
    if (!this.mesh || this.#isHighlighted === enabled) return;
    this.#isHighlighted = enabled;

    this.mesh.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      if (!(child.material instanceof MeshStandardMaterial)) return;

      if (enabled) {
        if (!this.#originalEmissive.has(child)) {
          this.#originalEmissive.set(child, child.material.emissive.clone());
        }
        child.material.emissive.setHex(HIGHLIGHT_EMISSIVE);
      } else {
        const original = this.#originalEmissive.get(child);
        if (original) {
          child.material.emissive.copy(original);
        }
      }
    });
  }

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

  protected cloneMaterials(mesh: Group): void {
    mesh.traverse((child) => {
      if (child instanceof Mesh && child.material instanceof MeshStandardMaterial) {
        child.material = child.material.clone();
      }
    });
  }
}
