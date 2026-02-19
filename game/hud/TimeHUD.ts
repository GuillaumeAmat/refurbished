import { Group } from 'three';

import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import { SessionManager } from '../state/SessionManager';
import type { IHUDItem } from './IHUDItem';

export class TimeHUD implements IHUDItem {
  static readonly TEXT_HEIGHT = 0.08;

  #group: Group;
  #text: TextPlaneResult | null = null;
  #sessionManager: SessionManager;
  #onTimeChanged: EventListener;

  constructor() {
    this.#group = new Group();
    this.#sessionManager = SessionManager.getInstance();

    this.#onTimeChanged = ((event: CustomEvent) => {
      this.#updateText(event.detail.remaining);
    }) as EventListener;
    this.#sessionManager.addEventListener('timeChanged', this.#onTimeChanged);

    this.#createText(this.#sessionManager.getRemainingTime());
  }

  #formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `Time: ${mins}:${secs.toString().padStart(2, '0')}`;
  }

  #createText(seconds: number) {
    this.#text = createTextPlane(this.#formatTime(seconds), {
      height: TimeHUD.TEXT_HEIGHT,
      fontSize: 48,
      color: '#000000',
    });
    // Right-align: offset by -width/2 so text extends to the left
    this.#text.mesh.position.x = -this.#text.width / 2;
    this.#group.add(this.#text.mesh);
  }

  #updateText(seconds: number) {
    if (this.#text) {
      this.#text.mesh.geometry.dispose();
      if (Array.isArray(this.#text.mesh.material)) {
        this.#text.mesh.material.forEach((m) => m.dispose());
      } else {
        this.#text.mesh.material.dispose();
      }
      this.#group.remove(this.#text.mesh);
    }
    this.#createText(seconds);
  }

  getGroup(): Group {
    return this.#group;
  }

  getHeight(): number {
    return TimeHUD.TEXT_HEIGHT;
  }

  show() {
    this.#group.visible = true;
  }

  hide() {
    this.#group.visible = false;
  }

  update() {}

  dispose() {
    this.#sessionManager.removeEventListener('timeChanged', this.#onTimeChanged);
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
