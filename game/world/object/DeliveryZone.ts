import type { Group } from 'three';
import { Vector3 } from 'three';

import { TILE_SIZE } from '../../constants';
import type { ResourceType } from '../../types';
import { Physics } from '../../util/Physics';
import { Resources } from '../../util/Resources';
import { LevelObject } from './LevelObject';

export interface DeliveryZoneParams {
  xIndex: number;
  zIndex: number;
  xIndex2: number;
  zIndex2: number;
  levelWidth: number;
  levelDepth: number;
}

type Edge = 'top' | 'bottom' | 'left' | 'right';

export class DeliveryZone extends LevelObject {
  #params: DeliveryZoneParams;

  constructor(params: DeliveryZoneParams) {
    super();
    this.#params = params;
  }

  public canAcceptDelivery(resourceType: ResourceType): boolean {
    return resourceType === 'phone';
  }

  create(group: Group): void {
    const { xIndex, zIndex, xIndex2, zIndex2, levelWidth, levelDepth } = this.#params;

    const model = Resources.getInstance().getGLTFAsset('deliveryZoneModel');
    if (!model) {
      console.error('DeliveryZone model not loaded');
      return;
    }

    const mesh = model.scene.clone();

    // Detect which edge
    const edge = this.#detectEdge(xIndex, zIndex, levelWidth, levelDepth);

    // Apply edge-specific position and rotation
    this.#applyEdgeTransform(mesh, xIndex, zIndex, edge);

    this.cloneMaterials(mesh);
    this.setupShadows(mesh);

    this.mesh = mesh;
    group.add(mesh);

    // Create physics collider based on edge orientation
    this.#createEdgePhysics(xIndex, zIndex, xIndex2, zIndex2, edge);

    this.isInteractable = true;
  }

  #detectEdge(xIndex: number, zIndex: number, levelWidth: number, levelDepth: number): Edge {
    if (zIndex === 0) return 'top';
    if (zIndex === levelDepth - 1) return 'bottom';
    if (xIndex === 0) return 'left';
    if (xIndex === levelWidth - 1) return 'right';
    return 'top'; // fallback
  }

  #applyEdgeTransform(mesh: Group, xIndex: number, zIndex: number, edge: Edge): void {
    // Base position
    mesh.position.x = xIndex * TILE_SIZE;
    mesh.position.y = 0;
    mesh.position.z = zIndex * TILE_SIZE;

    // Edge-specific rotation and offset (model origin at corner)
    switch (edge) {
      case 'top':
        // No rotation, no offset
        break;
      case 'bottom':
        mesh.rotation.y = Math.PI; // 180°
        mesh.position.x += 2 * TILE_SIZE;
        mesh.position.z += TILE_SIZE;
        break;
      case 'left':
        mesh.rotation.y = Math.PI / 2; // 90°
        mesh.position.z += 2 * TILE_SIZE;
        break;
      case 'right':
        mesh.rotation.y = -Math.PI / 2; // -90°
        mesh.position.x += TILE_SIZE;
        break;
    }
  }

  #createEdgePhysics(
    xIndex: number,
    zIndex: number,
    xIndex2: number,
    zIndex2: number,
    edge: Edge,
  ): void {
    const physics = Physics.getInstance();

    let position: Vector3;
    let halfExtents: Vector3;

    if (edge === 'top' || edge === 'bottom') {
      // Horizontal edge: spans 2 tiles in X
      const centerX = ((xIndex + xIndex2) / 2 + 0.5) * TILE_SIZE;
      const centerZ = (zIndex + 0.5) * TILE_SIZE;
      position = new Vector3(centerX, 0.5, centerZ);
      halfExtents = new Vector3(TILE_SIZE, 0.5, TILE_SIZE / 2);
    } else {
      // Vertical edge: spans 2 tiles in Z
      const centerX = (xIndex + 0.5) * TILE_SIZE;
      const centerZ = ((zIndex + zIndex2) / 2 + 0.5) * TILE_SIZE;
      position = new Vector3(centerX, 0.5, centerZ);
      halfExtents = new Vector3(TILE_SIZE / 2, 0.5, TILE_SIZE);
    }

    this.rigidBody = physics.createStaticRigidBody(position);
    physics.createBoxCollider(this.rigidBody, halfExtents, 0.0);
  }
}
