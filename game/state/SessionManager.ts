import { Time } from '../util/Time';

export class SessionManager extends EventTarget {
  static readonly DURATION = 215; // 3:35, but overriden by the level track length in Stage.ts
  static #instance: SessionManager | null = null;

  #remaining = SessionManager.DURATION;
  #accumulator = 0;
  #running = false;
  #onTick: (() => void) | null = null;

  private constructor() {
    super();
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.#instance) {
      SessionManager.#instance = new SessionManager();
    }
    return SessionManager.#instance;
  }

  public start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#accumulator = 0;

    const time = Time.getInstance();
    this.#onTick = () => {
      this.#accumulator += time.delta;

      while (this.#accumulator >= 1000) {
        this.#accumulator -= 1000;
        this.#remaining--;
        this.dispatchEvent(new CustomEvent('timeChanged', { detail: { remaining: this.#remaining } }));

        if (this.#remaining <= 0) {
          this.stop();
          this.dispatchEvent(new CustomEvent('sessionEnded'));
          return;
        }
      }
    };

    time.addEventListener('tick', this.#onTick);
  }

  public stop(): void {
    if (!this.#running) return;
    this.#running = false;

    if (this.#onTick) {
      Time.getInstance().removeEventListener('tick', this.#onTick);
      this.#onTick = null;
    }
  }

  public reset(): void {
    this.stop();
    this.#remaining = SessionManager.DURATION;
    this.dispatchEvent(new CustomEvent('timeChanged', { detail: { remaining: this.#remaining } }));
  }

  public getRemainingTime(): number {
    return this.#remaining;
  }

  public setDuration(seconds: number): void {
    this.#remaining = seconds;
    this.dispatchEvent(new CustomEvent('timeChanged', { detail: { remaining: this.#remaining } }));
  }
}
