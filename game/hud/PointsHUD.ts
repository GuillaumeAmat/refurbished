import { Group } from 'three';

import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import { ScoreManager } from '../state/ScoreManager';
import type { IHUDItem } from './IHUDItem';

export class PointsHUD implements IHUDItem {
  static readonly TEXT_HEIGHT = 0.08;

  #group: Group;
  #text: TextPlaneResult | null = null;
  #scoreManager: ScoreManager;
  #onScoreChanged: EventListener;

  constructor() {
    this.#group = new Group();
    this.#scoreManager = ScoreManager.getInstance();
    this.#createText();

    this.#onScoreChanged = ((event: CustomEvent) => {
      this.#updateScore(event.detail.score);
    }) as EventListener;
    this.#scoreManager.addEventListener('scoreChanged', this.#onScoreChanged);
  }

  #createText() {
    const score = this.#scoreManager.getScore();
    this.#text = createTextPlane(`Points: ${score}`, {
      height: PointsHUD.TEXT_HEIGHT,
      fontSize: 48,
      color: '#000000',
    });
    // Left-align: offset by width/2 so text extends to the right
    this.#text.mesh.position.x = this.#text.width / 2;
    this.#group.add(this.#text.mesh);
  }

  #updateScore(score: number) {
    if (this.#text) {
      this.#text.updateText(`Points: ${score}`);
      this.#text.mesh.position.x = this.#text.width / 2;
    }
  }

  getGroup(): Group {
    return this.#group;
  }

  getHeight(): number {
    return PointsHUD.TEXT_HEIGHT;
  }

  show() {
    this.#group.visible = true;
  }

  hide() {
    this.#group.visible = false;
  }

  update() {}

  dispose() {
    this.#scoreManager.removeEventListener('scoreChanged', this.#onScoreChanged);
    this.#text?.dispose();
  }
}
