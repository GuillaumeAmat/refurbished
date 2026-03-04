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
  type NeonWallDef,
} from '../levels';
import { Debug } from '../util/Debug';
import { Resources } from '../util/Resources';
import { BlueWorkZone } from './object/BlueWorkZone';
import { Crate } from './object/Crate';
import { DeliveryZone } from './object/DeliveryZone';
import type { LevelObject } from './object/LevelObject';
import { NeonWall } from './object/NeonWall';
import { Poster } from './object/Poster';
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
    this.buildPosters(group);
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

    const neonSet = new Map<string, NeonWallDef>(
      (this.#data.neonWalls ?? []).map((def) => [`${def.side}:${def.index}`, def]),
    );

    for (const { side, getCell, length } of sides) {
      for (let i = 0; i < length; i++) {
        const cellValue = getCell(i);
        if (isWalkable(cellValue) || isDeliveryZone(cellValue)) continue;

        const neonDef = neonSet.get(`${side}:${i}`);
        if (neonDef) {
          const neonWall = new NeonWall({ index: i, side, levelWidth, levelDepth, ...neonDef });
          neonWall.create(group);
          this.#objects.push(neonWall);
          continue;
        }

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

  private buildPosters(group: Group): void {
    const { matrix } = this.#data;
    if (!Array.isArray(matrix) || !matrix[0]) return;

    const levelWidth = matrix[0].length;
    const levelDepth = matrix.length;

    const posters: { textureKey: string; wallIndex: number; side: WallSide; depth?: number; offsetX?: number; rotationY?: number }[] = [
      { textureKey: 'poster1', wallIndex: 4, side: 'left', depth: 1, offsetX: -0.2, rotationY: -27 },
      { textureKey: 'poster2', wallIndex: 1, side: 'top', depth: 1.8, offsetX: -1, rotationY: 33 },
      { textureKey: 'poster3', wallIndex: 3, side: 'top', depth: 0.6, offsetX: -0.6, rotationY: 15 },
      { textureKey: 'poster4', wallIndex: 5, side: 'top', depth: 1.8, offsetX: -0.8, rotationY: -9 },
      { textureKey: 'poster5', wallIndex: 7, side: 'top', depth: 1.2, offsetX: 0.6, rotationY: 9 },
      { textureKey: 'poster6', wallIndex: 9, side: 'top', depth: 1, offsetX: 0.8, rotationY: -27 },
      { textureKey: 'poster7', wallIndex: 11, side: 'top', depth: 1, offsetX: 0.8, rotationY: -27 },
      { textureKey: 'poster8', wallIndex: 4, side: 'right', depth: 0.8, offsetX: 0.2, rotationY: 30 },
    ];

    const backPosters: Poster[] = [];
    const sidePosters: Poster[] = [];

    for (const { textureKey, wallIndex, side, depth, offsetX, rotationY } of posters) {
      const poster = new Poster({ textureKey, wallIndex, side, levelWidth, levelDepth });
      poster.create(group);
      if (depth) poster.setDepth(depth);
      if (offsetX) poster.setOffsetX(offsetX);
      if (rotationY) poster.setRotationY(rotationY);
      this.#objects.push(poster);
      if (side === 'top') backPosters.push(poster);
      if (side === 'left' || side === 'right') sidePosters.push(poster);
    }

    this.setupPosterDebug(backPosters, sidePosters);
  }

  private setupPosterDebug(backPosters: Poster[], sidePosters: Poster[]) {
    const debug = Debug.getInstance();
    if (!debug.active) return;

    const folder = debug.gui.addFolder('Poster Positions');

    const addPosterFolder = (poster: Poster, label: string) => {
      const pFolder = folder.addFolder(label);
      const state = { depth: poster.depth, offsetX: poster.offsetX, rotationY: poster.rotationY };

      pFolder.add(state, 'depth').name('Depth').step(0.01)
        .onChange((v: number) => { poster.setDepth(v); debug.save(); });

      const depthActions = {
        inc: () => { state.depth = Math.round((state.depth + 0.2) * 100) / 100; poster.setDepth(state.depth); pFolder.controllersRecursive().forEach((c) => c.updateDisplay()); debug.save(); },
        dec: () => { state.depth = Math.round((state.depth - 0.2) * 100) / 100; poster.setDepth(state.depth); pFolder.controllersRecursive().forEach((c) => c.updateDisplay()); debug.save(); },
      };
      pFolder.add(depthActions, 'inc').name('Depth +0.2');
      pFolder.add(depthActions, 'dec').name('Depth -0.2');

      pFolder.add(state, 'offsetX').name('Offset X').step(0.01)
        .onChange((v: number) => { poster.setOffsetX(v); debug.save(); });

      const xActions = {
        inc: () => { state.offsetX = Math.round((state.offsetX + 0.2) * 100) / 100; poster.setOffsetX(state.offsetX); pFolder.controllersRecursive().forEach((c) => c.updateDisplay()); debug.save(); },
        dec: () => { state.offsetX = Math.round((state.offsetX - 0.2) * 100) / 100; poster.setOffsetX(state.offsetX); pFolder.controllersRecursive().forEach((c) => c.updateDisplay()); debug.save(); },
      };
      pFolder.add(xActions, 'inc').name('X +0.2');
      pFolder.add(xActions, 'dec').name('X -0.2');

      pFolder.add(state, 'rotationY').name('Rotation Y').step(0.1)
        .onChange((v: number) => { poster.setRotationY(v); debug.save(); });

      const rotActions = {
        inc: () => { state.rotationY = Math.round((state.rotationY + 3) * 10) / 10; poster.setRotationY(state.rotationY); pFolder.controllersRecursive().forEach((c) => c.updateDisplay()); debug.save(); },
        dec: () => { state.rotationY = Math.round((state.rotationY - 3) * 10) / 10; poster.setRotationY(state.rotationY); pFolder.controllersRecursive().forEach((c) => c.updateDisplay()); debug.save(); },
      };
      pFolder.add(rotActions, 'inc').name('Rot +3°');
      pFolder.add(rotActions, 'dec').name('Rot -3°');
    };

    for (let i = 0; i < backPosters.length; i++) {
      addPosterFolder(backPosters[i]!, `Back ${i + 1}`);
    }

    for (let i = 0; i < sidePosters.length; i++) {
      addPosterFolder(sidePosters[i]!, `Side ${i + 1}`);
    }

    const allPosters = [...backPosters, ...sidePosters];
    const wireState = { height: 25 };
    folder.add(wireState, 'height', 0.5, 30, 0.5)
      .name('Wire Height')
      .onChange((v: number) => {
        for (const poster of allPosters) poster.setWireHeight(v);
        debug.save();
      });
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
