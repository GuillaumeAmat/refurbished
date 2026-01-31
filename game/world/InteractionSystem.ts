import { type Group, Vector3 } from 'three';

import { INTERACTION_DISTANCE, INTERACTION_FACING_THRESHOLD } from '../constants';
import { ProgressBar } from '../hud/ProgressBar';
import { ScoreManager } from '../state/ScoreManager';
import { GamepadManager, type PlayerId } from '../util/input/GamepadManager';
import { BlueWorkZone } from './object/BlueWorkZone';
import { Crate } from './object/Crate';
import { DeliveryZone } from './object/DeliveryZone';
import { DroppedResource } from './object/DroppedResource';
import type { LevelObject } from './object/LevelObject';
import { RepairZone } from './object/RepairZone';
import type { Player } from './Player';

const REPAIR_HOLD_DURATION = 2000;
const ASSEMBLE_HOLD_DURATION = 2000;
const POINTS_PER_DELIVERY = 10;

interface HoldInteraction {
  target: LevelObject;
  type: 'repair' | 'assemble';
  progressBar: ProgressBar;
}

export class InteractionSystem {
  #interactables: LevelObject[] = [];
  #players: Player[] = [];
  #currentTargets: Map<PlayerId, LevelObject | null> = new Map();
  #droppedResources: DroppedResource[] = [];
  #resourceParents: Map<DroppedResource, LevelObject> = new Map();
  #levelGroup: Group;
  #holdInteractions: Map<PlayerId, HoldInteraction> = new Map();
  #gamepadManager: GamepadManager;
  #scoreManager: ScoreManager;

  constructor(levelGroup: Group) {
    this.#levelGroup = levelGroup;
    this.#gamepadManager = GamepadManager.getInstance();
    this.#scoreManager = ScoreManager.getInstance();
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

  addDroppedResource(resource: DroppedResource, parent?: LevelObject): void {
    this.#droppedResources.push(resource);
    this.#interactables.push(resource);
    if (parent) {
      this.#resourceParents.set(resource, parent);
    }
  }

  removeDroppedResource(resource: DroppedResource): void {
    const droppedIdx = this.#droppedResources.indexOf(resource);
    if (droppedIdx >= 0) this.#droppedResources.splice(droppedIdx, 1);

    const interactIdx = this.#interactables.indexOf(resource);
    if (interactIdx >= 0) this.#interactables.splice(interactIdx, 1);

    this.#resourceParents.delete(resource);
    resource.dispose();
  }

  #hasResourceOnTop(obj: LevelObject): boolean {
    for (const parent of this.#resourceParents.values()) {
      if (parent === obj) return true;
    }
    return false;
  }

