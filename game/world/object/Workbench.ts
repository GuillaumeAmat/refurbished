import { Box3, Vector3 } from 'three';

import { TILE_SIZE } from '../../constants';
import { LevelObject } from './LevelObject';
import type { WorkbenchBatch } from './WorkbenchBatch';

export interface WorkbenchParams {
  xIndex: number;
  zIndex: number;
  levelWidth: number;
  levelDepth: number;
}

export class Workbench extends LevelObject {
  #params: WorkbenchParams;
  #batch: WorkbenchBatch;
  #instanceIndex = -1;
  #storedPosition: Vector3;
  #cachedBox: Box3;

  constructor(params: WorkbenchParams, batch: WorkbenchBatch) {
    super();
    this.#params = params;
    this.#batch = batch;
    const { xIndex, zIndex } = params;
    this.#storedPosition = new Vector3(xIndex * TILE_SIZE + 1, 0.5, zIndex * TILE_SIZE + 1);
    this.#cachedBox = new Box3(
      new Vector3(xIndex * TILE_SIZE, 0, zIndex * TILE_SIZE),
      new Vector3(xIndex * TILE_SIZE + TILE_SIZE, 1, zIndex * TILE_SIZE + TILE_SIZE),
    );
  }

  create(): void {
    const { xIndex, zIndex, levelWidth, levelDepth } = this.#params;

    const position = new Vector3(xIndex * TILE_SIZE, 0, zIndex * TILE_SIZE);
    let rotationY = 0;

    const isBottomEdge = zIndex === levelDepth - 1;
    const isLeftEdge = xIndex === 0;
    const isRightEdge = xIndex === levelWidth - 1;

    if (isBottomEdge) {
      rotationY = Math.PI;
      position.x += TILE_SIZE;
      position.z += TILE_SIZE;
    } else if (isLeftEdge) {
      rotationY = Math.PI / 2;
      position.z += TILE_SIZE;
    } else if (isRightEdge) {
      rotationY = -Math.PI / 2;
      position.x += TILE_SIZE;
    }

    this.#instanceIndex = this.#batch.register(position, rotationY);
    this.createPhysics(xIndex, zIndex, TILE_SIZE);
    this.isInteractable = true;
  }

  override getPosition(): Vector3 | null {
    return this.#storedPosition;
  }

  override getClosestPoint(from: Vector3): Vector3 | null {
    return new Vector3(
      Math.max(this.#cachedBox.min.x, Math.min(from.x, this.#cachedBox.max.x)),
      from.y,
      Math.max(this.#cachedBox.min.z, Math.min(from.z, this.#cachedBox.max.z)),
    );
  }

  override setHighlight(enabled: boolean): void {
    if (this.#instanceIndex < 0) return;
    this.#batch.setHighlight(this.#instanceIndex, enabled);
  }

  override dispose(): void {
    // batch owns the meshes; only clean up physics
    if (this.rigidBody) {
      this.rigidBody = null;
    }
  }
}
