import { Group } from 'three';

import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import type { GamepadManager } from '../util/input/GamepadManager';
import type { InputSource } from '../util/input/InputSource';
import type { IHUDItem } from './IHUDItem';

export class ControllersHUD implements IHUDItem {
  static readonly LINE_HEIGHT = 0.08;
  static readonly TEXT_HEIGHT = 0.08;

  #gamepadManager: GamepadManager;

  #group: Group;
  #player1Text: TextPlaneResult | null = null;
  #player2Text: TextPlaneResult | null = null;

  constructor(gamepadManager: GamepadManager) {
    this.#gamepadManager = gamepadManager;

    this.#group = new Group();

    this.#createText();
    this.#setupListeners();
  }

  #setupListeners() {
    this.#gamepadManager.addEventListener('gamepadAssigned', () => {
      this.#updateText();
    });

    this.#gamepadManager.addEventListener('gamepadDisconnected', () => {
      this.#updateText();
    });

    this.#gamepadManager.addEventListener('controllersReadyChange', () => {
      this.#updateText();
    });
  }

  #createText() {
    const textOptions = {
      height: ControllersHUD.TEXT_HEIGHT,
      fontSize: 48,
      color: '#FFFFFF',
    };

    this.#player1Text = createTextPlane('', textOptions);
    this.#group.add(this.#player1Text.mesh);

    this.#player2Text = createTextPlane('', textOptions);
    this.#player2Text.mesh.position.y = -ControllersHUD.LINE_HEIGHT;
    this.#group.add(this.#player2Text.mesh);

    this.#updateText();
  }

  #updateText() {
    const p1Source = this.#gamepadManager.getInputSource(1);
    const p2Source = this.#gamepadManager.getInputSource(2);

    const getControllerInfo = (source: InputSource | null) => {
      if (!source) return { type: 'None', status: '' };
      const type = source.constructor.name === 'KeyboardController' ? 'Keyboard' : 'Gamepad';
      const status = source.connected ? '' : ' (disconnected)';
      return { type, status };
    };

    const p1Info = getControllerInfo(p1Source);
    const p2Info = getControllerInfo(p2Source);

    if (this.#player1Text) {
      this.#player1Text.updateText(`P1: ${p1Info.type}${p1Info.status}`);
      // Right-align: offset by width so text extends to the left
      this.#player1Text.mesh.position.x = -this.#player1Text.width / 2;
    }

    if (this.#player2Text) {
      this.#player2Text.updateText(`P2: ${p2Info.type}${p2Info.status}`);
      this.#player2Text.mesh.position.x = -this.#player2Text.width / 2;
    }
  }

  // IHUDItem implementation

  getGroup(): Group {
    return this.#group;
  }

  getHeight(): number {
    return ControllersHUD.LINE_HEIGHT * 2;
  }

  show() {
    this.#group.visible = true;
    this.#updateText();
  }

  hide() {
    this.#group.visible = false;
  }

  update() {
    // No animation needed
  }

  dispose() {
    if (this.#player1Text) {
      this.#player1Text.mesh.geometry.dispose();
      if (Array.isArray(this.#player1Text.mesh.material)) {
        this.#player1Text.mesh.material.forEach((m) => m.dispose());
      } else {
        this.#player1Text.mesh.material.dispose();
      }
    }

    if (this.#player2Text) {
      this.#player2Text.mesh.geometry.dispose();
      if (Array.isArray(this.#player2Text.mesh.material)) {
        this.#player2Text.mesh.material.forEach((m) => m.dispose());
      } else {
        this.#player2Text.mesh.material.dispose();
      }
    }
  }
}
