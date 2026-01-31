import { Group } from 'three';

import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import { HUDBackdrop } from './HUDBackdrop';
import type { IHUDItem } from './IHUDItem';

export class SavingScoreOverlayHUD implements IHUDItem {
  static readonly OVERLAY_HEIGHT = 0.6;
  static readonly TITLE_HEIGHT = 0.12;
  static readonly STATUS_HEIGHT = 0.08;
  static readonly BUTTON_HEIGHT = 0.08;

  #group: Group;
  #backdrop: HUDBackdrop;
  #titleText: TextPlaneResult | null = null;
  #statusText: TextPlaneResult | null = null;
  #continueText: TextPlaneResult | null = null;

  #onContinue: (() => void) | null = null;

  constructor() {
    this.#group = new Group();

    this.#backdrop = new HUDBackdrop(3, SavingScoreOverlayHUD.OVERLAY_HEIGHT);
    this.#group.add(this.#backdrop.getGroup());

    this.#createContent();
  }

  #createContent() {
    // Title
    this.#titleText = createTextPlane('Saving Score...', {
      height: SavingScoreOverlayHUD.TITLE_HEIGHT,
      fontSize: 56,
      color: '#FBD954',
    });
    this.#titleText.mesh.position.y = 0.15;
    this.#group.add(this.#titleText.mesh);

    // Status
    this.#statusText = createTextPlane('Score saved successfully!', {
      height: SavingScoreOverlayHUD.STATUS_HEIGHT,
      fontSize: 40,
      color: '#FFFFFF',
    });
    this.#statusText.mesh.position.y = -0.02;
    this.#statusText.mesh.visible = false;
    this.#group.add(this.#statusText.mesh);

    // Continue button
    this.#continueText = createTextPlane('> Continue to Leaderboard', {
      height: SavingScoreOverlayHUD.BUTTON_HEIGHT,
      fontSize: 40,
      color: '#FBD954',
    });
    this.#continueText.mesh.position.y = -0.18;
    this.#continueText.mesh.visible = false;
    this.#group.add(this.#continueText.mesh);
  }

  showSaved() {
    this.#titleText?.updateText('Score Saved!');
    if (this.#statusText) {
      this.#statusText.mesh.visible = true;
    }
    if (this.#continueText) {
      this.#continueText.mesh.visible = true;
    }
  }

  showError() {
    this.#titleText?.updateText('Save Failed');
    this.#statusText?.updateText('Could not save score');
    if (this.#statusText) {
      this.#statusText.mesh.visible = true;
    }
    if (this.#continueText) {
      this.#continueText.mesh.visible = true;
    }
  }

  onContinue(callback: () => void) {
    this.#onContinue = callback;
  }

  triggerContinue() {
    this.#onContinue?.();
  }

  reset() {
    this.#titleText?.updateText('Saving Score...');
    if (this.#statusText) {
      this.#statusText.mesh.visible = false;
    }
    if (this.#continueText) {
      this.#continueText.mesh.visible = false;
    }
  }

  getGroup(): Group {
    return this.#group;
  }

  getHeight(): number {
    return SavingScoreOverlayHUD.OVERLAY_HEIGHT;
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
    this.#statusText?.dispose();
    this.#continueText?.dispose();
  }
}
