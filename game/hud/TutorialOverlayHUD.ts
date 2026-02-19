import { Group } from 'three';

import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import { HUDBackdrop } from './HUDBackdrop';
import type { IHUDItem } from './IHUDItem';

export class TutorialOverlayHUD implements IHUDItem {
  static readonly OVERLAY_HEIGHT = 1.2;
  static readonly TITLE_HEIGHT = 0.15;
  static readonly TEXT_HEIGHT = 0.07;
  static readonly BUTTON_HEIGHT = 0.08;

  #group: Group;
  #backdrop: HUDBackdrop;
  #titleText: TextPlaneResult | null = null;
  #commandsText: TextPlaneResult | null = null;
  #backText: TextPlaneResult | null = null;
  #playText: TextPlaneResult | null = null;

  constructor() {
    this.#group = new Group();
    this.#backdrop = new HUDBackdrop(4.5, TutorialOverlayHUD.OVERLAY_HEIGHT);
    this.#group.add(this.#backdrop.getGroup());
    this.#createContent();
  }

  #createContent() {
    this.#titleText = createTextPlane('Tutorial', {
      height: TutorialOverlayHUD.TITLE_HEIGHT,
      fontSize: 72,
      color: '#FBD954',
    });
    this.#titleText.mesh.position.y = 0.45;
    this.#group.add(this.#titleText.mesh);

    this.#commandsText = createTextPlane(
      'Use gamepad to control your vehicle\nCooperative 2-player game  •  Avoid obstacles, collect points',
      {
        height: TutorialOverlayHUD.TEXT_HEIGHT,
        fontSize: 32,
        color: '#FFFFFF',
      },
    );
    this.#commandsText.mesh.position.y = 0.15;
    this.#group.add(this.#commandsText.mesh);

    this.#backText = createTextPlane('[B] Back', {
      height: TutorialOverlayHUD.BUTTON_HEIGHT,
      fontSize: 40,
      color: '#888888',
    });
    this.#backText.mesh.position.set(-0.5, -0.35, 0);
    this.#group.add(this.#backText.mesh);

    this.#playText = createTextPlane('[A] Start Game', {
      height: TutorialOverlayHUD.BUTTON_HEIGHT,
      fontSize: 40,
      color: '#FBD954',
    });
    this.#playText.mesh.position.set(0.5, -0.35, 0);
    this.#group.add(this.#playText.mesh);
  }

  getGroup(): Group {
    return this.#group;
  }

  getHeight(): number {
    return TutorialOverlayHUD.OVERLAY_HEIGHT;
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
    this.#commandsText?.dispose();
    this.#backText?.dispose();
    this.#playText?.dispose();
  }
}
