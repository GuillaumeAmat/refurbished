import { type Group, LinearMipmapNearestFilter, type SpotLightHelper } from 'three';
import { Box3, Mesh, MeshStandardMaterial, PlaneGeometry, SpotLight, SRGBColorSpace, Vector3 } from 'three';

import { LIGHT_COLOR, TILE_SIZE } from '../../constants';
import { Resources } from '../../util/Resources';
import { LevelObject } from './LevelObject';

const POSTER_ASPECT_RATIO = 6680 / 9449; // width / height

export interface PosterParams {
  textureKey: string;
  wallIndex: number;
}

export class Poster extends LevelObject {
  static #lights: SpotLight[] = [];
  static get lights(): SpotLight[] {
    return Poster.#lights;
  }

  static #helpers: SpotLightHelper[] = [];
  static get helpers(): SpotLightHelper[] {
    return Poster.#helpers;
  }

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
    // Avoid trilinear mipmap blending, which blurs at mid-range distances
    texture.minFilter = LinearMipmapNearestFilter;

    const geometry = new PlaneGeometry(posterWidth, posterHeight);
    const material = new MeshStandardMaterial({
      map: texture,
    });

    const mesh = new Mesh(geometry, material);
    mesh.position.x = wallIndex * TILE_SIZE + TILE_SIZE / 2;
    mesh.position.y = wallHeight + wallHeight * 0.75 - 0.55;
    mesh.position.z = 0.01;

    this.mesh = mesh;
    group.add(mesh);

    const posterTop = mesh.position.y + posterHeight / 2;

    const upLight = new SpotLight(LIGHT_COLOR, 10, 6, Math.PI / 5, 0.2, 0.3);
    upLight.position.set(mesh.position.x, 1.9, 0.2);
    upLight.target.position.set(mesh.position.x, posterTop, 0);
    group.add(upLight);
    group.add(upLight.target);
    Poster.#lights.push(upLight);

    const downLight = new SpotLight(LIGHT_COLOR, 10, 1.7, Math.PI / 6, 0.4, 0.4);
    downLight.position.set(mesh.position.x, 2.5, 0.2);
    downLight.target.position.set(mesh.position.x, 0, 0);
    group.add(downLight);
    group.add(downLight.target);
    Poster.#lights.push(downLight);
  }
}
