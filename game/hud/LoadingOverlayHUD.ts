import { Group } from 'three';

import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import { HUDBackdrop } from './HUDBackdrop';
import type { IHUDItem } from './IHUDItem';

export class LoadingOverlayHUD implements IHUDItem {
  static readonly OVERLAY_HEIGHT = 0.4;
  static readonly TEXT_HEIGHT = 0.12;

  #group: Group;
  #backdrop: HUDBackdrop;
  #text: TextPlaneResult | null = null;

  constructor() {
    this.#group = new Group();
    this.#backdrop = new HUDBackdrop(2.5, LoadingOverlayHUD.OVERLAY_HEIGHT);
    this.#group.add(this.#backdrop.getGroup());
    this.#createContent();
  }

  #createContent() {
    this.#text = createTextPlane('Loading...', {
      height: LoadingOverlayHUD.TEXT_HEIGHT,
      fontSize: 56,
      color: '#FBD954',
    });
    this.#group.add(this.#text.mesh);
  }

  getGroup(): Group {
    return this.#group;
  }

  getHeight(): number {
    return LoadingOverlayHUD.OVERLAY_HEIGHT;
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
    this.#text?.dispose();
  }
}
