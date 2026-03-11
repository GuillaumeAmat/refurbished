import { type Group, Vector3 } from 'three';

import { Time } from '../util/Time';
import { BlueWorkZone } from './object/BlueWorkZone';
import { Crate } from './object/Crate';
import { DeliveryZone } from './object/DeliveryZone';
import type { LevelObject } from './object/LevelObject';
import { RepairZone } from './object/RepairZone';
import { OnboardingHighlight } from './OnboardingHighlight';

enum Step {
  IDLE,
  HIGHLIGHT_CRATES,
  HIGHLIGHT_REPAIR_ZONES,
  HIGHLIGHT_BLUE_WORK_ZONE,
  HIGHLIGHT_PACKAGE_CRATE,
  HIGHLIGHT_PHONE,
  HIGHLIGHT_DELIVERY_ZONE,
  DONE,
}

export class OnboardingManager {
  #parent: Group;
  #highlights: OnboardingHighlight[] = [];
  #step = Step.IDLE;

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
    console.log('[Onboarding] start — crates:', this.#resourceCrates.length);
    this.#setStep(Step.HIGHLIGHT_CRATES);
  }

  onResourceGrabbed(): void {
    if (this.#step === Step.HIGHLIGHT_CRATES) {
      this.#setStep(Step.HIGHLIGHT_REPAIR_ZONES);
    }
  }

  onResourceRepaired(): void {
    if (this.#step === Step.HIGHLIGHT_REPAIR_ZONES) {
      this.#setStep(Step.HIGHLIGHT_BLUE_WORK_ZONE);
    }
  }

  onPhoneAssembled(): void {
    if (this.#step === Step.HIGHLIGHT_BLUE_WORK_ZONE) {
      this.#setStep(Step.HIGHLIGHT_PACKAGE_CRATE);
    }
  }

  onPackageGrabbed(phonePosition: Vector3): void {
    if (this.#step === Step.HIGHLIGHT_PACKAGE_CRATE) {
      this.#disposeHighlights();
      this.#step = Step.HIGHLIGHT_PHONE;
      this.#highlights.push(
        new OnboardingHighlight(this.#parent, phonePosition.x, phonePosition.y * 2, phonePosition.z),
      );
    }
  }

  onPackageFilled(): void {
    if (this.#step === Step.HIGHLIGHT_PHONE) {
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
    for (const h of this.#highlights) {
      h.update(deltaMs);
    }
  }

  dispose(): void {
    this.#disposeHighlights();
    this.#step = Step.DONE;
  }

  #setStep(step: Step): void {
    this.#disposeHighlights();
    this.#step = step;

    const positions = this.#getPositionsForStep(step);
    console.log('[Onboarding] step', Step[step], '— positions:', positions.map(p => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})`));
    for (const pos of positions) {
      this.#highlights.push(new OnboardingHighlight(this.#parent, pos.x, pos.y, pos.z));
    }
  }

  #getPositionsForStep(step: Step): Vector3[] {
    switch (step) {
      case Step.HIGHLIGHT_CRATES:
        return this.#collectPositions(this.#resourceCrates);
      case Step.HIGHLIGHT_REPAIR_ZONES:
        return this.#collectPositions(this.#repairZones);
      case Step.HIGHLIGHT_BLUE_WORK_ZONE:
        return this.#collectPositions(this.#blueWorkZones);
      case Step.HIGHLIGHT_PACKAGE_CRATE:
        return this.#collectPositions(this.#packageCrates);
      case Step.HIGHLIGHT_DELIVERY_ZONE:
        return this.#collectPositions(this.#deliveryZones);
      default:
        return [];
    }
  }

  #collectPositions(objects: LevelObject[]): Vector3[] {
    const result: Vector3[] = [];
    for (const obj of objects) {
      const pos = obj.getPosition();
      if (pos) {
        // getPosition() returns bounding box center; double Y to estimate top
        result.push(new Vector3(pos.x, pos.y * 2, pos.z));
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
