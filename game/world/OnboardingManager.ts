import { type Group, Vector3 } from 'three';

import { Time } from '../util/Time';
import type { OnboardingIconType, ResourceType } from '../types';
import { BlueWorkZone } from './object/BlueWorkZone';
import { Crate } from './object/Crate';
import { DeliveryZone } from './object/DeliveryZone';
import type { LevelObject } from './object/LevelObject';
import { RepairZone } from './object/RepairZone';
import { OnboardingHighlight } from './OnboardingHighlight';

enum Step {
  IDLE,
  HIGHLIGHT_CRATES, // 1: start
  HIGHLIGHT_REPAIR_ZONES, // 2: first resource grabbed
  HIGHLIGHT_BLUE_WORK_ZONE, // 3: first resource repaired
  HIGHLIGHT_PACKAGE_CRATE, // 4: BWZ fully filled (assembling starts)
  HIGHLIGHT_BWZ_POST_ASSEMBLY, // 5: first phone assembled
  HIGHLIGHT_BWZ_OR_PHONE, // 6: first package grabbed
  HIGHLIGHT_PKG_OR_OPEN_PKG, // 7: first phone grabbed
  HIGHLIGHT_DELIVERY_ZONE, // 8: first closed package made
  DONE,
}

export class OnboardingManager {
  #parent: Group;
  #highlights: OnboardingHighlight[] = [];
  #step = Step.IDLE;
  #startTimer: ReturnType<typeof setTimeout> | null = null;
  #startRaf: number | null = null;
  #lastGrabbedResourceType: ResourceType | null = null;

  #resourceCrates: Crate[] = [];
  #packageCrates: Crate[] = [];
  #repairZones: RepairZone[] = [];
  #blueWorkZones: BlueWorkZone[] = [];
  #deliveryZones: DeliveryZone[] = [];

  constructor(parent: Group, interactables: LevelObject[]) {
    this.#parent = parent;

    for (const obj of interactables) {
      if (obj instanceof Crate) {
        if (obj.getResourceType() === 'package') {
          this.#packageCrates.push(obj);
        } else {
          this.#resourceCrates.push(obj);
        }
      } else if (obj instanceof RepairZone) {
        this.#repairZones.push(obj);
      } else if (obj instanceof BlueWorkZone) {
        this.#blueWorkZones.push(obj);
      } else if (obj instanceof DeliveryZone) {
        this.#deliveryZones.push(obj);
      }
    }
  }

