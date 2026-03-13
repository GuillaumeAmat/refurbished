import gsap from 'gsap';
import { Group } from 'three';

import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import type { IHUDItem } from './IHUDItem';

export class LoadingOverlayHUD implements IHUDItem {
  static readonly OVERLAY_HEIGHT = 0.4;
  static readonly TEXT_HEIGHT = 0.12;

  #group: Group;
  #text: TextPlaneResult | null = null;
  #tween: gsap.core.Tween | null = null;

  constructor() {
    this.#group = new Group();
    this.#createContent();
  }

  #createContent() {
    this.#text = createTextPlane('LOADING...', {
      height: LoadingOverlayHUD.TEXT_HEIGHT,
      fontSize: 56,
      color: '#000000',
    });
    this.#group.add(this.#text.mesh);

    this.#tween = gsap.fromTo(
      this.#text.mesh.material,
      { opacity: 0.5 },
      { opacity: 1, duration: 2, yoyo: true, repeat: -1 },
    );
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
    this.#tween?.kill();
    this.#text?.dispose();
  }
}
