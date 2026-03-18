import { type Group, type Object3D, Vector3 } from 'three';

import { ASSEMBLE_HOLD_DURATION, DELIVERY_ANIM_DURATION, DELIVERY_SMOKE_COUNT, INTERACTION_DISTANCE, INTERACTION_FACING_THRESHOLD } from '../constants';
import { isWorkbench, type LevelData } from '../levels';
import { OrderManager } from '../state/OrderManager';
import { GamepadManager, type PlayerId } from '../util/input/GamepadManager';
import { Resources } from '../util/Resources';
import { Time } from '../util/Time';
import { BlueWorkZone } from './object/BlueWorkZone';
import { Crate } from './object/Crate';
import { DeliveryZone } from './object/DeliveryZone';
import { DroppedResource } from './object/DroppedResource';
import type { LevelObject } from './object/LevelObject';
import { RepairZone } from './object/RepairZone';
import type { OnboardingManager } from './OnboardingManager';
import type { ResourceState, ResourceType } from '../types';
import type { Player } from './Player';
import { REPAIR_HIT_COUNT } from './RepairAnimation';
import { PointsPopAnimation } from './PointsPopAnimation';
import { SmokeParticleSystem } from './SmokeParticleSystem';

const REPAIR_HOLD_DURATION = 2800;

export class InteractionSystem {
  #interactables: LevelObject[] = [];
  #players: Player[] = [];
  #currentTargets: Map<PlayerId, LevelObject | null> = new Map();
  #droppedResources: DroppedResource[] = [];
  #resourceParents: Map<DroppedResource, LevelObject> = new Map();
  #levelGroup: Group;
  #levelData: LevelData;
  #gamepadManager: GamepadManager;
  #orderManager: OrderManager;
  #onboardingManager: OnboardingManager | null = null;

  #smokeSystem: SmokeParticleSystem;
  #deliveryAnims: { mesh: Object3D; timer: number; points: number }[] = [];
  #pointsPopAnims: PointsPopAnimation[] = [];

  // Cached objects to avoid allocations in hot loops
  #tempToObj = new Vector3();
  #tempDropPos = new Vector3();
  #activeRepairTargets = new Set<DroppedResource>();
  #objectsWithResources = new Set<LevelObject>();
  #repairingPlayers = new Set<PlayerId>();

  constructor(levelGroup: Group, levelData: LevelData) {
    this.#levelGroup = levelGroup;
    this.#levelData = levelData;
    this.#gamepadManager = GamepadManager.getInstance();
    this.#orderManager = OrderManager.getInstance();
    this.#smokeSystem = new SmokeParticleSystem(levelGroup);
  }

  setInteractables(objects: LevelObject[]): void {
    this.#interactables = objects;
  }

