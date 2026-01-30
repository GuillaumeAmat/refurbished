import { Group, type PerspectiveCamera } from 'three';

import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import type { GamepadManager } from '../util/input/GamepadManager';

export class ControllersHUD {
  static readonly HUD_DISTANCE = 5;
  static readonly HUD_PADDING = 0.15;
  static readonly HUD_LINE_HEIGHT = 0.08;
  static readonly TEXT_HEIGHT = 0.08;

  #camera: PerspectiveCamera;
  #gamepadManager: GamepadManager;

  #group: Group;
  #player1Text: TextPlaneResult | null = null;
  #player2Text: TextPlaneResult | null = null;

  constructor(camera: PerspectiveCamera, gamepadManager: GamepadManager) {
    this.#camera = camera;
    this.#gamepadManager = gamepadManager;

    this.#group = new Group();
    this.#camera.add(this.#group);

    this.createText();
    this.setupListeners();
  }

  private setupListeners() {
    this.#gamepadManager.addEventListener('gamepadAssigned', () => {
      this.updateText();
    });

    this.#gamepadManager.addEventListener('gamepadDisconnected', () => {
      this.updateText();
    });

    this.#gamepadManager.addEventListener('controllersReadyChange', () => {
      this.updateText();
    });
  }

  #calculateFrustumBounds() {
    const distance = ControllersHUD.HUD_DISTANCE;
    const vFov = (this.#camera.fov * Math.PI) / 180;
    const visibleHeight = 2 * Math.tan(vFov / 2) * distance;
    const visibleWidth = visibleHeight * this.#camera.aspect;

    return {
      top: visibleHeight / 2,
      left: -visibleWidth / 2,
    };
  }

  #updateMeshPositions() {
    const bounds = this.#calculateFrustumBounds();
    const padding = ControllersHUD.HUD_PADDING;
    const lineHeight = ControllersHUD.HUD_LINE_HEIGHT;

    if (this.#player1Text) {
      // Offset by width/2 to achieve left alignment (plane origin is center)
      this.#player1Text.mesh.position.set(
        bounds.left + padding + this.#player1Text.width / 2,
        bounds.top - padding,
        -ControllersHUD.HUD_DISTANCE,
      );
    }

    if (this.#player2Text) {
      this.#player2Text.mesh.position.set(
        bounds.left + padding + this.#player2Text.width / 2,
        bounds.top - padding - lineHeight,
        -ControllersHUD.HUD_DISTANCE,
      );
    }
  }

  private createText() {
    const textOptions = {
      height: ControllersHUD.TEXT_HEIGHT,
      fontSize: 48,
      color: '#FFFFFF',
    };

    this.#player1Text = createTextPlane('', textOptions);
    this.#group.add(this.#player1Text.mesh);

    this.#player2Text = createTextPlane('', textOptions);
    this.#group.add(this.#player2Text.mesh);

    this.#updateMeshPositions();
    this.updateText();
  }

  private updateText() {
    const p1Source = this.#gamepadManager.getInputSource(1);
    const p2Source = this.#gamepadManager.getInputSource(2);

    const getControllerInfo = (source: any) => {
      if (!source) return { type: 'None', status: '' };
      const type = source.constructor.name === 'KeyboardController' ? 'Keyboard' : 'Gamepad';
      const status = source.connected ? '' : ' (disconnected)';
      return { type, status };
    };

    const p1Info = getControllerInfo(p1Source);
    const p2Info = getControllerInfo(p2Source);

    if (this.#player1Text) {
      this.#player1Text.updateText(`P1: ${p1Info.type}${p1Info.status}`);
    }

    if (this.#player2Text) {
      this.#player2Text.updateText(`P2: ${p2Info.type}${p2Info.status}`);
    }

    this.#updateMeshPositions();
  }

  public show() {
    this.#group.visible = true;
    this.updateText();
  }

  public hide() {
    this.#group.visible = false;
  }

  public update() {
    // No animation needed for now
  }

  public updatePosition() {
    this.#updateMeshPositions();
  }
}
