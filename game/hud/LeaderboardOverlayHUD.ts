import { Group } from 'three';

import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import { HUDBackdrop } from './HUDBackdrop';
import type { IHUDItem } from './IHUDItem';

export class LeaderboardOverlayHUD implements IHUDItem {
  static readonly OVERLAY_HEIGHT = 1.4;
  static readonly TITLE_HEIGHT = 0.15;
  static readonly SCORE_HEIGHT = 0.08;
  static readonly BUTTON_HEIGHT = 0.08;

  #group: Group;
  #backdrop: HUDBackdrop;
  #titleText: TextPlaneResult | null = null;
  #scoresText: TextPlaneResult | null = null;
  #backText: TextPlaneResult | null = null;

  constructor() {
    this.#group = new Group();
    this.#backdrop = new HUDBackdrop(4, LeaderboardOverlayHUD.OVERLAY_HEIGHT);
    this.#group.add(this.#backdrop.getGroup());
    this.#createContent();
  }

  #createContent() {
    this.#titleText = createTextPlane('Leaderboard', {
      height: LeaderboardOverlayHUD.TITLE_HEIGHT,
      fontSize: 72,
      color: '#FBD954',
    });
    this.#titleText.mesh.position.y = 0.55;
    this.#group.add(this.#titleText.mesh);

    this.#scoresText = createTextPlane(
      'Loading...',
      {
        height: LeaderboardOverlayHUD.SCORE_HEIGHT,
        fontSize: 36,
        color: '#FFFFFF',
      },
    );
    this.#scoresText.mesh.position.y = 0.1;
    this.#group.add(this.#scoresText.mesh);

    this.#backText = createTextPlane('> Main menu', {
      height: LeaderboardOverlayHUD.BUTTON_HEIGHT,
      fontSize: 40,
      color: '#FBD954',
    });
    this.#backText.mesh.position.y = -0.55;
    this.#group.add(this.#backText.mesh);
  }

  getGroup(): Group {
    return this.#group;
  }

  getHeight(): number {
    return LeaderboardOverlayHUD.OVERLAY_HEIGHT;
  }

  show() {
    this.#group.visible = true;
    this.#fetchScores();
  }

  async #fetchScores() {
    try {
      const res = await fetch('/api/scores?limit=5');
      const data = (await res.json()) as { player1: string; player2: string; score: number; rank: number }[];

      if (data.length > 0) {
        const text = data.map((e) => `${e.rank}. ${e.player1} & ${e.player2} — ${e.score}`).join('\n');
        this.#scoresText?.updateText(text);
      } else {
        this.#scoresText?.updateText('No scores yet');
      }
    } catch {
      // Keep hardcoded fallback on error
    }
  }

  hide() {
    this.#group.visible = false;
  }

  update() {}

  dispose() {
    this.#backdrop.dispose();
    this.#titleText?.dispose();
    this.#scoresText?.dispose();
    this.#backText?.dispose();
  }
}
