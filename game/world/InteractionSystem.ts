import { type Group, Vector3 } from 'three';

import { INTERACTION_DISTANCE, INTERACTION_FACING_THRESHOLD } from '../constants';
import { ScoreManager } from '../state/ScoreManager';
import { GamepadManager, type PlayerId } from '../util/input/GamepadManager';
import { Time } from '../util/Time';
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

export class InteractionSystem {
  #interactables: LevelObject[] = [];
  #players: Player[] = [];
  #currentTargets: Map<PlayerId, LevelObject | null> = new Map();
  #droppedResources: DroppedResource[] = [];
  #resourceParents: Map<DroppedResource, LevelObject> = new Map();
  #levelGroup: Group;
  #gamepadManager: GamepadManager;
  #scoreManager: ScoreManager;

  // Cached objects to avoid allocations in hot loops
  #tempToObj = new Vector3();
  #activeRepairTargets = new Set<DroppedResource>();
  #activeAssemblyTargets = new Set<BlueWorkZone>();

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

      // Delivery zone: only accept closed packages
      if (target instanceof DeliveryZone && carriedType === 'package' && carriedState === 'repaired') {
        player.dropResource();
        this.#scoreManager.addPoints(POINTS_PER_DELIVERY);
        return;
      }

      // BlueWorkZone: accept open package when awaiting packaging
      if (target instanceof BlueWorkZone && target.canAcceptPackage(carriedType!, carriedState!)) {
        player.dropResource();

        // Remove phone
        const phone = target.clearAwaitingPackaging();
        if (phone) {
          this.removeDroppedResource(phone);
        }

        // Spawn closed package
        const targetPos = target.getPosition();
        if (targetPos) {
          const closedPackage = new DroppedResource({
            resourceType: 'package',
            position: targetPos,
            onTopOf: target,
            state: 'repaired',
          });
          closedPackage.create(this.#levelGroup);
          this.addDroppedResource(closedPackage, target);
        }
        return;
      }

      // BlueWorkZone: only accept repaired resources (not phones/packages)
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
        // Prevent dropping packages on BlueWorkZone when not awaiting
        if (carriedType === 'package') {
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
        !(target instanceof BlueWorkZone) &&
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
    const deltaMs = Time.getInstance().delta;

    // Clear and reuse sets to track objects worked on this frame
    this.#activeRepairTargets.clear();
    this.#activeAssemblyTargets.clear();

    for (const player of this.#players) {
      const playerId = player.getPlayerId();
      const inputSource = this.#gamepadManager.getInputSource(playerId);
      if (!inputSource) continue;

      const isHoldingX = inputSource.getButtonHoldDuration('x') > 0;
      const target = this.#currentTargets.get(playerId) ?? null;

      if (!isHoldingX || !target) continue;

      // Repair interaction: X on broken resource sitting on a RepairZone
      if (target instanceof DroppedResource && target.getState() === 'broken') {
        const parentObject = this.#getParentObject(target);
        if (parentObject instanceof RepairZone) {
          // Only add progress once per object per frame (no coop bonus)
          if (!this.#activeRepairTargets.has(target)) {
            this.#activeRepairTargets.add(target);
            target.addRepairProgress(deltaMs);
          }

          target.getOrCreateProgressBar(this.#levelGroup);
          target.updateProgressBar(target.getRepairProgress() / REPAIR_HOLD_DURATION);

          if (target.isRepairComplete(REPAIR_HOLD_DURATION)) {
            target.repair();
            target.resetRepairProgress();
          }
        }
      }

      // Assembly interaction: X on BlueWorkZone when ready to assemble
      if (target instanceof BlueWorkZone && target.isReadyToAssemble()) {
        // Only add progress once per object per frame (no coop bonus)
        if (!this.#activeAssemblyTargets.has(target)) {
          this.#activeAssemblyTargets.add(target);
          target.addAssemblyProgress(deltaMs);
        }

        target.getOrCreateProgressBar(this.#levelGroup);
        target.updateProgressBar(target.getAssemblyProgress() / ASSEMBLE_HOLD_DURATION);

        if (target.isAssemblyComplete(ASSEMBLE_HOLD_DURATION)) {
          const removedResources = target.assemble();
          for (const res of removedResources) {
            this.removeDroppedResource(res);
          }

          // Spawn phone (not grabbable, awaiting packaging)
          const targetPos = target.getPosition();
          if (targetPos) {
            const phone = new DroppedResource({
              resourceType: 'phone',
              position: targetPos,
              onTopOf: target,
              state: 'repaired',
            });
            phone.create(this.#levelGroup);
            phone.isInteractable = false;
            this.addDroppedResource(phone, target);
            target.setAwaitingPackaging(phone);
          }
        }
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
      // Skip non-phone resources on BlueWorkZone - zone handles assembly
      // Skip phone when awaiting packaging (phone is not grabbable)
      if (obj instanceof DroppedResource) {
        const parent = this.#getParentObject(obj);
        if (parent instanceof BlueWorkZone) {
          const resourceType = obj.getResourceType();
          if (resourceType !== 'phone' && resourceType !== 'package') {
            continue;
          }
          // Skip phone when awaiting packaging
          if (resourceType === 'phone' && parent.isAwaitingPackaging()) {
            continue;
          }
        }
      }

      // Skip objects that have a resource on top - player should target the resource instead
      // But allow BlueWorkZone if it can still accept resources, ready to assemble, or awaiting packaging
      if (this.#hasResourceOnTop(obj)) {
        if (obj instanceof BlueWorkZone) {
          // Allow targeting if carrying a compatible resource or ready to assemble
          if (carriedType && carriedState && obj.canAcceptResource(carriedType, carriedState)) {
            // Allow targeting
          } else if (obj.isReadyToAssemble() && !player.isCarrying()) {
            // Allow targeting for assembly
          } else if (carriedType && carriedState && obj.canAcceptPackage(carriedType, carriedState)) {
            // Allow targeting for packaging
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

      const toObj = this.#tempToObj.set(dx, 0, dz).normalize();
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
