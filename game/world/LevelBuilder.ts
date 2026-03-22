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
import { WallLight } from './object/WallLight';
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
    this.buildWallLights(group);
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
    this.mergeWallBodies(group);
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
    for (const geo of bakedGeometries) geo.dispose();
    if (!merged) return;

    const mergedMesh = new Mesh(merged, sharedMaterial);
    mergedMesh.castShadow = true;
    mergedMesh.receiveShadow = true;

    for (const root of wallTopRoots) {
      root.removeFromParent();
    }

    group.add(mergedMesh);
  }

  /**
   * Merge wall body meshes by material to reduce draw calls.
   * Wall objects are GLTF clones with potentially multiple sub-meshes;
   * we group by material reference, merge each group, and replace.
   */
  private mergeWallBodies(group: Group): void {
    group.updateWorldMatrix(true, true);

    // Collect all Wall container groups (direct children that are NOT wallTops and contain GLTF meshes)
    const wallObjects = this.#objects.filter((obj) => obj instanceof Wall);
    if (wallObjects.length === 0) return;

    // Gather all mesh children from wall containers, grouped by material
    const byMaterial = new Map<Material, { geometries: BufferGeometry[]; meshes: Mesh[] }>();

    for (const wallObj of wallObjects) {
      const container = wallObj.getMesh();
      if (!container) continue;

      container.traverse((child) => {
        if (!(child instanceof Mesh) || child.name === 'wallTop') return;
        // Skip merged wallTop meshes (they're direct children of group, not wall containers)
        if (child.parent === group) return;

        const mat = Array.isArray(child.material) ? child.material[0] : child.material;
        if (!mat) return;

        let bucket = byMaterial.get(mat);
        if (!bucket) {
          bucket = { geometries: [], meshes: [] };
          byMaterial.set(mat, bucket);
        }
        const geo = child.geometry.clone();
        geo.applyMatrix4(child.matrixWorld);
        bucket.geometries.push(geo);
        bucket.meshes.push(child);
      });
    }

    if (byMaterial.size === 0) return;

    // Remove original wall containers from group
    for (const wallObj of wallObjects) {
      const container = wallObj.getMesh();
      if (container) container.removeFromParent();
    }

    // Merge each material group into a single mesh
    for (const [material, { geometries }] of byMaterial) {
      const merged = mergeGeometries(geometries);
      for (const geo of geometries) geo.dispose();
      if (!merged) continue;

      const mesh = new Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  private buildPosters(group: Group): void {
    const { matrix } = this.#data;
    if (!Array.isArray(matrix) || !matrix[0]) return;

    const levelWidth = matrix[0].length;
    const levelDepth = matrix.length;

    const posters: {
      textureKey: string;
      wallIndex: number;
      side: WallSide;
      depth?: number;
      offsetX?: number;
      rotationY?: number;
    }[] = [
      { textureKey: 'poster1', wallIndex: 4, side: 'left', depth: 1, offsetX: -0.2, rotationY: -27 },
      { textureKey: 'poster2', wallIndex: 1, side: 'top', depth: 1.8, offsetX: -1, rotationY: 33 },
      { textureKey: 'poster3', wallIndex: 3, side: 'top', depth: 0.6, offsetX: -1.2, rotationY: 15 },
      { textureKey: 'poster4', wallIndex: 5, side: 'top', depth: 1.2, offsetX: -0.8, rotationY: -9 },
      { textureKey: 'poster5', wallIndex: 7, side: 'top', depth: 1.2, offsetX: -0.9, rotationY: 9 },
      { textureKey: 'poster6', wallIndex: 9, side: 'top', depth: 1, offsetX: 0.8, rotationY: -27 },
      { textureKey: 'poster7', wallIndex: 11, side: 'top', depth: 1, offsetX: 0.8, rotationY: -27 },
      { textureKey: 'poster8', wallIndex: 4, side: 'right', depth: 0.8, offsetX: 0.2, rotationY: 30 },
    ];

    for (const { textureKey, wallIndex, side, depth, offsetX, rotationY } of posters) {
      const poster = new Poster({ textureKey, wallIndex, side, levelWidth, levelDepth });
      poster.create(group);
      if (depth) poster.setDepth(depth);
      if (offsetX) poster.setOffsetX(offsetX);
      if (rotationY) poster.setRotationY(rotationY);
      this.#objects.push(poster);
    }
  }

  private buildWallLights(group: Group): void {
    const { matrix } = this.#data;
    if (!Array.isArray(matrix) || !matrix[0]) return;

    const levelWidth = matrix[0].length;
    const levelDepth = matrix.length;

    const wallLights: { wallIndex: number; side: WallSide }[] = [
      { wallIndex: 0, side: 'left' },
      { wallIndex: 4, side: 'left' },
      { wallIndex: 8, side: 'left' },
      { wallIndex: 1, side: 'top' },
      { wallIndex: 6, side: 'top' },
      { wallIndex: 11, side: 'top' },
      { wallIndex: 0, side: 'right' },
      { wallIndex: 4, side: 'right' },
      { wallIndex: 8, side: 'right' },
    ];

    for (const { wallIndex, side } of wallLights) {
      const light = new WallLight({ wallIndex, side, levelWidth, levelDepth });
      light.create(group);
      this.#objects.push(light);
    }

    this.setupWallLightDebug();
  }

  private setupWallLightDebug() {
    const debug = Debug.getInstance();
    if (!debug.active) return;

    const lights = WallLight.lights;
    const ref = lights[0];
    if (!ref) return;

    const folder = debug.gui.addFolder('Wall Lights');
    const colorState = { color: `#${ref.color.getHexString()}` };
    folder
      .addColor(colorState, 'color')
      .name('Color')
      .onChange((v: string) => {
        for (const l of lights) l.color.set(v);
        debug.save();
      });

    const state = {
      intensity: ref.intensity,
      distance: ref.distance,
      decay: ref.decay,
      height: ref.position.y,
    };

    const apply = (key: keyof typeof state, value: number) => {
      state[key] = value;
      for (const l of lights) {
        if (key === 'height') l.position.y = value;
        else if (key === 'intensity') l.intensity = value;
        else if (key === 'distance') l.distance = value;
        else if (key === 'decay') l.decay = value;
      }
      folder.controllersRecursive().forEach((c) => c.updateDisplay());
      debug.save();
    };

    folder
      .add(state, 'intensity', 0, 20, 0.1)
      .name('Intensity')
      .onChange((v: number) => apply('intensity', v));
    const intActions = {
      inc: () => apply('intensity', Math.round((state.intensity + 1) * 10) / 10),
      dec: () => apply('intensity', Math.round((state.intensity - 1) * 10) / 10),
    };
    folder.add(intActions, 'inc').name('Intensity +1');
    folder.add(intActions, 'dec').name('Intensity -1');

    folder
      .add(state, 'distance', 0, 20, 0.1)
      .name('Distance')
      .onChange((v: number) => apply('distance', v));
    const distActions = {
      inc: () => apply('distance', Math.round((state.distance + 0.5) * 10) / 10),
      dec: () => apply('distance', Math.round((state.distance - 0.5) * 10) / 10),
    };
    folder.add(distActions, 'inc').name('Distance +0.5');
    folder.add(distActions, 'dec').name('Distance -0.5');

    folder
      .add(state, 'decay', 0, 5, 0.1)
      .name('Decay')
      .onChange((v: number) => apply('decay', v));
    const decayActions = {
      inc: () => apply('decay', Math.round((state.decay + 0.1) * 10) / 10),
      dec: () => apply('decay', Math.round((state.decay - 0.1) * 10) / 10),
    };
    folder.add(decayActions, 'inc').name('Decay +0.1');
    folder.add(decayActions, 'dec').name('Decay -0.1');

    folder
      .add(state, 'height', 0, 8, 0.1)
      .name('Height')
      .onChange((v: number) => apply('height', v));
    const heightActions = {
      inc: () => apply('height', Math.round((state.height + 0.2) * 10) / 10),
      dec: () => apply('height', Math.round((state.height - 0.2) * 10) / 10),
    };
    folder.add(heightActions, 'inc').name('Height +0.2');
    folder.add(heightActions, 'dec').name('Height -0.2');
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
