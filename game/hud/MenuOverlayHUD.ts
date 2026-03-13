import { Group } from 'three';

import { createPillButtonPlane, type PillButtonPlaneResult } from '../lib/createPillButtonPlane';
import { createRichTextPlane, type RichTextPlaneResult } from '../lib/createRichTextPlane';
import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import type { IHUDItem } from './IHUDItem';

export class MenuOverlayHUD implements IHUDItem {
  static readonly OVERLAY_HEIGHT = 0.8;
  static readonly TITLE_HEIGHT = 0.44;
  static readonly SUBTITLE_HEIGHT = 0.12;
  static readonly BUTTON_HEIGHT = 0.22;

  #group: Group;
  #titleText: TextPlaneResult | null = null;
  #subtitleText: RichTextPlaneResult | null = null;
  #playButton: PillButtonPlaneResult | null = null;
  #leaderboardButton: PillButtonPlaneResult | null = null;

  #selectedOption: 'play' | 'leaderboard' = 'play';

  constructor() {
    this.#group = new Group();
    this.#createContent();
  }

  #createContent() {
    this.#titleText = createTextPlane('Refurbished!', {
      height: MenuOverlayHUD.TITLE_HEIGHT,
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
        height: MenuOverlayHUD.SUBTITLE_HEIGHT,
        fontFamily: 'BMDupletTXT, system-ui, sans-serif',
        fontSize: 72,
        color: '#000000',
      },
    );
    this.#subtitleText.mesh.position.x = (this.#titleText.width - this.#subtitleText.width) / 2;
    this.#subtitleText.mesh.position.y = -0.04;
    this.#group.add(this.#subtitleText.mesh);

    const fixedHeight = 160;
    const buttonOptions = {
      height: MenuOverlayHUD.BUTTON_HEIGHT,
      fontFamily: 'BMDupletTXT, system-ui, sans-serif',
      fontWeight: '600',
      fontSize: 64,
      fixedHeight,
    };

    // Measure both buttons to find the widest, then recreate with uniform width
    const playProbe = createPillButtonPlane('Play', buttonOptions);
    const lbProbe = createPillButtonPlane('Leaderboard', buttonOptions);
    const maxWidth = Math.max(playProbe.width, lbProbe.width);
    const minCanvasWidth = (maxWidth / MenuOverlayHUD.BUTTON_HEIGHT) * fixedHeight;
    playProbe.dispose();
    lbProbe.dispose();

    this.#playButton = createPillButtonPlane('Play', { ...buttonOptions, minCanvasWidth });
    this.#playButton.mesh.position.y = -0.52;
    this.#group.add(this.#playButton.mesh);

    this.#leaderboardButton = createPillButtonPlane('Leaderboard', {
      ...buttonOptions,
      minCanvasWidth,
      transparent: true,
    });
    this.#leaderboardButton.mesh.position.y = -0.82;
    this.#group.add(this.#leaderboardButton.mesh);
  }

  setSelectedOption(option: 'play' | 'leaderboard') {
    this.#selectedOption = option;
    this.#playButton?.updateState(option === 'play');
    this.#leaderboardButton?.updateState(option === 'leaderboard');
  }

  getSelectedOption(): 'play' | 'leaderboard' {
    return this.#selectedOption;
  }

  reset() {
    this.#selectedOption = 'play';
    this.setSelectedOption('play');
  }

  getGroup(): Group {
    return this.#group;
  }

  getHeight(): number {
    return MenuOverlayHUD.OVERLAY_HEIGHT;
  }

  show() {
    this.#group.visible = true;
    this.reset();
  }

  hide() {
    this.#group.visible = false;
  }

  update() {}

  dispose() {
    this.#titleText?.dispose();
    this.#subtitleText?.dispose();
    this.#playButton?.dispose();
    this.#leaderboardButton?.dispose();
  }
}
