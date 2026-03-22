import type { Group } from 'three';

import type { OnboardingIconType } from '../types';
import { OnboardingMarker } from './OnboardingMarker';
import { OnboardingRing } from './OnboardingRing';

export class OnboardingHighlight {
  #rings: OnboardingRing[] = [];
  #marker: OnboardingMarker | null = null;

  constructor(parent: Group, x: number, y: number, z: number, iconType: OnboardingIconType, ringOnly = false) {
    this.#rings.push(new OnboardingRing(parent, x, y, z));
    if (!ringOnly) {
      this.#marker = new OnboardingMarker(parent, x, y, z, iconType);
    }
  }

  hideMarker(): void {
    this.#marker?.dispose();
    this.#marker = null;
  }

  isDone(): boolean {
    return this.#marker === null && this.#rings.length === 0;
  }

  update(deltaMs: number): void {
    this.#marker?.update(deltaMs);

    for (let i = this.#rings.length - 1; i >= 0; i--) {
      const done = this.#rings[i]!.update(deltaMs);
      if (done) {
        this.#rings[i]!.dispose();
        this.#rings.splice(i, 1);
      }
    }
  }

  dispose(): void {
    this.#marker?.dispose();
    this.#marker = null;
    for (const ring of this.#rings) {
      ring.dispose();
    }
    this.#rings.length = 0;
  }
}
