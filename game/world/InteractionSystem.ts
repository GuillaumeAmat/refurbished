import { Vector3 } from 'three';

import { INTERACTION_DISTANCE, INTERACTION_FACING_THRESHOLD } from '../constants';
import type { PlayerId } from '../util/input/GamepadManager';
import type { LevelObject } from './object/LevelObject';
import type { Player } from './Player';

export class InteractionSystem {
  #interactables: LevelObject[] = [];
  #players: Player[] = [];
  #currentTargets: Map<PlayerId, LevelObject | null> = new Map();

  setInteractables(objects: LevelObject[]): void {
    this.#interactables = objects;
  }

  registerPlayer(player: Player): void {
    this.#players.push(player);
    this.#currentTargets.set(player.getPlayerId(), null);
  }

  getCurrentTarget(playerId: PlayerId): LevelObject | null {
    return this.#currentTargets.get(playerId) ?? null;
  }

  update(): void {
    for (const player of this.#players) {
      const bestTarget = this.#findBestTarget(player);
      const playerId = player.getPlayerId();
      const currentTarget = this.#currentTargets.get(playerId) ?? null;

      if (bestTarget !== currentTarget) {
        currentTarget?.setHighlight(false);
        bestTarget?.setHighlight(true);
        this.#currentTargets.set(playerId, bestTarget);
      }
    }
  }

  #findBestTarget(player: Player): LevelObject | null {
    const playerPos = player.getPosition();
    if (!playerPos) return null;

    const playerDir = player.getFacingDirection();
    let bestTarget: LevelObject | null = null;
    let bestScore = -Infinity;

    for (const obj of this.#interactables) {
      const objPos = obj.getPosition();
      if (!objPos) continue;

      const dx = objPos.x - playerPos.x;
      const dz = objPos.z - playerPos.z;
      const distanceXZ = Math.sqrt(dx * dx + dz * dz);

      if (distanceXZ > INTERACTION_DISTANCE) continue;

      const toObj = new Vector3(dx, 0, dz).normalize();
      const dot = playerDir.dot(toObj);

      if (dot < INTERACTION_FACING_THRESHOLD) continue;

      const score = dot - distanceXZ * 0.5;
      if (score > bestScore) {
        bestScore = score;
        bestTarget = obj;
      }
    }

    return bestTarget;
  }
}
