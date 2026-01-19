import { Vector3 } from 'three';

import { TILE_SIZE } from './constants';

/**
 * 0 = Floor
 * 1 = Workbench
 * 2 = Blue work zone
 * 3 = Crate
 * 4 = Repair zone
 */
export type CellValue = 0 | 1 | 2 | 3 | 4;

export interface LevelData {
  matrix: CellValue[][];
  spawnPositions: [number, number][];
  tileSize: number;
}

export interface LevelInfo {
  width: number;
  depth: number;
  tileSize: number;
  center: Vector3;
  spawnPositions: Vector3[];
  data: LevelData;
}

const LEVEL_1: LevelData = {
  matrix: [
    [1, 1, 1, 3, 1, 1, 1, 1, 2, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 4, 1, 1, 1, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3],
    [1, 1, 1, 1, 4, 1, 1, 1, 4, 1, 1, 1, 1],
  ],
  spawnPositions: [
    [3, 6], // Player 1
    [10, 2], // Player 2
  ],
  tileSize: TILE_SIZE,
};

export const levelsInfo: LevelInfo[] = [createLevelInfo(LEVEL_1)];

function createLevelInfo(data: LevelData): LevelInfo {
  const matrixWidth = data.matrix[0]?.length || 0;
  const matrixDepth = data.matrix.length;

  const width = matrixWidth * data.tileSize;
  const depth = matrixDepth * data.tileSize;

  const center = new Vector3(width / 2, 0, depth / 2);

  const spawnPositions = data.spawnPositions.map(
    ([xIndex, zIndex]) =>
      new Vector3(
        xIndex * data.tileSize + data.tileSize / 2 + 0.5,
        0.1,
        zIndex * data.tileSize + data.tileSize / 2 + 0.5,
      ),
  );

  return {
    width,
    depth,
    tileSize: data.tileSize,
    center,
    spawnPositions,
    data,
  };
}
