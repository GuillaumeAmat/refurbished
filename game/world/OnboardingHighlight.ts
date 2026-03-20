import type { Group } from 'three';

import type { OnboardingIconType } from '../types';
import { OnboardingMarker } from './OnboardingMarker';
import { OnboardingRing } from './OnboardingRing';

export class OnboardingHighlight {
  #rings: OnboardingRing[] = [];
  #marker: OnboardingMarker;

  constructor(parent: Group, x: number, y: number, z: number, iconType: OnboardingIconType) {
    this.#rings.push(new OnboardingRing(parent, x, y, z));
    this.#marker = new OnboardingMarker(parent, x, y, z, iconType);
  }

  update(deltaMs: number): void {
    this.#marker.update(deltaMs);

    for (let i = this.#rings.length - 1; i >= 0; i--) {
      const done = this.#rings[i]!.update(deltaMs);
      if (done) {
        this.#rings[i]!.dispose();
        this.#rings.splice(i, 1);
      }
    }
  }

  dispose(): void {
    this.#marker.dispose();
    for (const ring of this.#rings) {
      ring.dispose();
    }
    this.#rings.length = 0;
  }
}
