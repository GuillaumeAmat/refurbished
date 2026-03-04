import { Box3, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, Vector3 } from 'three';

import { TILE_SIZE } from '../../constants';
import { Resources } from '../../util/Resources';
import { LevelObject } from './LevelObject';

const POSTER_ASPECT_RATIO = 6680 / 9449; // width / height

export interface PosterParams {
  textureKey: string;
  wallIndex: number;
}

export class Poster extends LevelObject {
  #params: PosterParams;

  constructor(params: PosterParams) {
    super();
    this.#params = params;
  }

  create(group: Group): void {
    const { textureKey, wallIndex } = this.#params;

    const wallModel = Resources.getInstance().getGLTFAsset('wallModel');
    if (!wallModel) return;

    const wallBox = new Box3().setFromObject(wallModel.scene);
    const wallSize = wallBox.getSize(new Vector3());
    const wallHeight = wallSize.y;

    const posterHeight = wallHeight * 0.9;
    const posterWidth = posterHeight * POSTER_ASPECT_RATIO;

    const texture = Resources.getInstance().getTextureAsset(textureKey);
    if (!texture) return;

    texture.colorSpace = SRGBColorSpace;

    const geometry = new PlaneGeometry(posterWidth, posterHeight);
    const material = new MeshStandardMaterial({
      map: texture,
      roughness: 0.8,
      metalness: 0,
    });

    const mesh = new Mesh(geometry, material);
    mesh.position.x = wallIndex * TILE_SIZE + TILE_SIZE / 2;
    mesh.position.y = wallHeight + wallHeight * 0.75 - 0.55;
    mesh.position.z = 0.01;

    this.mesh = mesh;
    group.add(mesh);
  }
}
