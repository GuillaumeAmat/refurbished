import type { Group } from 'three';
import { Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';

import type { LevelInfo } from '../../levels';
import { createGridTexture } from '../../lib/createGridTexture';
import { LevelObject } from './LevelObject';

export class OuterFloor extends LevelObject {
  #levelInfo: LevelInfo;

  constructor(levelInfo: LevelInfo) {
    super();
    this.#levelInfo = levelInfo;
  }

  create(group: Group): void {
    const { width, tileSize } = this.#levelInfo;
    const matrixWidth = width / tileSize;

    const geometry = new PlaneGeometry(100, 100, 1, 1);

    const gridInterval = 5;
    const textureSize = 320;
    const gridSpacing = 64;
    const gridTexture = createGridTexture({
      backgroundColor: '#041428',
      gridColor: '#FFFFFF',
      gridSpacing,
      lineWidth: 1,
      textureSize,
      minorLineOpacity: 0.1,
      majorLineOpacity: 0.8,
      majorLineInterval: gridInterval,
    });

    gridTexture.repeat.set(matrixWidth, matrixWidth);

    const material = new MeshStandardMaterial({
      map: gridTexture,
      color: '#FFFFFF',
      metalness: 0.1,
      roughness: 0.5,
    });

    const mesh = new Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.rotation.x = Math.PI * -0.5;
    mesh.position.set(0, -0.1, 0);

    this.mesh = mesh;
    group.add(mesh);
  }
}
