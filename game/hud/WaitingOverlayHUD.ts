import { Group } from 'three';

import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import { HUDBackdrop } from './HUDBackdrop';
import type { IHUDItem } from './IHUDItem';

export class WaitingOverlayHUD implements IHUDItem {
  static readonly OVERLAY_HEIGHT = 1.0;
  static readonly TITLE_HEIGHT = 0.15;
  static readonly STATUS_HEIGHT = 0.08;
  static readonly BUTTON_HEIGHT = 0.07;

  #group: Group;
  #backdrop: HUDBackdrop;
  #titleText: TextPlaneResult | null = null;
  #player1Text: TextPlaneResult | null = null;
  #player2Text: TextPlaneResult | null = null;
  #backText: TextPlaneResult | null = null;

  constructor() {
    this.#group = new Group();
    this.#backdrop = new HUDBackdrop(4, WaitingOverlayHUD.OVERLAY_HEIGHT);
    this.#group.add(this.#backdrop.getGroup());
    this.#createContent();
  }

  #createContent() {
    this.#titleText = createTextPlane('Connect Controllers', {
      height: WaitingOverlayHUD.TITLE_HEIGHT,
      fontSize: 64,
      color: '#FBD954',
    });
    this.#titleText.mesh.position.y = 0.35;
    this.#group.add(this.#titleText.mesh);

    this.#player1Text = createTextPlane('Player 1: Waiting...', {
      height: WaitingOverlayHUD.STATUS_HEIGHT,
      fontSize: 40,
      color: '#888888',
    });
    this.#player1Text.mesh.position.y = 0.1;
    this.#group.add(this.#player1Text.mesh);

    this.#player2Text = createTextPlane('Player 2: Waiting...', {
      height: WaitingOverlayHUD.STATUS_HEIGHT,
      fontSize: 40,
      color: '#888888',
    });
    this.#player2Text.mesh.position.y = -0.1;
    this.#group.add(this.#player2Text.mesh);

    this.#backText = createTextPlane('[B] Back', {
      height: WaitingOverlayHUD.BUTTON_HEIGHT,
      fontSize: 32,
      color: '#888888',
    });
    this.#backText.mesh.position.y = -0.35;
    this.#group.add(this.#backText.mesh);
  }

  updateStatus(player1: boolean, player2: boolean) {
    this.#player1Text?.updateText(player1 ? 'Player 1: Connected' : 'Player 1: Waiting...');
    this.#player1Text?.updateColor(player1 ? '#54FB7D' : '#888888');
    this.#player2Text?.updateText(player2 ? 'Player 2: Connected' : 'Player 2: Waiting...');
    this.#player2Text?.updateColor(player2 ? '#54FB7D' : '#888888');
  }

  getGroup(): Group {
    return this.#group;
  }

  getHeight(): number {
    return WaitingOverlayHUD.OVERLAY_HEIGHT;
  }

  show() {
    this.#group.visible = true;
  }

  hide() {
    this.#group.visible = false;
  }

  update() {}

  dispose() {
    this.#backdrop.dispose();
    this.#titleText?.dispose();
    this.#player1Text?.dispose();
    this.#player2Text?.dispose();
    this.#backText?.dispose();
  }
}
