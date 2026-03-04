import { type Group, LinearFilter, type SpotLightHelper } from 'three';
import { Box3, Mesh, MeshStandardMaterial, PlaneGeometry, SpotLight, SRGBColorSpace, Vector3 } from 'three';

import { LIGHT_COLOR, TILE_SIZE } from '../../constants';
import { Resources } from '../../util/Resources';
import { LevelObject } from './LevelObject';
import type { WallSide } from './Wall';

const POSTER_ASPECT_RATIO = 6680 / 9449; // width / height

export interface PosterParams {
  textureKey: string;
  wallIndex: number;
  side: WallSide;
  levelWidth: number;
  levelDepth: number;
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
    const { textureKey, wallIndex, side, levelWidth, levelDepth } = this.#params;

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
    texture.minFilter = LinearFilter;
    // texture.generateMipmaps = false;
    // texture.anisotropy = 4;

    const geometry = new PlaneGeometry(posterWidth, posterHeight);
    const material = new MeshStandardMaterial({
      map: texture,
      roughness: 0.4,
    });

    const TS = TILE_SIZE;
    const mesh = new Mesh(geometry, material);
    mesh.position.y = wallHeight + wallHeight * 0.75 - 0.67;

    let lightOffsetX = 0;
    let lightOffsetZ = 0;
    let lightTargetX = 0;
    let lightTargetZ = 0;
    let downLightTargetX = 0;
    let downLightTargetZ = 0;

    if (side === 'top') {
      mesh.position.x = wallIndex * TS + TS / 2;
      mesh.position.z = 0.01;
      mesh.rotation.y = 0;
      lightOffsetX = mesh.position.x;
      lightOffsetZ = 1.2;
      lightTargetX = mesh.position.x;
      lightTargetZ = 0;
      downLightTargetX = mesh.position.x;
      downLightTargetZ = -0.5;
    } else if (side === 'left') {
      mesh.position.x = 0.01;
      mesh.position.z = wallIndex * TS + TS / 2;
      mesh.rotation.y = Math.PI / 2;
      lightOffsetX = 1.2;
      lightOffsetZ = mesh.position.z;
      lightTargetX = 0;
      lightTargetZ = mesh.position.z;
      downLightTargetX = -0.5;
      downLightTargetZ = mesh.position.z;
    } else if (side === 'right') {
      mesh.position.x = levelWidth * TS - 0.01;
      mesh.position.z = wallIndex * TS + TS / 2;
      mesh.rotation.y = -Math.PI / 2;
      lightOffsetX = levelWidth * TS - 1.2;
      lightOffsetZ = mesh.position.z;
      lightTargetX = levelWidth * TS;
      lightTargetZ = mesh.position.z;
      downLightTargetX = levelWidth * TS + 0.5;
      downLightTargetZ = mesh.position.z;
    } else {
      // bottom
      mesh.position.x = wallIndex * TS + TS / 2;
      mesh.position.z = levelDepth * TS - 0.01;
      mesh.rotation.y = Math.PI;
      lightOffsetX = mesh.position.x;
      lightOffsetZ = levelDepth * TS - 1.2;
      lightTargetX = mesh.position.x;
      lightTargetZ = levelDepth * TS;
      downLightTargetX = mesh.position.x;
      downLightTargetZ = levelDepth * TS + 0.5;
    }

    this.mesh = mesh;
    group.add(mesh);

    const posterTop = mesh.position.y + posterHeight / 2;

    const upLight = new SpotLight(LIGHT_COLOR, 10, 5.5, Math.PI / 12, 0.2, 0.4);
    upLight.position.set(lightOffsetX, 0.3, lightOffsetZ);
    upLight.target.position.set(lightTargetX, posterTop, lightTargetZ);
    group.add(upLight);
    group.add(upLight.target);
    Poster.#lights.push(upLight);

    const downLight = new SpotLight(LIGHT_COLOR, 10, 4, Math.PI / 12, 0.4, 0.4);
    downLight.position.set(lightOffsetX, 4.5, lightOffsetZ);
    downLight.target.position.set(downLightTargetX, 0, downLightTargetZ);
    group.add(downLight);
    group.add(downLight.target);
    Poster.#lights.push(downLight);
  }
}
