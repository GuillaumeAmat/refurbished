import type { Group } from 'three';

import { TILE_SIZE } from '../../constants';
import { Resources } from '../../util/Resources';
import { LevelObject } from './LevelObject';

export interface BlueWorkZoneParams {
  xIndex: number;
  zIndex: number;
  levelWidth: number;
  levelDepth: number;
}

export class BlueWorkZone extends LevelObject {
  #params: BlueWorkZoneParams;

  constructor(params: BlueWorkZoneParams) {
    super();
    this.#params = params;
  }

  create(group: Group): void {
    const { xIndex, zIndex, levelWidth, levelDepth } = this.#params;

    const model = Resources.getInstance().getGLTFAsset('blueWorkZoneModel');
    if (!model) {
      console.error('BlueWorkZone model not loaded');
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
