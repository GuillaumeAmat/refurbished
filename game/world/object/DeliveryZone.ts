import { Box3, Group, Vector3 } from 'three';

import { TILE_SIZE } from '../../constants';
import { Physics } from '../../util/Physics';
import { Resources } from '../../util/Resources';
import { LevelObject } from './LevelObject';

export interface DeliveryZoneParams {
  xIndex: number;
  zIndex: number;
  zIndex2: number;
  levelWidth: number;
  levelDepth: number;
}

export class DeliveryZone extends LevelObject {
  #params: DeliveryZoneParams;

  constructor(params: DeliveryZoneParams) {
    super();
    this.#params = params;
  }

  create(group: Group): void {
    const { xIndex, zIndex, levelWidth, levelDepth } = this.#params;

    const model = Resources.getInstance().getGLTFAsset('deliveryZoneModel');
    if (!model) {
      console.error('DeliveryZone model not loaded');
      return;
    }

    const mesh = model.scene.clone();
    mesh.position.x = xIndex * TILE_SIZE;
    mesh.position.y = 0;
    mesh.position.z = zIndex * TILE_SIZE;

    this.applyEdgeRotation(mesh, xIndex, zIndex, TILE_SIZE, levelWidth, levelDepth);
    this.cloneMaterials(mesh);
    this.setupShadows(mesh);

    this.mesh = mesh;
    group.add(mesh);

    // Single collider spanning both tiles
    const physics = Physics.getInstance();
    const position = new Vector3(xIndex * TILE_SIZE + 1, 0.5, zIndex * TILE_SIZE + TILE_SIZE);
    this.rigidBody = physics.createStaticRigidBody(position);
    const halfExtents = new Vector3(1, 0.5, 2);
    physics.createBoxCollider(this.rigidBody, halfExtents, 0.0);

    this.isInteractable = true;
  }

  public override getClosestPoint(from: Vector3): Vector3 | null {
    if (!this.mesh) return null;
    const box = new Box3().setFromObject(this.mesh);
    return new Vector3(
      Math.max(box.min.x, Math.min(from.x, box.max.x)),
      from.y,
      Math.max(box.min.z, Math.min(from.z, box.max.z)),
    );
  }
}
