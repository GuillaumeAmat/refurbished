export class SessionManager extends EventTarget {
  static readonly DURATION = 150; // 2:30
  static #instance: SessionManager | null = null;

  #remaining = SessionManager.DURATION;
  #intervalId: number | null = null;

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
    if (this.#intervalId !== null) return;

    this.#intervalId = window.setInterval(() => {
      this.#remaining--;
      this.dispatchEvent(new CustomEvent('timeChanged', { detail: { remaining: this.#remaining } }));

      if (this.#remaining <= 0) {
        this.stop();
        this.dispatchEvent(new CustomEvent('sessionEnded'));
      }
    }, 1000);
  }

  public stop(): void {
    if (this.#intervalId !== null) {
      window.clearInterval(this.#intervalId);
      this.#intervalId = null;
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
}
