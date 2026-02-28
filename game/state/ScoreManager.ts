export class ScoreManager extends EventTarget {
  static #instance: ScoreManager | null = null;

  #score = 0;
  #player1Name = '';
  #player2Name = '';

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

  public getPlayerNames(): { player1: string; player2: string } {
    return { player1: this.#player1Name, player2: this.#player2Name };
  }

  public setPlayerName(playerId: 1 | 2, name: string): void {
    if (playerId === 1) this.#player1Name = name;
    else this.#player2Name = name;
  }

  public reset(): void {
    this.#score = 0;
    this.#player1Name = '';
    this.#player2Name = '';
    this.dispatchEvent(new CustomEvent('scoreChanged', { detail: { score: this.#score } }));
  }
}
