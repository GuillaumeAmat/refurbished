import type { BufferGeometry, Group, Material, Object3D } from 'three';
import { Mesh } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import {
  isBlueWorkZone,
  isCrate,
  isDeliveryZone,
  isRepairZone,
  isWalkable,
  isWorkbench,
  type LevelData,
} from '../levels';
import { Resources } from '../util/Resources';
import { BlueWorkZone } from './object/BlueWorkZone';
import { Crate } from './object/Crate';
import { DeliveryZone } from './object/DeliveryZone';
import type { LevelObject } from './object/LevelObject';
import { NeonWall } from './object/NeonWall';
import { RepairZone } from './object/RepairZone';
import { Wall, type WallSide } from './object/Wall';
import { Workbench, type WorkbenchParams } from './object/Workbench';
import { WorkbenchBatch } from './object/WorkbenchBatch';

export class LevelBuilder {
  #data: LevelData;
  #objects: LevelObject[] = [];
  #workbenchBatch: WorkbenchBatch | null = null;

  constructor(data: LevelData) {
    this.#data = data;
  }

  buildFromMatrix(group: Group): LevelObject[] {
    this.buildLevelObjects(group);
    this.buildWalls(group);
    return this.#objects;
  }

  private buildLevelObjects(group: Group): void {
    const { matrix } = this.#data;

    if (!Array.isArray(matrix) || !matrix[0]) return;

    const levelWidth = matrix[0].length;
    const levelDepth = matrix.length;

    const builtDeliveryZones = new Set<string>();
    const workbenchParamsList: WorkbenchParams[] = [];

    for (let xIndex = 0; xIndex < levelWidth; xIndex++) {
      for (let zIndex = 0; zIndex < levelDepth; zIndex++) {
        const cellValue = matrix[zIndex]?.[xIndex] ?? '';

        if (isWalkable(cellValue)) continue;

        let obj: LevelObject | null = null;

        if (isWorkbench(cellValue)) {
          workbenchParamsList.push({ xIndex, zIndex, levelWidth, levelDepth });
          continue;
        } else if (isBlueWorkZone(cellValue)) {
          obj = new BlueWorkZone({
            xIndex,
            zIndex,
            levelWidth,
            levelDepth,
          });
        } else if (isCrate(cellValue)) {
          obj = new Crate({
            type: cellValue,
            xIndex,
            zIndex,
            levelWidth,
            levelDepth,
          });
        } else if (isRepairZone(cellValue)) {
          obj = new RepairZone({
            xIndex,
            zIndex,
            levelWidth,
            levelDepth,
          });
        } else if (isDeliveryZone(cellValue)) {
          // Detect edge orientation
          const isTopEdge = zIndex === 0;
          const isBottomEdge = zIndex === levelDepth - 1;
          const isHorizontalEdge = isTopEdge || isBottomEdge;

          // Track by zIndex for horizontal edges, xIndex for vertical
          const key = isHorizontalEdge ? `h:${zIndex}` : `v:${xIndex}`;
          if (builtDeliveryZones.has(key)) continue;

          let xIndex2 = xIndex;
          let zIndex2 = zIndex;

          if (isHorizontalEdge) {
            // Find second tile in next column (same row)
            for (let x = xIndex + 1; x < levelWidth; x++) {
              if (isDeliveryZone(matrix[zIndex]?.[x] ?? '')) {
                xIndex2 = x;
                break;
              }
            }
          } else {
            // Find second tile in next row (same column)
            for (let z = zIndex + 1; z < levelDepth; z++) {
              if (isDeliveryZone(matrix[z]?.[xIndex] ?? '')) {
                zIndex2 = z;
                break;
              }
            }
          }

          builtDeliveryZones.add(key);

          obj = new DeliveryZone({
            xIndex,
            zIndex,
            xIndex2,
            zIndex2,
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

    if (workbenchParamsList.length > 0) {
      const workbenchModel = Resources.getInstance().getGLTFAsset('workbenchModel');
      if (!workbenchModel) {
        console.error('Workbench model not loaded');
        return;
      }

      const batch = new WorkbenchBatch();
      this.#workbenchBatch = batch;

      const workbenches: Workbench[] = [];
      for (const params of workbenchParamsList) {
        const wb = new Workbench(params, batch);
        wb.create();
        workbenches.push(wb);
      }

      batch.build(group, workbenchModel);

      for (const wb of workbenches) {
        this.#objects.push(wb);
      }
    }
  }

  private buildWalls(group: Group): void {
    const { matrix } = this.#data;

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
        if (isWalkable(cellValue) || isDeliveryZone(cellValue)) continue;

        // Replace walls 2-3 and 9-10 on top side with neon walls
        if (side === 'top' && (i === 2 || i === 9)) {
          const neonWall = new NeonWall({
            index: i,
            side,
            levelWidth,
            levelDepth,
          });
          neonWall.create(group);
          this.#objects.push(neonWall);
          continue;
        }

        // Replace walls 2-3 on left side with blue neon wall
        if (side === 'left' && i === 2) {
          const neonWall = new NeonWall({
            index: i,
            side,
            levelWidth,
            levelDepth,
            variant: 'blue',
          });
          neonWall.create(group);
          this.#objects.push(neonWall);
          continue;
        }

        // Replace walls 2-3 and 5-6 on right side with blue neon walls
        if (side === 'right' && (i === 2 || i === 5)) {
          const neonWall = new NeonWall({
            index: i,
            side,
            levelWidth,
            levelDepth,
            variant: 'blue',
          });
          neonWall.create(group);
          this.#objects.push(neonWall);
          continue;
        }

        // Skip indices covered by neon walls
        if (
          (side === 'top' && (i === 3 || i === 10)) ||
          (side === 'left' && i === 3) ||
          (side === 'right' && (i === 3 || i === 6))
        )
          continue;

        const wall = new Wall({
          index: i,
          side,
          levelWidth,
          levelDepth,
        });

        wall.create(group);
        this.#objects.push(wall);
      }
    }

    this.mergeWallTops(group);
  }

  private mergeWallTops(group: Group): void {
    group.updateWorldMatrix(true, true);

    const wallTopRoots: Object3D[] = [];
    group.traverse((child) => {
      if (child.name === 'wallTop') wallTopRoots.push(child);
    });

    if (wallTopRoots.length === 0) return;

    const bakedGeometries: BufferGeometry[] = [];
    let sharedMaterial: Material | undefined;

    for (const root of wallTopRoots) {
      root.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        const geo = child.geometry.clone();
        geo.applyMatrix4(child.matrixWorld);
        bakedGeometries.push(geo);
        if (!sharedMaterial) sharedMaterial = child.material as Material;
      });
    }

    if (bakedGeometries.length === 0 || !sharedMaterial) return;

    const merged = mergeGeometries(bakedGeometries);
    if (!merged) return;

    const mergedMesh = new Mesh(merged, sharedMaterial);
    mergedMesh.castShadow = true;
    mergedMesh.receiveShadow = true;

    for (const root of wallTopRoots) {
      root.removeFromParent();
    }

    group.add(mergedMesh);
  }

  getInteractables(): LevelObject[] {
    return this.#objects.filter((obj) => obj.isInteractable);
  }

  dispose(): void {
    for (const obj of this.#objects) {
      obj.dispose();
    }
    this.#objects = [];
    this.#workbenchBatch?.dispose();
    this.#workbenchBatch = null;
  }
}