  #getParentObject(resource: DroppedResource): LevelObject | null {
    return this.#resourceParents.get(resource) ?? null;
  }

  handleInteraction(playerId: PlayerId): void {
    const player = this.#players.find((p) => p.getPlayerId() === playerId);
    if (!player) return;

    const target = this.#currentTargets.get(playerId) ?? null;

    if (player.isCarrying()) {
      const carriedType = player.getCarriedResourceType();
      const carriedState = player.getCarriedResourceState();

      // Prevent dropping when targeting a crate
      if (target instanceof Crate) {
        return;
      }

      // Delivery zone: only accept phones
      if (target instanceof DeliveryZone && carriedType === 'phone') {
        player.dropResource();
        this.#scoreManager.addPoints(POINTS_PER_DELIVERY);
        return;
      }

      // BlueWorkZone: only accept repaired resources (not phones)
      if (target instanceof BlueWorkZone && carriedType && carriedState) {
        if (target.canAcceptResource(carriedType, carriedState)) {
          const dropped = player.dropResource();
          if (!dropped) return;

          const playerPos = player.getPosition();
          if (!playerPos) return;

          const targetPos = target.getPosition() ?? playerPos;
          const resource = new DroppedResource({
            resourceType: dropped.type,
            position: targetPos,
            onTopOf: target,
            state: dropped.state,
          });
          resource.create(this.#levelGroup);
          this.addDroppedResource(resource, target);
          target.setResource(resource);
          return;
        }
      }

      const resourceData = player.dropResource();
      if (!resourceData) return;

      const playerPos = player.getPosition();
      if (!playerPos) return;

      const canDropOnTarget =
        target &&
        !(target instanceof Crate) &&
        !(target instanceof DroppedResource) &&
        !(target instanceof DeliveryZone) &&
        !this.#hasResourceOnTop(target);

      if (canDropOnTarget) {
        const targetPos = target.getPosition() ?? playerPos;
        const dropped = new DroppedResource({
          resourceType: resourceData.type,
          position: targetPos,
          onTopOf: target,
          state: resourceData.state,
        });
        dropped.create(this.#levelGroup);
        this.addDroppedResource(dropped, target);
      } else {
        const facing = player.getFacingDirection();
        const dropPos = playerPos.clone().add(facing.multiplyScalar(1.0));
        const dropped = new DroppedResource({
          resourceType: resourceData.type,
          position: dropPos,
          state: resourceData.state,
        });
        dropped.create(this.#levelGroup);
        this.addDroppedResource(dropped);
      }
    } else {
      if (target instanceof DroppedResource) {
        player.grabResource(target.getResourceType(), target.getState());

        const parent = this.#getParentObject(target);
        if (parent instanceof BlueWorkZone) {
          const resources = parent.getResources();
          for (const [type, r] of resources) {
            if (r === target) {
              resources.delete(type);
              break;
            }
          }
        }

        this.removeDroppedResource(target);
        this.#currentTargets.set(playerId, null);
      } else if (target instanceof Crate) {
        player.grabResource(target.getResourceType(), 'broken');
      }
    }
  }

  #updateHoldInteractions(): void {
    for (const player of this.#players) {
      const playerId = player.getPlayerId();
      const inputSource = this.#gamepadManager.getInputSource(playerId);
      if (!inputSource) continue;

      const holdDuration = inputSource.getButtonHoldDuration('x');
      const target = this.#currentTargets.get(playerId) ?? null;

      // Check if we should start or continue a hold interaction
      if (holdDuration > 0 && target) {
        const existingHold = this.#holdInteractions.get(playerId);

        // Repair interaction: X on broken resource sitting on a RepairZone
        if (target instanceof DroppedResource && target.getState() === 'broken') {
          const parentObject = this.#getParentObject(target);
          if (parentObject instanceof RepairZone) {
            if (!existingHold || existingHold.target !== target) {
              existingHold?.progressBar.dispose();

              const progressBar = new ProgressBar(1.2, 0.15);
              const targetPos = target.getPosition();
              if (targetPos) {
                progressBar.setPosition(new Vector3(targetPos.x, 2.5, targetPos.z));
              }
              this.#levelGroup.add(progressBar.getGroup());
              progressBar.show();

              this.#holdInteractions.set(playerId, {
                target,
                type: 'repair',
                progressBar,
              });
            }

            const hold = this.#holdInteractions.get(playerId)!;
            const progress = holdDuration / REPAIR_HOLD_DURATION;
            hold.progressBar.setProgress(progress);

            if (holdDuration >= REPAIR_HOLD_DURATION) {
              target.repair();
              this.#cleanupHoldInteraction(playerId);
            }
            continue;
          }
        }

        // Assembly interaction: X on BlueWorkZone when ready to assemble
        if (target instanceof BlueWorkZone && target.isReadyToAssemble()) {
          if (!existingHold || existingHold.target !== target) {
            existingHold?.progressBar.dispose();

            const progressBar = new ProgressBar(1.2, 0.15);
            const targetPos = target.getPosition();
            if (targetPos) {
              progressBar.setPosition(new Vector3(targetPos.x, 2.5, targetPos.z));
            }
            this.#levelGroup.add(progressBar.getGroup());
            progressBar.show();

            this.#holdInteractions.set(playerId, {
              target,
              type: 'assemble',
              progressBar,
            });
          }

          const hold = this.#holdInteractions.get(playerId)!;
          const progress = holdDuration / ASSEMBLE_HOLD_DURATION;
          hold.progressBar.setProgress(progress);

          if (holdDuration >= ASSEMBLE_HOLD_DURATION) {
            const removedResources = target.assemble();
            for (const res of removedResources) {
              this.removeDroppedResource(res);
            }

            // Spawn phone
            const targetPos = target.getPosition();
            if (targetPos) {
              const phone = new DroppedResource({
                resourceType: 'phone',
                position: targetPos,
                onTopOf: target,
                state: 'repaired',
              });
              phone.create(this.#levelGroup);
              this.addDroppedResource(phone, target);
            }

            this.#cleanupHoldInteraction(playerId);
          }
          continue;
        }
      }

      // Clean up hold interaction if X not pressed or target changed
      const existingHold = this.#holdInteractions.get(playerId);
      if (existingHold && (holdDuration === 0 || existingHold.target !== target)) {
        this.#cleanupHoldInteraction(playerId);
      }
    }
  }

  #cleanupHoldInteraction(playerId: PlayerId): void {
    const hold = this.#holdInteractions.get(playerId);
    if (hold) {
      hold.progressBar.dispose();
      this.#holdInteractions.delete(playerId);
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

    this.#updateHoldInteractions();
  }

  #findBestTarget(player: Player): LevelObject | null {
    const playerPos = player.getPosition();
    if (!playerPos) return null;

    const playerDir = player.getFacingDirection();
    let bestTarget: LevelObject | null = null;
    let bestScore = -Infinity;

    const carriedType = player.getCarriedResourceType();
    const carriedState = player.getCarriedResourceState();

    for (const obj of this.#interactables) {
      // Skip DroppedResources on BlueWorkZone when player carries a compatible resource
      if (obj instanceof DroppedResource) {
        const parent = this.#getParentObject(obj);
        if (parent instanceof BlueWorkZone && carriedType && carriedState) {
          if (parent.canAcceptResource(carriedType, carriedState)) {
            continue; // Skip this resource, target the zone instead
          }
        }
      }

      // Skip objects that have a resource on top - player should target the resource instead
      // But allow BlueWorkZone if it can still accept resources or is ready to assemble
      if (this.#hasResourceOnTop(obj)) {
        if (obj instanceof BlueWorkZone) {
          // Allow targeting if carrying a compatible resource or ready to assemble
          if (carriedType && carriedState && obj.canAcceptResource(carriedType, carriedState)) {
            // Allow targeting
          } else if (obj.isReadyToAssemble() && !player.isCarrying()) {
            // Allow targeting for assembly
          } else {
            continue;
          }
        } else {
          continue;
        }
      }

      const objPos = obj.getClosestPoint(playerPos);
      if (!objPos) continue;

      const dx = objPos.x - playerPos.x;
      const dz = objPos.z - playerPos.z;
      const distanceXZ = Math.sqrt(dx * dx + dz * dz);

      if (distanceXZ > INTERACTION_DISTANCE) continue;

      const toObj = new Vector3(dx, 0, dz).normalize();
      const dot = playerDir.dot(toObj);

      // Skip facing check when standing on top of object
      if (distanceXZ > 0.1 && dot < INTERACTION_FACING_THRESHOLD) continue;

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
