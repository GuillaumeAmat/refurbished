export class ScoreManager extends EventTarget {
  static #instance: ScoreManager | null = null;

  #score = 0;

  private constructor() {
    super();
  }

  public static getInstance(): ScoreManager {
    if (!ScoreManager.#instance) {
      ScoreManager.#instance = new ScoreManager();
    }
    return ScoreManager.#instance;
  }

  public getScore(): number {
    return this.#score;
  }

  public addPoints(points: number): void {
    this.#score += points;
    this.dispatchEvent(new CustomEvent('scoreChanged', { detail: { score: this.#score } }));
  }

  public reset(): void {
    this.#score = 0;
    this.dispatchEvent(new CustomEvent('scoreChanged', { detail: { score: this.#score } }));
  }
}
