import { Box3, Group, Vector3 } from 'three';

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

    const wallBox = new Box3().setFromObject(model.scene);
    const wallSize = wallBox.getSize(new Vector3());

    const mesh = model.scene.clone();

    switch (side) {
      case 'top':
        mesh.position.x = index * TILE_SIZE;
        mesh.position.y = 0;
        mesh.position.z = -wallSize.z;
        mesh.rotation.y = 0;
        break;
      case 'bottom':
        mesh.position.x = (index + 1) * TILE_SIZE;
        mesh.position.y = 0;
        mesh.position.z = levelDepth * TILE_SIZE + wallSize.z;
        mesh.rotation.y = Math.PI;
        break;
      case 'left':
        mesh.position.x = -wallSize.z;
        mesh.position.y = 0;
        mesh.position.z = (index + 1) * TILE_SIZE;
        mesh.rotation.y = Math.PI / 2;
        break;
      case 'right':
        mesh.position.x = levelWidth * TILE_SIZE + wallSize.z;
        mesh.position.y = 0;
        mesh.position.z = index * TILE_SIZE;
        mesh.rotation.y = -Math.PI / 2;
        break;
    }

    this.setupShadows(mesh);

    const wallTopModel = Resources.getInstance().getGLTFAsset('wallTopRegularModel');

    const container = new Group();
    container.add(mesh);

    if (wallTopModel) {
      const wallTop = wallTopModel.scene.clone();

      const offset = new Vector3(wallSize.x / 2, 0, wallSize.z / 2);
      offset.applyEuler(mesh.rotation);

      wallTop.position.copy(mesh.position);
      wallTop.position.x += offset.x;
      wallTop.position.y = wallSize.y;
      wallTop.position.z += offset.z;
      wallTop.rotation.copy(mesh.rotation);

      this.setupShadows(wallTop);
      container.add(wallTop);
    }

    this.mesh = container;
    group.add(container);
  }
}
