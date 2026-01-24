import type { Group } from 'three';

import { TILE_SIZE } from '../../constants';
import { Resources } from '../../util/Resources';
import { LevelObject } from './LevelObject';

export interface RepairZoneParams {
  xIndex: number;
  zIndex: number;
  levelWidth: number;
  levelDepth: number;
}

export class RepairZone extends LevelObject {
  #params: RepairZoneParams;

  constructor(params: RepairZoneParams) {
    super();
    this.#params = params;
  }

  create(group: Group): void {
    const { xIndex, zIndex, levelWidth, levelDepth } = this.#params;

    const model = Resources.getInstance().getGLTFAsset('repairZoneModel');
    if (!model) {
      console.error('RepairZone model not loaded');
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

    this.createPhysics(xIndex, zIndex, TILE_SIZE);
    this.isInteractable = true;
  }
}
