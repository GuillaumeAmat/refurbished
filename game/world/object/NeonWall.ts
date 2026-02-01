import { Box3, Group, Vector3 } from 'three';

import { TILE_SIZE } from '../../constants';
import { Resources } from '../../util/Resources';
import { LevelObject } from './LevelObject';

export type NeonWallSide = 'top' | 'bottom' | 'left' | 'right';
export type NeonWallVariant = 'default' | 'blue';

export interface NeonWallParams {
  index: number;
  side: NeonWallSide;
  levelWidth: number;
  levelDepth: number;
  variant?: NeonWallVariant;
}

export class NeonWall extends LevelObject {
  #params: NeonWallParams;

  constructor(params: NeonWallParams) {
    super();
    this.#params = params;
  }

  create(group: Group): void {
    const { index, side, levelWidth, levelDepth, variant = 'default' } = this.#params;

    const modelName = variant === 'blue' ? 'neonWallBlueModel' : 'neonWallModel';
    const model = Resources.getInstance().getGLTFAsset(modelName);
    if (!model) {
      console.error(`Neon wall model (${modelName}) not loaded`);
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
        mesh.position.x = (index + 2) * TILE_SIZE;
        mesh.position.y = 0;
        mesh.position.z = levelDepth * TILE_SIZE + wallSize.z;
        mesh.rotation.y = Math.PI;
        break;
      case 'left':
        mesh.position.x = -wallSize.z;
        mesh.position.y = 0;
        mesh.position.z = (index + 2) * TILE_SIZE;
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

    const container = new Group();
    container.add(mesh);

    const wallTopModel = Resources.getInstance().getGLTFAsset('wallTopRegularModel');

    if (wallTopModel) {
      for (let i = 0; i < 2; i++) {
        const wallTop = wallTopModel.scene.clone();

        const offset = new Vector3(TILE_SIZE / 2 + i * TILE_SIZE, 0, wallSize.z / 2);
        offset.applyEuler(mesh.rotation);

        wallTop.position.copy(mesh.position);
        wallTop.position.x += offset.x;
        wallTop.position.y = wallSize.y;
        wallTop.position.z += offset.z;
        wallTop.rotation.copy(mesh.rotation);

        this.setupShadows(wallTop);
        container.add(wallTop);
      }
    }

    this.mesh = container;
    group.add(container);
  }
}
