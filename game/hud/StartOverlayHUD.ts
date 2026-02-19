import { Group } from 'three';

import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import { HUDBackdrop } from './HUDBackdrop';
import type { IHUDItem } from './IHUDItem';

export class StartOverlayHUD implements IHUDItem {
  static readonly OVERLAY_HEIGHT = 0.8;
  static readonly TITLE_HEIGHT = 0.18;
  static readonly PROMPT_HEIGHT = 0.07;

  #group: Group;
  #backdrop: HUDBackdrop;
  #titleText: TextPlaneResult | null = null;
  #promptText: TextPlaneResult | null = null;

  constructor() {
    this.#group = new Group();
    this.#backdrop = new HUDBackdrop(4, StartOverlayHUD.OVERLAY_HEIGHT);
    this.#group.add(this.#backdrop.getGroup());
    this.#createContent();
  }

  #createContent() {
    this.#titleText = createTextPlane('Refurbished!', {
      height: StartOverlayHUD.TITLE_HEIGHT,
      fontSize: 80,
      color: '#FBD954',
    });
    this.#titleText.mesh.position.y = 0.2;
    this.#group.add(this.#titleText.mesh);

    this.#promptText = createTextPlane('Press any button to start', {
      height: StartOverlayHUD.PROMPT_HEIGHT,
      fontSize: 36,
      color: '#FFFFFF',
    });
    this.#promptText.mesh.position.y = -0.1;
    this.#group.add(this.#promptText.mesh);
  }

  getGroup(): Group {
    return this.#group;
  }

  getHeight(): number {
    return StartOverlayHUD.OVERLAY_HEIGHT;
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
    this.#promptText?.dispose();
  }
}
