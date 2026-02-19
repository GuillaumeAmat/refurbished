import { Group } from 'three';

import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import { HUDBackdrop } from './HUDBackdrop';
import type { IHUDItem } from './IHUDItem';

export class MenuOverlayHUD implements IHUDItem {
  static readonly OVERLAY_HEIGHT = 0.8;
  static readonly TITLE_HEIGHT = 0.15;
  static readonly OPTION_HEIGHT = 0.08;

  #group: Group;
  #backdrop: HUDBackdrop;
  #titleText: TextPlaneResult | null = null;
  #playText: TextPlaneResult | null = null;
  #leaderboardText: TextPlaneResult | null = null;

  #selectedOption: 'play' | 'leaderboard' = 'play';

  constructor() {
    this.#group = new Group();
    this.#backdrop = new HUDBackdrop(3.5, MenuOverlayHUD.OVERLAY_HEIGHT);
    this.#group.add(this.#backdrop.getGroup());
    this.#createContent();
  }

  #createContent() {
    this.#titleText = createTextPlane('Main Menu', {
      height: MenuOverlayHUD.TITLE_HEIGHT,
      fontSize: 72,
      color: '#FBD954',
    });
    this.#titleText.mesh.position.y = 0.25;
    this.#group.add(this.#titleText.mesh);

    this.#playText = createTextPlane('> Play', {
      height: MenuOverlayHUD.OPTION_HEIGHT,
      fontSize: 40,
      color: '#FBD954',
    });
    this.#playText.mesh.position.set(-0.5, -0.1, 0);
    this.#group.add(this.#playText.mesh);

    this.#leaderboardText = createTextPlane('  Leaderboard', {
      height: MenuOverlayHUD.OPTION_HEIGHT,
      fontSize: 40,
      color: '#888888',
    });
    this.#leaderboardText.mesh.position.set(0.6, -0.1, 0);
    this.#group.add(this.#leaderboardText.mesh);
  }

  setSelectedOption(option: 'play' | 'leaderboard') {
    this.#selectedOption = option;
    if (option === 'play') {
      this.#playText?.updateText('> Play');
      this.#playText?.updateColor('#FBD954');
      this.#leaderboardText?.updateText('  Leaderboard');
      this.#leaderboardText?.updateColor('#888888');
    } else {
      this.#playText?.updateText('  Play');
      this.#playText?.updateColor('#888888');
      this.#leaderboardText?.updateText('> Leaderboard');
      this.#leaderboardText?.updateColor('#FBD954');
    }
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
    this.#backdrop.dispose();
    this.#titleText?.dispose();
    this.#playText?.dispose();
    this.#leaderboardText?.dispose();
  }
}
