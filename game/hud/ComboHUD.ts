import { Group } from 'three';

import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import { ComboManager } from '../state/ComboManager';
import type { IHUDItem } from './IHUDItem';

export class ComboHUD implements IHUDItem {
  static readonly TEXT_HEIGHT = 0.08;

  #group: Group;
  #text: TextPlaneResult | null = null;
  #comboManager: ComboManager;
  #onComboChanged: EventListener;

  constructor() {
    this.#group = new Group();
    this.#comboManager = ComboManager.getInstance();

    this.#text = createTextPlane('', {
      height: ComboHUD.TEXT_HEIGHT,
      fontSize: 48,
      color: '#FBD954',
    });
    this.#text.mesh.position.x = this.#text.width / 2;
    this.#group.add(this.#text.mesh);
    this.#group.visible = false;

    this.#onComboChanged = ((event: CustomEvent) => {
      this.#updateCombo(event.detail.multiplier);
    }) as EventListener;
    this.#comboManager.addEventListener('comboChanged', this.#onComboChanged);
  }

  #updateCombo(multiplier: number) {
    if (multiplier <= 1) {
      this.#group.visible = false;
      return;
    }

    this.#group.visible = true;
    this.#text?.updateText(`x${multiplier}`);
    if (this.#text) {
      this.#text.mesh.position.x = this.#text.width / 2;
    }
  }

  getGroup(): Group {
    return this.#group;
  }

  getHeight(): number {
    return ComboHUD.TEXT_HEIGHT;
  }

  show(): void {
    // Only show if combo > 1
    const multiplier = this.#comboManager.getMultiplier();
    this.#group.visible = multiplier > 1;
  }

  hide(): void {
    this.#group.visible = false;
  }

  update(): void {}

  dispose(): void {
    this.#comboManager.removeEventListener('comboChanged', this.#onComboChanged);
    this.#text?.dispose();
  }
}
