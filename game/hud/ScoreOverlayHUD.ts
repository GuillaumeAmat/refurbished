import { Group } from 'three';

import { STAR_THRESHOLDS } from '../constants';
import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import { ScoreManager } from '../state/ScoreManager';
import { HUDBackdrop } from './HUDBackdrop';
import type { IHUDItem } from './IHUDItem';

export class ScoreOverlayHUD implements IHUDItem {
  static readonly OVERLAY_HEIGHT = 1.8;
  static readonly TITLE_HEIGHT = 0.15;
  static readonly SCORE_HEIGHT = 0.12;
  static readonly STAR_HEIGHT = 0.1;
  static readonly LABEL_HEIGHT = 0.08;
  static readonly INPUT_HEIGHT = 0.1;
  static readonly BUTTON_HEIGHT = 0.08;

  #group: Group;
  #backdrop: HUDBackdrop;
  #titleText: TextPlaneResult | null = null;
  #scoreText: TextPlaneResult | null = null;
  #starsText: TextPlaneResult | null = null;
  #p1Label: TextPlaneResult | null = null;
  #p1Input: TextPlaneResult | null = null;
  #p2Label: TextPlaneResult | null = null;
  #p2Input: TextPlaneResult | null = null;
  #saveText: TextPlaneResult | null = null;
  #skipText: TextPlaneResult | null = null;
  #scoreManager: ScoreManager;

  #player1Name = '';
  #player2Name = '';
  #selectedOption: 'save' | 'skip' = 'save';
  #onSave: ((player1: string, player2: string) => void) | null = null;
  #onSkip: (() => void) | null = null;

  constructor() {
    this.#group = new Group();
    this.#scoreManager = ScoreManager.getInstance();

    this.#backdrop = new HUDBackdrop(3.5, ScoreOverlayHUD.OVERLAY_HEIGHT);
    this.#group.add(this.#backdrop.getGroup());

    this.#createContent();
  }

  #createContent() {
    const score = this.#scoreManager.getScore();

    // Title
    this.#titleText = createTextPlane('Game Over', {
      height: ScoreOverlayHUD.TITLE_HEIGHT,
      fontSize: 72,
      color: '#FBD954',
    });
    this.#titleText.mesh.position.y = 0.7;
    this.#group.add(this.#titleText.mesh);

    // Score
    this.#scoreText = createTextPlane(`Score: ${score}`, {
      height: ScoreOverlayHUD.SCORE_HEIGHT,
      fontSize: 56,
      color: '#FFFFFF',
    });
    this.#scoreText.mesh.position.y = 0.55;
    this.#group.add(this.#scoreText.mesh);

    // Stars
    this.#starsText = createTextPlane(this.#computeStars(score), {
      height: ScoreOverlayHUD.STAR_HEIGHT,
      fontSize: 48,
      color: '#FBD954',
    });
    this.#starsText.mesh.position.y = 0.4;
    this.#group.add(this.#starsText.mesh);

    // Player 1 label
    this.#p1Label = createTextPlane('Player 1:', {
      height: ScoreOverlayHUD.LABEL_HEIGHT,
      fontSize: 36,
      color: '#CCCCCC',
    });
    this.#p1Label.mesh.position.y = 0.22;
    this.#group.add(this.#p1Label.mesh);

    // Player 1 input
    this.#p1Input = createTextPlane('_', {
      height: ScoreOverlayHUD.INPUT_HEIGHT,
      fontSize: 48,
      color: '#FFFFFF',
    });
    this.#p1Input.mesh.position.y = 0.1;
    this.#group.add(this.#p1Input.mesh);

    // Player 2 label
    this.#p2Label = createTextPlane('Player 2:', {
      height: ScoreOverlayHUD.LABEL_HEIGHT,
      fontSize: 36,
      color: '#CCCCCC',
    });
    this.#p2Label.mesh.position.y = -0.05;
    this.#group.add(this.#p2Label.mesh);

    // Player 2 input
    this.#p2Input = createTextPlane('_', {
      height: ScoreOverlayHUD.INPUT_HEIGHT,
      fontSize: 48,
      color: '#FFFFFF',
    });
    this.#p2Input.mesh.position.y = -0.17;
    this.#group.add(this.#p2Input.mesh);

    // Save button
    this.#saveText = createTextPlane('> Save', {
      height: ScoreOverlayHUD.BUTTON_HEIGHT,
      fontSize: 40,
      color: '#FBD954',
    });
    this.#saveText.mesh.position.set(0, -0.38, 0);
    this.#group.add(this.#saveText.mesh);

    // Skip button
    this.#skipText = createTextPlane('  Skip', {
      height: ScoreOverlayHUD.BUTTON_HEIGHT,
      fontSize: 40,
      color: '#888888',
    });
    this.#skipText.mesh.position.set(0, -0.53, 0);
    this.#group.add(this.#skipText.mesh);
  }

  #computeStars(score: number): string {
    let count = 0;
    for (const threshold of STAR_THRESHOLDS) {
      if (score >= threshold) count++;
    }
    return '\u2605'.repeat(count) + '\u2606'.repeat(STAR_THRESHOLDS.length - count);
  }

  updateScore() {
    const score = this.#scoreManager.getScore();
    this.#scoreText?.updateText(`Score: ${score}`);
    this.#starsText?.updateText(this.#computeStars(score));
  }

  setSelectedOption(option: 'save' | 'skip') {
    this.#selectedOption = option;
    if (option === 'save') {
      this.#saveText?.updateText('> Save');
      this.#saveText?.updateColor('#FBD954');
      this.#skipText?.updateText('  Skip');
      this.#skipText?.updateColor('#888888');
    } else {
      this.#saveText?.updateText('  Save');
      this.#saveText?.updateColor('#888888');
      this.#skipText?.updateText('> Skip');
      this.#skipText?.updateColor('#FBD954');
    }
  }

  getSelectedOption(): 'save' | 'skip' {
    return this.#selectedOption;
  }

  setPlayerName(playerId: 1 | 2, name: string) {
    const display = name.length > 0 ? name : '_';
    if (playerId === 1) {
      this.#player1Name = name;
      this.#p1Input?.updateText(display);
    } else {
      this.#player2Name = name;
      this.#p2Input?.updateText(display);
    }
  }

  getPlayerName(playerId: 1 | 2): string {
    return playerId === 1 ? this.#player1Name : this.#player2Name;
  }

  onSave(callback: (player1: string, player2: string) => void) {
    this.#onSave = callback;
  }

  onSkip(callback: () => void) {
    this.#onSkip = callback;
  }

  triggerSave() {
    this.#onSave?.(this.#player1Name, this.#player2Name);
  }

  triggerSkip() {
    this.#onSkip?.();
  }

  reset() {
    this.#player1Name = '';
    this.#player2Name = '';
    this.#selectedOption = 'save';
    this.setPlayerName(1, '');
    this.setPlayerName(2, '');
    this.setSelectedOption('save');
    this.updateScore();
  }

  getGroup(): Group {
    return this.#group;
  }

  getHeight(): number {
    return ScoreOverlayHUD.OVERLAY_HEIGHT;
  }

  show() {
    this.#group.visible = true;
    this.reset();
  }

  hide() {
    this.#group.visible = false;
  }

  update() {}

  dispose() {
    this.#backdrop.dispose();
    this.#titleText?.dispose();
    this.#scoreText?.dispose();
    this.#starsText?.dispose();
    this.#p1Label?.dispose();
    this.#p1Input?.dispose();
    this.#p2Label?.dispose();
    this.#p2Input?.dispose();
    this.#saveText?.dispose();
    this.#skipText?.dispose();
  }
}