  setOnboardingManager(manager: OnboardingManager): void {
    this.#onboardingManager = manager;
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
      this.#objectsWithResources.add(parent);
    }
  }

  removeDroppedResource(resource: DroppedResource): void {
    const droppedIdx = this.#droppedResources.indexOf(resource);
    if (droppedIdx >= 0) this.#droppedResources.splice(droppedIdx, 1);

    const interactIdx = this.#interactables.indexOf(resource);
    if (interactIdx >= 0) this.#interactables.splice(interactIdx, 1);

    const parent = this.#resourceParents.get(resource);
    this.#resourceParents.delete(resource);

    // Remove parent from set only if no other resource references it
    if (parent) {
      let stillHasResource = false;
      for (const p of this.#resourceParents.values()) {
        if (p === parent) {
          stillHasResource = true;
          break;
        }
      }
      if (!stillHasResource) this.#objectsWithResources.delete(parent);
    }

    resource.dispose();
  }

  #findFloorDroppedResource(type: ResourceType, state: ResourceState): Vector3 | null {
    for (const resource of this.#droppedResources) {
      if (
        resource.getResourceType() === type &&
        resource.getState() === state &&
        !this.#resourceParents.has(resource)
      ) {
        return resource.getPosition();
      }
    }
    return null;
  }

  #isBenchCenter(x: number, z: number): boolean {
    if (x % 2 === 0 || z % 2 === 0) return false;
    const tileX = (x - 1) / 2;
    const tileZ = (z - 1) / 2;
    return isWorkbench(this.#levelData.matrix[tileZ]?.[tileX] ?? '');
  }

  #snapDropPosition(rawPos: Vector3, playerPos: Vector3): Vector3 {
    let rx = Math.round(rawPos.x);
    let rz = Math.round(rawPos.z);

    if ((rx + rz) % 2 !== 0) {
      const candidates = [
        [rx + 1, rz],
        [rx - 1, rz],
        [rx, rz + 1],
        [rx, rz - 1],
      ] as const;
      let bestDist = Infinity;
      for (const [cx, cz] of candidates) {
        const dx = cx - rawPos.x;
        const dz = cz - rawPos.z;
        const d = dx * dx + dz * dz;
        if (d < bestDist) {
          bestDist = d;
          rx = cx;
          rz = cz;
        }
      }
    }

    if (this.#isBenchCenter(rx, rz)) {
      const corners = [
        [rx + 1, rz + 1],
        [rx + 1, rz - 1],
        [rx - 1, rz + 1],
        [rx - 1, rz - 1],
      ] as const;
      let bestDist = Infinity;
      let bestX = rx;
      let bestZ = rz;
      for (const [cx, cz] of corners) {
        const dx = cx - playerPos.x;
        const dz = cz - playerPos.z;
        const d = dx * dx + dz * dz;
        if (d < bestDist) {
          bestDist = d;
          bestX = cx;
          bestZ = cz;
        }
      }
      rx = bestX;
      rz = bestZ;
    }

    return this.#tempDropPos.set(rx, rawPos.y, rz);
  }

  #hasResourceOnTop(obj: LevelObject): boolean {
    return this.#objectsWithResources.has(obj);
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

      // Package phone anywhere: drop phone on open package or open package on phone
      if (target instanceof DroppedResource) {
        const carriedIsPhone = carriedType === 'phone' && carriedState === 'repaired';
        const targetIsOpenPkg = target.getResourceType() === 'package' && target.getState() === 'broken';
        const carriedIsOpenPkg = carriedType === 'package' && carriedState === 'broken';
        const targetIsPhone = target.getResourceType() === 'phone' && target.getState() === 'repaired';

        if ((carriedIsPhone && targetIsOpenPkg) || (carriedIsOpenPkg && targetIsPhone)) {
          const parent = this.#getParentObject(target) ?? undefined;
          const targetPos = target.getPosition() ?? player.getPosition();
          if (!targetPos) return;

          player.dropResource();
          this.removeDroppedResource(target);

          // Phone on a BlueWorkZone: mirror the BlueWorkZone path
          if (parent instanceof BlueWorkZone && parent.isAwaitingPackaging()) {
            parent.clearAwaitingPackaging();
            player.grabResource('package', 'repaired');
            this.#onboardingManager?.onPackageFilled();
            return;
          }

          const closedPkg = new DroppedResource({
            resourceType: 'package',
            position: targetPos,
            onTopOf: parent,
            state: 'repaired',
          });
          closedPkg.create(this.#levelGroup);
          this.addDroppedResource(closedPkg, parent);
          this.#onboardingManager?.onPackageFilled();
          return;
        }
      }

      // Delivery zone: only accept closed packages
      if (target instanceof DeliveryZone && carriedType === 'package' && carriedState === 'repaired') {
        player.dropResource();
        const result = this.#orderManager.completeNextOrder();
        const zoneCenter = target.getZoneCenter();
        if (zoneCenter) {
          const model = Resources.getInstance().getGLTFAsset('packageClosedModel');
          if (model) {
            const mesh = model.scene.clone();
            mesh.position.set(zoneCenter.x, 1, zoneCenter.z);
            mesh.scale.setScalar(1.2);
            this.#levelGroup.add(mesh);
            this.#deliveryAnims.push({ mesh, timer: 0, points: result?.totalPoints ?? 0 });
          }
        }
        this.#onboardingManager?.onDeliveryCompleted();
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

        // Auto-grab closed package
        player.grabResource('package', 'repaired');
        this.#onboardingManager?.onPackageFilled();
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
            skipIcon: true,
          });
          resource.create(this.#levelGroup);
          this.addDroppedResource(resource, target);
          target.setResource(resource);
          if (target.isReadyToAssemble()) {
            this.#onboardingManager?.onBlueWorkZoneFilled();
          }
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
        if (target instanceof RepairZone) {
          target.hideScrewdriver();
          const repairZonePos = target.getPosition();
          if (repairZonePos) {
            this.#onboardingManager?.onResourceDroppedOnRepairZone(repairZonePos);
          }
        }
      } else {
        const facing = player.getFacingDirection();
        const rawDropPos = this.#tempDropPos.copy(playerPos).addScaledVector(facing, 1.0);
        const dropPos = this.#snapDropPosition(rawDropPos, playerPos);
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
          if (target.getResourceType() === 'phone' && parent.isAwaitingPackaging()) {
            parent.clearAwaitingPackaging();
          } else {
            parent.removeResource(target);
          }
        } else if (parent instanceof RepairZone) {
          parent.showScrewdriver();
        }

        this.removeDroppedResource(target);
        this.#currentTargets.set(playerId, null);
        if (target.getResourceType() === 'phone' && target.getState() === 'repaired') {
          const openPkgPositions: Vector3[] = [];
          for (const resource of this.#droppedResources) {
            if (resource.getResourceType() === 'package' && resource.getState() === 'broken') {
              const pos = resource.getPosition();
              if (pos) openPkgPositions.push(pos);
            }
          }
          this.#onboardingManager?.onPhoneGrabbed(openPkgPositions);
        }
      } else if (target instanceof Crate) {
        const resourceType = target.getResourceType();
        player.grabResource(resourceType, 'broken');
        target.openLid();

        if (resourceType === 'package') {
          const droppedPhonePositions: Vector3[] = [];
          for (const resource of this.#droppedResources) {
            if (resource.getResourceType() === 'phone' && resource.getState() === 'repaired') {
              const pos = resource.getPosition();
              if (pos) droppedPhonePositions.push(pos);
            }
          }
          this.#onboardingManager?.onPackageGrabbed(droppedPhonePositions);
        } else {
          this.#onboardingManager?.onResourceGrabbed();
        }
      }
    }
  }

  #updateHoldInteractions(): void {
    // Clear and reuse sets to track objects worked on this frame
    this.#activeRepairTargets.clear();

    for (const player of this.#players) {
      const playerId = player.getPlayerId();
      const inputSource = this.#gamepadManager.getInputSource(playerId);
      if (!inputSource) continue;

      const isHoldingX = inputSource.getButtonHoldDuration('x') > 0;
      const target = this.#currentTargets.get(playerId) ?? null;

      // Stop repair animation when X is released or no target
      if ((!isHoldingX || !target) && player.isRepairing) {
        player.stopRepairing();
        this.#repairingPlayers.delete(playerId);
      }

      if (!isHoldingX || !target) continue;

      // Repair interaction: X on broken resource sitting on a RepairZone
      if (target instanceof DroppedResource && target.getState() === 'broken') {
        const parentObject = this.#getParentObject(target);
        if (parentObject instanceof RepairZone) {
          // Only add progress once per object per frame (no coop bonus)
          if (!this.#activeRepairTargets.has(target)) {
            this.#activeRepairTargets.add(target);
          }

          target.getOrCreateProgressBar(this.#levelGroup);

          // Start repair animation if not already repairing
          if (!player.isRepairing) {
            const screwdriverModel = Resources.getInstance().getGLTFAsset('screwdriverModel');
            const repairZonePos = target.getPosition();
            if (screwdriverModel && repairZonePos) {
              const screwdriver = screwdriverModel.scene.clone();
              this.#repairingPlayers.add(playerId);
              const progressPerHit = REPAIR_HOLD_DURATION / REPAIR_HIT_COUNT;
              player.startRepairing(
                () => {
                  // On each hit: add discrete chunk of progress
                  target.addRepairProgress(progressPerHit);
                  target.updateProgressBar(target.getRepairProgress() / REPAIR_HOLD_DURATION);

                  if (target.isRepairComplete(REPAIR_HOLD_DURATION)) {
                    target.repair();
                    target.resetRepairProgress();
                    player.stopRepairing();
                    this.#repairingPlayers.delete(playerId);
                    this.#onboardingManager?.onResourceRepaired();
                  }
                },
                screwdriver,
                repairZonePos,
              );
            }
          }
        }
      }
    }
  }

  #updateAutoAssembly(): void {
    const deltaMs = Time.getInstance().delta;
    for (const obj of this.#interactables) {
      if (!(obj instanceof BlueWorkZone)) continue;
      if (!obj.isReadyToAssemble()) continue;

      obj.addAssemblyProgress(deltaMs);
      obj.updateAnimation(deltaMs);
      obj.getOrCreateProgressBar(this.#levelGroup);
      obj.updateProgressBar(obj.getAssemblyProgress() / ASSEMBLE_HOLD_DURATION);

      if (obj.isAssemblyComplete(ASSEMBLE_HOLD_DURATION)) {
        const removedResources = obj.assemble();
        for (const res of removedResources) {
          this.removeDroppedResource(res);
        }

        const targetPos = obj.getPosition();
        if (targetPos) {
          const phone = new DroppedResource({
            resourceType: 'phone',
            position: targetPos,
            onTopOf: obj,
            state: 'repaired',
            skipIcon: true,
          });
          phone.create(this.#levelGroup);
          this.addDroppedResource(phone, obj);
          obj.setAwaitingPackaging(phone);
          obj.showPhoneIcon();
          this.#onboardingManager?.onPhoneAssembled();
        }
      }
    }
  }

  update(): void {
    const dt = Time.getInstance().delta * 0.001;
    for (let i = this.#deliveryAnims.length - 1; i >= 0; i--) {
      const anim = this.#deliveryAnims[i]!;
      anim.timer += dt;
      if (anim.timer >= DELIVERY_ANIM_DURATION) {
        this.#smokeSystem.spawnImpact(anim.mesh.position, DELIVERY_SMOKE_COUNT);
        this.#pointsPopAnims.push(new PointsPopAnimation(this.#levelGroup, anim.mesh.position, anim.points));
        anim.mesh.removeFromParent();
        this.#deliveryAnims.splice(i, 1);
      }
    }
    this.#smokeSystem.update(null, null, false);

    for (let i = this.#pointsPopAnims.length - 1; i >= 0; i--) {
      if (this.#pointsPopAnims[i]!.update(dt)) {
        this.#pointsPopAnims.splice(i, 1);
      }
    }

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
    this.#updateAutoAssembly();
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
      if (obj instanceof DroppedResource) {
        const parent = this.#getParentObject(obj);
        if (parent instanceof BlueWorkZone) {
          const resourceType = obj.getResourceType();
          if (resourceType !== 'phone' && resourceType !== 'package') {
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
          } else if (carriedType && carriedState && obj.canAcceptPackage(carriedType, carriedState)) {
            // Allow targeting for packaging
          } else {
            continue;
          }
        } else {
          continue;
        }
      }

      // For DroppedResources on a bench, use the parent's closest point so
      // distance/facing are measured from the bench edge (same as the bench
      // itself), not from the resource's own centre which may be far away.
      const proxyObj = obj instanceof DroppedResource ? (this.#getParentObject(obj) ?? obj) : obj;
      const objPos = proxyObj.getClosestPoint(playerPos);
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

      const score = -distanceXZ + priorityBonus;
      if (score > bestScore) {
        bestScore = score;
        bestTarget = obj;
      }
    }

    return bestTarget;
  }
}
