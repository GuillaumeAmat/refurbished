import type { Group } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { LevelObject } from './LevelObject';

export type WallSide = 'top' | 'bottom' | 'left' | 'right';

export interface WallParams {
  model: GLTF;
  index: number;
  side: WallSide;
  tileSize: number;
  levelWidth: number;
  levelDepth: number;
}

export class Wall extends LevelObject {
  #params: WallParams;

  constructor(params: WallParams) {
    super();
    this.#params = params;
  }

  create(group: Group): void {
    const { model, index, side, tileSize, levelWidth, levelDepth } = this.#params;

    const mesh = model.scene.clone();

    switch (side) {
      case 'top':
        mesh.position.x = (index + 1) * tileSize;
        mesh.position.y = 0;
        mesh.position.z = 0;
        mesh.rotation.y = 0;
        break;
      case 'bottom':
        mesh.position.x = index * tileSize;
        mesh.position.y = 0;
        mesh.position.z = levelDepth * tileSize;
        mesh.rotation.y = Math.PI;
        break;
      case 'left':
        mesh.position.x = 0;
        mesh.position.y = 0;
        mesh.position.z = index * tileSize;
        mesh.rotation.y = Math.PI / 2;
        break;
      case 'right':
        mesh.position.x = levelWidth * tileSize;
        mesh.position.y = 0;
        mesh.position.z = (index + 1) * tileSize;
        mesh.rotation.y = -Math.PI / 2;
        break;
    }

    this.setupShadows(mesh);

    this.mesh = mesh;
    group.add(mesh);
  }
}
