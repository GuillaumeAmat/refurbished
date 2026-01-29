import { Vector3 } from 'three';

import { TILE_SIZE } from './constants';

export const Cell = {
  FLOOR: '00',
  SPAWN_P1: '01',
  SPAWN_P2: '02',
  WORKBENCH: '03',
  REPAIR_ZONE: '04',
  BLUE_WORK_ZONE: '05',
  DELIVERY_ZONE: '06',
  CRATE_BATTERY: '10',
  CRATE_FRAME: '11',
  CRATE_SCREEN: '12',
} as const;

export type CellValue = string;

export const isSpawn = (c: string) => c === Cell.SPAWN_P1 || c === Cell.SPAWN_P2;
export const isWalkable = (c: string) => c === Cell.FLOOR || isSpawn(c);
export const isBatteryCrate = (c: string) => c === Cell.CRATE_BATTERY;
export const isFrameCrate = (c: string) => c === Cell.CRATE_FRAME;
export const isScreenCrate = (c: string) => c === Cell.CRATE_SCREEN;
export const isCrate = (c: string) => c === Cell.CRATE_BATTERY || c === Cell.CRATE_FRAME || c === Cell.CRATE_SCREEN;
export const isWorkbench = (c: string) => c === Cell.WORKBENCH;
export const isRepairZone = (c: string) => c === Cell.REPAIR_ZONE;
export const isBlueWorkZone = (c: string) => c === Cell.BLUE_WORK_ZONE;
export const isDeliveryZone = (c: string) => c === Cell.DELIVERY_ZONE;

export interface LevelData {
  matrix: CellValue[][];
}

export interface LevelInfo {
  width: number;
  depth: number;
  center: Vector3;
  spawnPositions: Vector3[];
  data: LevelData;
}

const LEVEL_1: LevelData = {
  matrix: [
    ['03', '03', '10', '11', '12', '03', '03', '03', '05', '03', '03', '03', '03'],
    ['03', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '03'],
    ['03', '00', '00', '00', '00', '00', '00', '00', '00', '00', '02', '00', '03'],
    ['03', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '03'],
    ['03', '03', '03', '03', '03', '03', '04', '03', '03', '03', '00', '00', '03'],
    ['03', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '03'],
    ['06', '00', '00', '01', '00', '00', '00', '00', '00', '00', '00', '00', '03'],
    ['06', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '03'],
    ['03', '03', '03', '03', '04', '03', '03', '03', '04', '03', '03', '03', '03'],
  ],
};

export const levelsInfo: LevelInfo[] = [createLevelInfo(LEVEL_1)];

function createLevelInfo(data: LevelData): LevelInfo {
  const matrixWidth = data.matrix[0]?.length || 0;
  const matrixDepth = data.matrix.length;

  const width = matrixWidth * TILE_SIZE;
  const depth = matrixDepth * TILE_SIZE;

  const center = new Vector3(width / 2, 0, depth / 2);

  // Scan matrix for spawn positions
  const spawnPositions: Vector3[] = [];
  for (let zIndex = 0; zIndex < matrixDepth; zIndex++) {
    for (let xIndex = 0; xIndex < matrixWidth; xIndex++) {
      const cell = data.matrix[zIndex]?.[xIndex] ?? '';
      if (isSpawn(cell)) {
        const playerIndex = cell === Cell.SPAWN_P1 ? 0 : 1;
        spawnPositions[playerIndex] = new Vector3(
          xIndex * TILE_SIZE + TILE_SIZE / 2 + 0.5,
          0.1,
          zIndex * TILE_SIZE + TILE_SIZE / 2 + 0.5,
        );
      }
    }
  }

  return {
    width,
    depth,
    center,
    spawnPositions,
    data,
  };
}
