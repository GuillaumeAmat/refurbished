import { Group } from 'three';

import { createPillButtonPlane, type PillButtonPlaneResult } from '../lib/createPillButtonPlane';
import { createRichTextPlane, type RichTextPlaneResult } from '../lib/createRichTextPlane';
import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import type { IHUDItem } from './IHUDItem';

export class StartOverlayHUD implements IHUDItem {
  static readonly OVERLAY_HEIGHT = 0.8;
  static readonly TITLE_HEIGHT = 0.44;
  static readonly SUBTITLE_HEIGHT = 0.12;
  static readonly BUTTON_HEIGHT = 0.22;

  #group: Group;
  #titleText: TextPlaneResult | null = null;
  #subtitleText: RichTextPlaneResult | null = null;
  #button: PillButtonPlaneResult | null = null;

  constructor() {
    this.#group = new Group();
    this.#createContent();
  }

  #createContent() {
    this.#titleText = createTextPlane('Refurbished!', {
      height: StartOverlayHUD.TITLE_HEIGHT,
      fontFamily: 'IvarSoft, serif',
      fontWeight: '600',
      fontStyle: 'italic',
      fontSize: 360,
      color: '#000000',
    });
    this.#titleText.mesh.position.y = 0.25;
    this.#group.add(this.#titleText.mesh);

    this.#subtitleText = createRichTextPlane(
      [{ text: 'An ' }, { text: 'Overcooked!', fontStyle: 'italic' }, { text: ' tribute' }],
      {
        height: StartOverlayHUD.SUBTITLE_HEIGHT,
        fontFamily: 'BMDupletTXT, system-ui, sans-serif',
        fontSize: 72,
        color: '#000000',
      },
    );
    // Right-align subtitle to title
    this.#subtitleText.mesh.position.x = (this.#titleText.width - this.#subtitleText.width) / 2;
    this.#subtitleText.mesh.position.y = -0.04;
    this.#group.add(this.#subtitleText.mesh);

    this.#button = createPillButtonPlane('Press any button', {
      height: StartOverlayHUD.BUTTON_HEIGHT,
      fontFamily: 'BMDupletTXT, system-ui, sans-serif',
      fontWeight: '600',
      fontSize: 64,
      fixedHeight: 160,
    });
    this.#button.mesh.position.y = -0.72;
    this.#group.add(this.#button.mesh);
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
    this.#titleText?.dispose();
    this.#subtitleText?.dispose();
    this.#button?.dispose();
  }
}
