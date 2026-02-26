import { COMBO_MAX_MULTIPLIER } from '../constants';

export class ComboManager extends EventTarget {
  static #instance: ComboManager | null = null;
  #count = 0;

  private constructor() {
    super();
  }

  public static getInstance(): ComboManager {
    if (!ComboManager.#instance) {
      ComboManager.#instance = new ComboManager();
    }
    return ComboManager.#instance;
  }

  public increment(): void {
    this.#count++;
    this.dispatchEvent(new CustomEvent('comboChanged', { detail: { combo: this.#count, multiplier: this.getMultiplier() } }));
  }

  public resetCombo(): void {
    if (this.#count === 0) return;
    this.#count = 0;
    this.dispatchEvent(new CustomEvent('comboChanged', { detail: { combo: this.#count, multiplier: this.getMultiplier() } }));
  }

  public getMultiplier(): number {
    return Math.min(this.#count, COMBO_MAX_MULTIPLIER);
  }

  public getCount(): number {
    return this.#count;
  }

  public reset(): void {
    this.#count = 0;
    this.dispatchEvent(new CustomEvent('comboChanged', { detail: { combo: 0, multiplier: 1 } }));
  }
}
