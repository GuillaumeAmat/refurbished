import type { Group } from 'three';

import { TILE_SIZE } from '../constants';
import {
  isBlueWorkZone,
  isCrate,
  isRepairZone,
  isWalkable,
  isWorkbench,
  type LevelData,
} from '../levels';
import { Resources } from '../util/Resources';
import { BlueWorkZone } from './object/BlueWorkZone';
import { Crate } from './object/Crate';
import type { LevelObject } from './object/LevelObject';
import { RepairZone } from './object/RepairZone';
import { Wall, type WallSide } from './object/Wall';
import { Workbench } from './object/Workbench';

export class LevelBuilder {
  #data: LevelData;
  #resources: Resources;
  #objects: LevelObject[] = [];

  constructor(data: LevelData) {
    this.#data = data;
    this.#resources = Resources.getInstance();
  }

  buildFromMatrix(group: Group): LevelObject[] {
    this.buildWorkbenches(group);
    this.buildWalls(group);
    return this.#objects;
  }

  private buildWorkbenches(group: Group): void {
    const { matrix } = this.#data;
    const tileSize = TILE_SIZE;

    const workbenchModel = this.#resources.getGLTFAsset('workbenchModel');
    const blueWorkZoneModel = this.#resources.getGLTFAsset('blueWorkZoneModel');
    const repairZoneModel = this.#resources.getGLTFAsset('repairZoneModel');
    const crateModel = this.#resources.getGLTFAsset('crateModel');

    if (!workbenchModel || !blueWorkZoneModel || !repairZoneModel || !crateModel) return;
    if (!Array.isArray(matrix) || !matrix[0]) return;

    const levelWidth = matrix[0].length;
    const levelDepth = matrix.length;

    for (let xIndex = 0; xIndex < levelWidth; xIndex++) {
      for (let zIndex = 0; zIndex < levelDepth; zIndex++) {
        const cellValue = matrix[zIndex]?.[xIndex] ?? '';

        if (isWalkable(cellValue)) continue;

        let obj: LevelObject | null = null;

        if (isWorkbench(cellValue)) {
          obj = new Workbench({
            model: workbenchModel,
            xIndex,
            zIndex,
            tileSize,
            levelWidth,
            levelDepth,
          });
        } else if (isBlueWorkZone(cellValue)) {
          obj = new BlueWorkZone({
            model: blueWorkZoneModel,
            xIndex,
            zIndex,
            tileSize,
            levelWidth,
            levelDepth,
          });
        } else if (isCrate(cellValue)) {
          obj = new Crate({
            model: crateModel,
            type: cellValue,
            xIndex,
            zIndex,
            tileSize,
            levelWidth,
            levelDepth,
          });
        } else if (isRepairZone(cellValue)) {
          obj = new RepairZone({
            model: repairZoneModel,
            xIndex,
            zIndex,
            tileSize,
            levelWidth,
            levelDepth,
          });
        }

        if (obj) {
          obj.create(group);
          this.#objects.push(obj);
        }
      }
    }
  }

  private buildWalls(group: Group): void {
    const { matrix } = this.#data;
    const tileSize = TILE_SIZE;

    const wallModel = this.#resources.getGLTFAsset('wallModel');
    if (!wallModel) return;
    if (!Array.isArray(matrix) || !matrix[0]) return;

    const levelWidth = matrix[0].length;
    const levelDepth = matrix.length;

    const sides: { side: WallSide; getCell: (i: number) => string; length: number }[] = [
      { side: 'top', getCell: (i) => matrix[0]?.[i] ?? '', length: levelWidth },
      { side: 'bottom', getCell: (i) => matrix[levelDepth - 1]?.[i] ?? '', length: levelWidth },
      { side: 'left', getCell: (i) => matrix[i]?.[0] ?? '', length: levelDepth },
      { side: 'right', getCell: (i) => matrix[i]?.[levelWidth - 1] ?? '', length: levelDepth },
    ];

    for (const { side, getCell, length } of sides) {
      for (let i = 0; i < length; i++) {
        const cellValue = getCell(i);
        if (isWalkable(cellValue)) continue;

        const wall = new Wall({
          model: wallModel,
          index: i,
          side,
          tileSize,
          levelWidth,
          levelDepth,
        });

        wall.create(group);
        this.#objects.push(wall);
      }
    }
  }

  dispose(): void {
    for (const obj of this.#objects) {
      obj.dispose();
    }
    this.#objects = [];
  }
}
