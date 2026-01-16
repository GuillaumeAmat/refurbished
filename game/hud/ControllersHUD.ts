import { Group, type Mesh, MeshStandardMaterial, type PerspectiveCamera } from 'three';

import { createTextMesh } from '../lib/createTextMesh';
import { Resources } from '../util/Resources';
import type { GamepadManager } from '../util/input/GamepadManager';

export class ControllersHUD {
  static readonly HUD_DISTANCE = 5;
  static readonly HUD_PADDING = 0.15;
  static readonly HUD_LINE_HEIGHT = 0.06;

  #camera: PerspectiveCamera;
  #resources: Resources;
  #gamepadManager: GamepadManager;

  #group: Group;
  #player1Mesh: Mesh | null = null;
  #player2Mesh: Mesh | null = null;
  #material: MeshStandardMaterial;

  constructor(camera: PerspectiveCamera, gamepadManager: GamepadManager) {
    this.#camera = camera;
    this.#resources = Resources.getInstance();
    this.#gamepadManager = gamepadManager;

    this.#group = new Group();
    this.#camera.add(this.#group);

    this.#material = new MeshStandardMaterial({
      color: '#FFFFFF',
      metalness: 0.2,
      roughness: 0.6,
    });

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

    if (this.#player1Mesh) {
      this.#player1Mesh.position.set(bounds.left + padding, bounds.top - padding, -ControllersHUD.HUD_DISTANCE);
    }

    if (this.#player2Mesh) {
      this.#player2Mesh.position.set(
        bounds.left + padding,
        bounds.top - padding - lineHeight,
        -ControllersHUD.HUD_DISTANCE,
      );
    }
  }

  #alignTextLeft(mesh: Mesh) {
    mesh.geometry.computeBoundingBox();
    if (mesh.geometry.boundingBox) {
      const width = mesh.geometry.boundingBox.max.x - mesh.geometry.boundingBox.min.x;
      mesh.geometry.translate(width / 2, 0, 0);
    }
  }

  private createText() {
    const font = this.#resources.getFontAsset('interFont');
    if (!font) return;

    this.#player1Mesh = createTextMesh('', font, {
      extrusionDepth: 0.005,
      size: 0.0375,
      material: this.#material,
    });
    this.#alignTextLeft(this.#player1Mesh);
    this.#group.add(this.#player1Mesh);

    this.#player2Mesh = createTextMesh('', font, {
      extrusionDepth: 0.005,
      size: 0.0375,
      material: this.#material,
    });
    this.#alignTextLeft(this.#player2Mesh);
    this.#group.add(this.#player2Mesh);

    this.#updateMeshPositions();
    this.updateText();
  }

  private updateText() {
    const font = this.#resources.getFontAsset('interFont');
    if (!font) return;

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

    if (this.#player1Mesh) {
      this.#group.remove(this.#player1Mesh);
      this.#player1Mesh = createTextMesh(`P1: ${p1Info.type}${p1Info.status}`, font, {
        extrusionDepth: 0.005,
        size: 0.0375,
        material: this.#material,
      });
      this.#alignTextLeft(this.#player1Mesh);
      this.#group.add(this.#player1Mesh);
    }

    if (this.#player2Mesh) {
      this.#group.remove(this.#player2Mesh);
      this.#player2Mesh = createTextMesh(`P2: ${p2Info.type}${p2Info.status}`, font, {
        extrusionDepth: 0.005,
        size: 0.0375,
        material: this.#material,
      });
      this.#alignTextLeft(this.#player2Mesh);
      this.#group.add(this.#player2Mesh);
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
