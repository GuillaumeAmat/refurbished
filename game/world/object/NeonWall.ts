import type { MeshStandardMaterial } from 'three';
import { Box3, Group, Mesh, Vector3 } from 'three';

import { TILE_SIZE } from '../../constants';
import { Debug } from '../../util/Debug';
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
        mesh.position.z = levelDepth * TILE_SIZE + wallSize.z + 0.5;
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
    this.setupNeonMaterials(mesh);

    // Boost blue neon emissive intensity and add debug slider
    if (variant === 'blue') {
      const neonMaterials: MeshStandardMaterial[] = [];
      mesh.traverse((child) => {
        if (child instanceof Mesh && child.name.toLowerCase().includes('neon')) {
          const mat = child.material as MeshStandardMaterial;
          child.material = mat.clone();
          neonMaterials.push(child.material as MeshStandardMaterial);
        }
      });

      const debug = Debug.getInstance();
      const firstMat = neonMaterials[0];
      if (debug.active && firstMat) {
        const params = { blueNeonIntensity: firstMat.emissiveIntensity };
        debug.gui
          .add(params, 'blueNeonIntensity', 0, 10, 0.1)
          .name('Blue Neon Intensity')
          .onChange((value: number) => {
            neonMaterials.forEach((mat) => {
              mat.emissiveIntensity = value;
            });
          });
      }
    }

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
