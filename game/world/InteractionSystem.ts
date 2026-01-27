import { type Group, Vector3 } from 'three';

import { INTERACTION_DISTANCE, INTERACTION_FACING_THRESHOLD } from '../constants';
import type { PlayerId } from '../util/input/GamepadManager';
import { Crate } from './object/Crate';
import { DroppedResource } from './object/DroppedResource';
import type { LevelObject } from './object/LevelObject';
import type { Player } from './Player';

export class InteractionSystem {
  #interactables: LevelObject[] = [];
  #players: Player[] = [];
  #currentTargets: Map<PlayerId, LevelObject | null> = new Map();
  #droppedResources: DroppedResource[] = [];
  #objectResources: Map<LevelObject, DroppedResource> = new Map();
  #levelGroup: Group;

  constructor(levelGroup: Group) {
    this.#levelGroup = levelGroup;
  }

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

  addDroppedResource(resource: DroppedResource): void {
    this.#droppedResources.push(resource);
    this.#interactables.push(resource);
  }

  removeDroppedResource(resource: DroppedResource): void {
    const droppedIdx = this.#droppedResources.indexOf(resource);
    if (droppedIdx >= 0) this.#droppedResources.splice(droppedIdx, 1);

    const interactIdx = this.#interactables.indexOf(resource);
    if (interactIdx >= 0) this.#interactables.splice(interactIdx, 1);

    resource.dispose();
  }

  handleInteraction(playerId: PlayerId): void {
    const player = this.#players.find((p) => p.getPlayerId() === playerId);
    if (!player) return;

    const target = this.#currentTargets.get(playerId) ?? null;

    if (player.isCarrying()) {
      const resourceType = player.dropResource();
      if (!resourceType) return;

      const playerPos = player.getPosition();
      if (!playerPos) return;

      const canDropOnTarget =
        target && !(target instanceof Crate) && !(target instanceof DroppedResource) && !this.#objectResources.has(target);

      if (canDropOnTarget) {
        const targetPos = target.getPosition() ?? playerPos;
        const dropped = new DroppedResource({ resourceType, position: targetPos, onTopOf: target });
        dropped.create(this.#levelGroup);
        this.addDroppedResource(dropped);
        this.#objectResources.set(target, dropped);
      } else {
        const facing = player.getFacingDirection();
        const dropPos = playerPos.clone().add(facing.multiplyScalar(1.0));
        const dropped = new DroppedResource({ resourceType, position: dropPos });
        dropped.create(this.#levelGroup);
        this.addDroppedResource(dropped);
      }
    } else {
      if (target instanceof DroppedResource) {
        player.grabResource(target.getResourceType());

        for (const [obj, res] of this.#objectResources) {
          if (res === target) {
            this.#objectResources.delete(obj);
            break;
          }
        }

        this.removeDroppedResource(target);
        this.#currentTargets.set(playerId, null);
      } else if (target instanceof Crate) {
        player.grabResource(target.getResourceType());
      }
    }
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

      let priorityBonus = 0;
      if (obj instanceof DroppedResource) priorityBonus = 10;
      else if (obj instanceof Crate) priorityBonus = 5;

      const score = dot - distanceXZ * 0.5 + priorityBonus;
      if (score > bestScore) {
        bestScore = score;
        bestTarget = obj;
      }
    }

    return bestTarget;
  }
}
