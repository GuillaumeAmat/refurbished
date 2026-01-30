import { Group } from 'three';

import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import type { IHUDItem } from './IHUDItem';

export class PointsHUD implements IHUDItem {
  static readonly TEXT_HEIGHT = 0.08;

  #group: Group;
  #text: TextPlaneResult | null = null;

  constructor() {
    this.#group = new Group();
    this.#createText();
  }

  #createText() {
    this.#text = createTextPlane('Points: 0', {
      height: PointsHUD.TEXT_HEIGHT,
      fontSize: 48,
      color: '#FFFFFF',
    });
    // Left-align: offset by width/2 so text extends to the right
    this.#text.mesh.position.x = this.#text.width / 2;
    this.#group.add(this.#text.mesh);
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
    if (this.#text) {
      this.#text.mesh.geometry.dispose();
      if (Array.isArray(this.#text.mesh.material)) {
        this.#text.mesh.material.forEach((m) => m.dispose());
      } else {
        this.#text.mesh.material.dispose();
      }
    }
  }
}
