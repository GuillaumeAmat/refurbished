import type { Group } from 'three';
import { Box3, SpotLight, Vector3 } from 'three';

import { LIGHT_COLOR, TILE_SIZE } from '../../constants';
import { Resources } from '../../util/Resources';
import { LevelObject } from './LevelObject';
import type { WallSide } from './Wall';

export interface WallLightParams {
  wallIndex: number;
  side: WallSide;
  levelWidth: number;
  levelDepth: number;
}

export class WallLight extends LevelObject {
  static #lights: SpotLight[] = [];
  static get lights(): SpotLight[] {
    return WallLight.#lights;
  }

  #params: WallLightParams;
  #ownLights: SpotLight[] = [];

  constructor(params: WallLightParams) {
    super();
    this.#params = params;
  }

  create(group: Group): void {
    const { wallIndex, side, levelWidth, levelDepth } = this.#params;

    const wallModel = Resources.getInstance().getGLTFAsset('wallModel');
    if (!wallModel) return;

    const wallBox = new Box3().setFromObject(wallModel.scene);
    const wallSize = wallBox.getSize(new Vector3());
    const wallHeight = wallSize.y;

    const posterHeight = wallHeight * 0.9;
    const posterTop = wallHeight + wallHeight * 0.75 - 0.67 + posterHeight / 2;

    const TS = TILE_SIZE;

    let lightOffsetX = 0;
    let lightOffsetZ = 0;
    let lightTargetX = 0;
    let lightTargetZ = 0;
    let downLightTargetX = 0;
    let downLightTargetZ = 0;

    if (side === 'top') {
      const baseX = wallIndex * TS + TS / 2;
      lightOffsetX = baseX; lightOffsetZ = 1.2;
      lightTargetX = baseX; lightTargetZ = 0;
      downLightTargetX = baseX; downLightTargetZ = -0.5;
    } else if (side === 'left') {
      const baseZ = wallIndex * TS + TS / 2;
      lightOffsetX = 1.2; lightOffsetZ = baseZ;
      lightTargetX = 0; lightTargetZ = baseZ;
      downLightTargetX = -0.5; downLightTargetZ = baseZ;
    } else if (side === 'right') {
      const baseZ = wallIndex * TS + TS / 2;
      lightOffsetX = levelWidth * TS - 1.2; lightOffsetZ = baseZ;
      lightTargetX = levelWidth * TS; lightTargetZ = baseZ;
      downLightTargetX = levelWidth * TS + 0.5; downLightTargetZ = baseZ;
    } else {
      // bottom
      const baseX = wallIndex * TS + TS / 2;
      lightOffsetX = baseX; lightOffsetZ = levelDepth * TS - 1.2;
      lightTargetX = baseX; lightTargetZ = levelDepth * TS;
      downLightTargetX = baseX; downLightTargetZ = levelDepth * TS + 0.5;
    }

    // Up light — illuminates wall upward
    const upLight = new SpotLight(LIGHT_COLOR, 10, 5.5, Math.PI / 12, 0.2, 0.4);
    upLight.position.set(lightOffsetX, 0.3, lightOffsetZ);
    upLight.target.position.set(lightTargetX, posterTop, lightTargetZ);
    group.add(upLight);
    group.add(upLight.target);
    WallLight.#lights.push(upLight);
    this.#ownLights.push(upLight);

    // Down light — illuminates floor below
    const downLight = new SpotLight(LIGHT_COLOR, 10, 4, Math.PI / 12, 0.4, 0.4);
    downLight.position.set(lightOffsetX, 4.5, lightOffsetZ);
    downLight.target.position.set(downLightTargetX, 0, downLightTargetZ);
    group.add(downLight);
    group.add(downLight.target);
    WallLight.#lights.push(downLight);
    this.#ownLights.push(downLight);
  }

  public override dispose(): void {
    for (const light of this.#ownLights) {
      light.target.removeFromParent();
      light.removeFromParent();
      const idx = WallLight.#lights.indexOf(light);
      if (idx !== -1) WallLight.#lights.splice(idx, 1);
    }
    this.#ownLights.length = 0;
    super.dispose();
  }
}
