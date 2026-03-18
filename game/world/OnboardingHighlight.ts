import type { Group } from 'three';

import { OnboardingRing } from './OnboardingRing';

export class OnboardingHighlight {
  #rings: OnboardingRing[] = [];

  constructor(parent: Group, x: number, y: number, z: number) {
    this.#rings.push(new OnboardingRing(parent, x, y, z));
  }

  update(deltaMs: number): void {
    for (let i = this.#rings.length - 1; i >= 0; i--) {
      const done = this.#rings[i]!.update(deltaMs);
      if (done) {
        this.#rings[i]!.dispose();
        this.#rings.splice(i, 1);
      }
    }
  }

  dispose(): void {
    for (const ring of this.#rings) {
      ring.dispose();
    }
    this.#rings.length = 0;
  }
}
