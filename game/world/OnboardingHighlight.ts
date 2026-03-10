import type { Group } from 'three';

import { OnboardingRing } from './OnboardingRing';

const SPAWN_INTERVAL = 1000;

export class OnboardingHighlight {
  #parent: Group;
  #x: number;
  #y: number;
  #z: number;
  #rings: OnboardingRing[] = [];
  #timeSinceSpawn = SPAWN_INTERVAL; // spawn first ring immediately

  constructor(parent: Group, x: number, y: number, z: number) {
    this.#parent = parent;
    this.#x = x;
    this.#y = y;
    this.#z = z;
  }

  update(deltaMs: number): void {
    this.#timeSinceSpawn += deltaMs;

    if (this.#timeSinceSpawn >= SPAWN_INTERVAL) {
      this.#timeSinceSpawn = 0;
      this.#rings.push(new OnboardingRing(this.#parent, this.#x, this.#y, this.#z));
    }

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
