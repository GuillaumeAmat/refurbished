import { Group } from 'three';

import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import { HUDBackdrop } from './HUDBackdrop';
import type { IHUDItem } from './IHUDItem';

export class PauseOverlayHUD implements IHUDItem {
  static readonly OVERLAY_HEIGHT = 0.8;
  static readonly TITLE_HEIGHT = 0.15;
  static readonly BUTTON_HEIGHT = 0.08;

  #group: Group;
  #backdrop: HUDBackdrop;
  #titleText: TextPlaneResult | null = null;
  #resumeText: TextPlaneResult | null = null;
  #quitText: TextPlaneResult | null = null;

  #selectedOption: 'resume' | 'quit' = 'resume';
  #onResume: (() => void) | null = null;
  #onQuit: (() => void) | null = null;

  constructor() {
    this.#group = new Group();

    this.#backdrop = new HUDBackdrop(2.5, 0.9);
    this.#group.add(this.#backdrop.getGroup());

    this.#createContent();
  }

  #createContent() {
    // Title
    this.#titleText = createTextPlane('Paused', {
      height: PauseOverlayHUD.TITLE_HEIGHT,
      fontSize: 72,
      color: '#FBD954',
    });
    this.#titleText.mesh.position.y = 0.2;
    this.#group.add(this.#titleText.mesh);

    // Resume button
    this.#resumeText = createTextPlane('> Resume', {
      height: PauseOverlayHUD.BUTTON_HEIGHT,
      fontSize: 40,
      color: '#FBD954',
    });
    this.#resumeText.mesh.position.set(0, 0.0, 0);
    this.#group.add(this.#resumeText.mesh);

    // Quit button
    this.#quitText = createTextPlane('  Quit', {
      height: PauseOverlayHUD.BUTTON_HEIGHT,
      fontSize: 40,
      color: '#888888',
    });
    this.#quitText.mesh.position.set(0, -0.15, 0);
    this.#group.add(this.#quitText.mesh);
  }

  setSelectedOption(option: 'resume' | 'quit') {
    this.#selectedOption = option;
    if (option === 'resume') {
      this.#resumeText?.updateText('> Resume');
      this.#resumeText?.updateColor('#FBD954');
      this.#quitText?.updateText('  Quit');
      this.#quitText?.updateColor('#888888');
    } else {
      this.#resumeText?.updateText('  Resume');
      this.#resumeText?.updateColor('#888888');
      this.#quitText?.updateText('> Quit');
      this.#quitText?.updateColor('#FBD954');
    }
  }

  getSelectedOption(): 'resume' | 'quit' {
    return this.#selectedOption;
  }

  onResume(callback: () => void) {
    this.#onResume = callback;
  }

  onQuit(callback: () => void) {
    this.#onQuit = callback;
  }

  triggerResume() {
    this.#onResume?.();
  }

  triggerQuit() {
    this.#onQuit?.();
  }

  reset() {
    this.#selectedOption = 'resume';
    this.setSelectedOption('resume');
  }

  getGroup(): Group {
    return this.#group;
  }

  getHeight(): number {
    return PauseOverlayHUD.OVERLAY_HEIGHT;
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
    this.#resumeText?.dispose();
    this.#quitText?.dispose();
  }
}
