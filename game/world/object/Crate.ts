import type { Group } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

import type { Cell } from '../../levels';
import { LevelObject } from './LevelObject';

export type CrateType = typeof Cell.CRATE_BATTERY | typeof Cell.CRATE_FRAME | typeof Cell.CRATE_SCREEN;

export interface CrateParams {
  model: GLTF;
  type: CrateType;
  xIndex: number;
  zIndex: number;
  tileSize: number;
  levelWidth: number;
  levelDepth: number;
}

export class Crate extends LevelObject {
  #params: CrateParams;
  type: CrateType;

  constructor(params: CrateParams) {
    super();
    this.#params = params;
    this.type = params.type;
  }

  create(group: Group): void {
    const { model, xIndex, zIndex, tileSize, levelWidth, levelDepth } = this.#params;

    const mesh = model.scene.clone();
    mesh.position.x = xIndex * tileSize;
    mesh.position.y = 0;
    mesh.position.z = zIndex * tileSize;

    this.applyEdgeRotation(mesh, xIndex, zIndex, tileSize, levelWidth, levelDepth);
    this.setupShadows(mesh);

    this.mesh = mesh;
    group.add(mesh);

    this.createPhysics(xIndex, zIndex, tileSize);
  }
}
