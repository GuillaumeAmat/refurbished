export class ScoreManager extends EventTarget {
  static #instance: ScoreManager | null = null;

  #score = 0;
  #player1Name = '';
  #player2Name = '';
  #sessionToken: string | null = null;
  #pendingEvents = 0;

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
    this.#score = Math.max(0, this.#score + points);
    this.dispatchEvent(new CustomEvent('scoreChanged', { detail: { score: this.#score } }));
    void this.#reportEvent(points);
  }

  async #reportEvent(delta: number): Promise<void> {
    const token = this.#sessionToken;
    if (!token) return;
    this.#pendingEvents++;
    try {
      await fetch('/api/game/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, delta }),
      });
    } catch {
      // ignore
    } finally {
      this.#pendingEvents--;
    }
  }

  public flushEvents(): Promise<void> {
    if (this.#pendingEvents === 0) return Promise.resolve();
    return new Promise((resolve) => {
      const check = () => {
        if (this.#pendingEvents === 0) resolve();
        else setTimeout(check, 50);
      };
      check();
    });
  }

  public getPlayerNames(): { player1: string; player2: string } {
    return { player1: this.#player1Name, player2: this.#player2Name };
  }

  public setPlayerName(playerId: 1 | 2, name: string): void {
    if (playerId === 1) this.#player1Name = name;
    else this.#player2Name = name;
  }

  public setSessionToken(token: string): void {
    this.#sessionToken = token;
  }

  public getSessionToken(): string | null {
    return this.#sessionToken;
  }

  public reset(): void {
    this.#score = 0;
    this.#player1Name = '';
    this.#player2Name = '';
    this.#sessionToken = null;
    this.dispatchEvent(new CustomEvent('scoreChanged', { detail: { score: this.#score } }));
  }
}
