import type { Group } from 'three';
import { PointLight } from 'three';

import { LIGHT_COLOR, TILE_SIZE } from '../../constants';
import { LevelObject } from './LevelObject';
import type { WallSide } from './Wall';

export interface WallLightParams {
  wallIndex: number;
  side: WallSide;
  levelWidth: number;
  levelDepth: number;
}

export class WallLight extends LevelObject {
  static #lights: PointLight[] = [];
  static get lights(): PointLight[] {
    return WallLight.#lights;
  }

  #params: WallLightParams;
  #ownLight: PointLight | null = null;

  constructor(params: WallLightParams) {
    super();
    this.#params = params;
  }

  create(group: Group): void {
    const { wallIndex, side, levelWidth, levelDepth } = this.#params;

    const TS = TILE_SIZE;

    let x = 0;
    let z = 0;

    if (side === 'top') {
      x = wallIndex * TS + TS / 2;
      z = 0.6;
    } else if (side === 'left') {
      x = 0.6;
      z = wallIndex * TS + TS / 2;
    } else if (side === 'right') {
      x = levelWidth * TS - 0.6;
      z = wallIndex * TS + TS / 2;
    } else {
      // bottom
      x = wallIndex * TS + TS / 2;
      z = levelDepth * TS - 0.6;
    }

    const light = new PointLight(LIGHT_COLOR, 2, 1, 0.5);
    light.position.set(x, 2.7, z);
    group.add(light);
    WallLight.#lights.push(light);
    this.#ownLight = light;
  }

  public override dispose(): void {
    if (this.#ownLight) {
      this.#ownLight.removeFromParent();
      const idx = WallLight.#lights.indexOf(this.#ownLight);
      if (idx !== -1) WallLight.#lights.splice(idx, 1);
      this.#ownLight = null;
    }
    super.dispose();
  }
}
