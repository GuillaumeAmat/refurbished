import type { Group } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { LevelObject } from './LevelObject';

export interface WorkbenchParams {
  model: GLTF;
  xIndex: number;
  zIndex: number;
  tileSize: number;
  levelWidth: number;
  levelDepth: number;
}

export class Workbench extends LevelObject {
  #params: WorkbenchParams;

  constructor(params: WorkbenchParams) {
    super();
    this.#params = params;
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
