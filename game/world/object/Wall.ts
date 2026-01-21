import type { Group } from 'three';

import { TILE_SIZE } from '../../constants';
import { Resources } from '../../util/Resources';
import { LevelObject } from './LevelObject';

export type WallSide = 'top' | 'bottom' | 'left' | 'right';

export interface WallParams {
  index: number;
  side: WallSide;
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
    const { index, side, levelWidth, levelDepth } = this.#params;

    const model = Resources.getInstance().getGLTFAsset('wallModel');
    if (!model) {
      console.error('Wall model not loaded');
      return;
    }

    const mesh = model.scene.clone();

    switch (side) {
      case 'top':
        mesh.position.x = (index + 1) * TILE_SIZE;
        mesh.position.y = 0;
        mesh.position.z = 0;
        mesh.rotation.y = 0;
        break;
      case 'bottom':
        mesh.position.x = index * TILE_SIZE;
        mesh.position.y = 0;
        mesh.position.z = levelDepth * TILE_SIZE;
        mesh.rotation.y = Math.PI;
        break;
      case 'left':
        mesh.position.x = 0;
        mesh.position.y = 0;
        mesh.position.z = index * TILE_SIZE;
        mesh.rotation.y = Math.PI / 2;
        break;
      case 'right':
        mesh.position.x = levelWidth * TILE_SIZE;
        mesh.position.y = 0;
        mesh.position.z = (index + 1) * TILE_SIZE;
        mesh.rotation.y = -Math.PI / 2;
        break;
    }

    this.setupShadows(mesh);

    this.mesh = mesh;
    group.add(mesh);
  }
}