  start(): void {
    this.#startTimer = setTimeout(() => {
      this.#startRaf = requestAnimationFrame(() => this.#setStep(Step.HIGHLIGHT_CRATES));
    }, 2000);
  }

  onResourceGrabbed(resourceType: ResourceType): void {
    if (this.#step === Step.HIGHLIGHT_CRATES) {
      this.#lastGrabbedResourceType = resourceType;
      this.#setStep(Step.HIGHLIGHT_REPAIR_ZONES);
    }
  }

  onRepairStarted(): void {
    for (const h of this.#highlights) h.hideMarker();
  }

  onResourceDroppedOnRepairZone(pos: Vector3): void {
    if (this.#step === Step.HIGHLIGHT_REPAIR_ZONES) {
      this.#disposeHighlights();
      this.#highlights.push(new OnboardingHighlight(this.#parent, pos.x, pos.y * 2, pos.z, 'button-x'));
    }
  }

  onResourceRepaired(resourceType: ResourceType): void {
    if (this.#step === Step.HIGHLIGHT_REPAIR_ZONES) {
      this.#lastGrabbedResourceType = resourceType;
      this.#setStep(Step.HIGHLIGHT_BLUE_WORK_ZONE);
    }
  }

  onBlueWorkZoneFilled(): void {
    if (this.#step === Step.HIGHLIGHT_BLUE_WORK_ZONE) {
      this.#disposeHighlights();
      this.#step = Step.HIGHLIGHT_PACKAGE_CRATE;
    }
  }

  onPhoneAssembled(): void {
    if (this.#step === Step.HIGHLIGHT_PACKAGE_CRATE) {
      this.#disposeHighlights();
      this.#step = Step.HIGHLIGHT_BWZ_POST_ASSEMBLY;
    }
  }

  onPackageGrabbed(droppedPhonePositions: Vector3[]): void {
    if (
      this.#step === Step.HIGHLIGHT_PACKAGE_CRATE ||
      this.#step === Step.HIGHLIGHT_BWZ_POST_ASSEMBLY ||
      this.#step === Step.HIGHLIGHT_BWZ_OR_PHONE ||
      this.#step === Step.HIGHLIGHT_PKG_OR_OPEN_PKG
    ) {
      this.#disposeHighlights();
      this.#step = Step.HIGHLIGHT_BWZ_OR_PHONE;
      for (const pos of droppedPhonePositions) {
        this.#highlights.push(new OnboardingHighlight(this.#parent, pos.x, pos.y * 2, pos.z, 'phone'));
      }
    }
  }

  onPhoneGrabbed(openPkgPositions: Vector3[]): void {
    if (this.#step === Step.HIGHLIGHT_BWZ_POST_ASSEMBLY || this.#step === Step.HIGHLIGHT_BWZ_OR_PHONE) {
      this.#disposeHighlights();
      this.#step = Step.HIGHLIGHT_PKG_OR_OPEN_PKG;
      if (openPkgPositions.length > 0) {
        for (const pos of openPkgPositions) {
          this.#highlights.push(new OnboardingHighlight(this.#parent, pos.x, pos.y * 2, pos.z, 'packageOpen'));
        }
      } else {
        for (const pos of this.#collectPositions(this.#packageCrates)) {
          this.#highlights.push(new OnboardingHighlight(this.#parent, pos.x, pos.y, pos.z, 'packageOpen'));
        }
      }
    }
  }

  onPackageFilled(): void {
    if (
      this.#step === Step.HIGHLIGHT_BWZ_POST_ASSEMBLY ||
      this.#step === Step.HIGHLIGHT_BWZ_OR_PHONE ||
      this.#step === Step.HIGHLIGHT_PKG_OR_OPEN_PKG
    ) {
      this.#setStep(Step.HIGHLIGHT_DELIVERY_ZONE);
    }
  }

  onDeliveryCompleted(): void {
    if (this.#step === Step.HIGHLIGHT_DELIVERY_ZONE) {
      this.#setStep(Step.DONE);
    }
  }

  update(): void {
    if (this.#step === Step.IDLE || this.#step === Step.DONE) return;
    const deltaMs = Time.getInstance().delta;
    for (let i = this.#highlights.length - 1; i >= 0; i--) {
      this.#highlights[i]!.update(deltaMs);
      if (this.#highlights[i]!.isDone()) {
        this.#highlights[i]!.dispose();
        this.#highlights.splice(i, 1);
      }
    }
  }

  dispose(): void {
    if (this.#startTimer !== null) {
      clearTimeout(this.#startTimer);
      this.#startTimer = null;
    }
    if (this.#startRaf !== null) {
      cancelAnimationFrame(this.#startRaf);
      this.#startRaf = null;
    }
    this.#disposeHighlights();
    this.#step = Step.DONE;
  }

  #getIconForStep(step: Step): OnboardingIconType {
    const rt = this.#lastGrabbedResourceType;
    switch (step) {
      case Step.HIGHLIGHT_CRATES:
        return 'button-a';
      case Step.HIGHLIGHT_REPAIR_ZONES:
        if (rt === 'battery') return 'batteryBroken';
        if (rt === 'frame') return 'frameBroken';
        if (rt === 'screen') return 'screenBroken';
        return 'batteryBroken';
      case Step.HIGHLIGHT_BLUE_WORK_ZONE:
        if (rt === 'battery') return 'batteryRepaired';
        if (rt === 'frame') return 'frameRepaired';
        if (rt === 'screen') return 'screenRepaired';
        return 'batteryRepaired';
      case Step.HIGHLIGHT_PACKAGE_CRATE:
        return 'packageOpen';
      case Step.HIGHLIGHT_BWZ_POST_ASSEMBLY:
        return 'phone';
      case Step.HIGHLIGHT_BWZ_OR_PHONE:
        return 'phone';
      case Step.HIGHLIGHT_PKG_OR_OPEN_PKG:
        return 'packageOpen';
      case Step.HIGHLIGHT_DELIVERY_ZONE:
        return 'packageClosed';
      default:
        return 'button-a';
    }
  }

  #setStep(step: Step): void {
    this.#disposeHighlights();
    this.#step = step;

    const icon = this.#getIconForStep(step);
    const positions = this.#getPositionsForStep(step);
    for (const pos of positions) {
      this.#highlights.push(new OnboardingHighlight(this.#parent, pos.x, pos.y, pos.z, icon));
    }
  }

  #getPositionsForStep(step: Step): Vector3[] {
    switch (step) {
      case Step.HIGHLIGHT_CRATES:
        return this.#collectPositions(this.#resourceCrates);
      case Step.HIGHLIGHT_REPAIR_ZONES:
        return this.#collectPositions(this.#repairZones);
      case Step.HIGHLIGHT_BLUE_WORK_ZONE:
        return this.#collectPositions(this.#blueWorkZones, 1);
      case Step.HIGHLIGHT_PACKAGE_CRATE:
        return this.#collectPositions(this.#packageCrates);
      case Step.HIGHLIGHT_BWZ_POST_ASSEMBLY:
        return this.#collectPositions(this.#blueWorkZones, 1);
      case Step.HIGHLIGHT_PKG_OR_OPEN_PKG:
        return this.#collectPositions(this.#packageCrates);
      case Step.HIGHLIGHT_DELIVERY_ZONE:
        return this.#collectPositions(this.#deliveryZones, 1);
      default:
        return [];
    }
  }

  #collectPositions(objects: LevelObject[], fixedY?: number): Vector3[] {
    const result: Vector3[] = [];
    for (const obj of objects) {
      const pos = obj.getPosition();
      if (pos) {
        // getPosition() returns bounding box center; double Y to estimate top
        result.push(new Vector3(pos.x, fixedY ?? pos.y * 2, pos.z));
      }
    }
    return result;
  }

  #disposeHighlights(): void {
    for (const h of this.#highlights) {
      h.dispose();
    }
    this.#highlights.length = 0;
  }
}
