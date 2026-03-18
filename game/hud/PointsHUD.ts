import { Group } from 'three';

import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import { ScoreManager } from '../state/ScoreManager';
import { Debug } from '../util/Debug';
import type { IHUDItem } from './IHUDItem';

export class PointsHUD implements IHUDItem {
  #group: Group;
  #text: TextPlaneResult | null = null;
  #scoreManager: ScoreManager;
  #onScoreChanged: EventListener;

  #params = {
    height: 0.44,
    fontSize: 244,
    borderRadius: 9,
    paddingX: 52,
    paddingY: 44,
    paddingTop: 44,
    posX: 0,
    posY: 0.1,
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    rotation: 0,
  };

  constructor() {
    this.#group = new Group();
    this.#scoreManager = ScoreManager.getInstance();
    this.#createText();

    this.#onScoreChanged = ((event: CustomEvent) => {
      this.#updateScore(event.detail.score);
    }) as EventListener;
    this.#scoreManager.addEventListener('scoreChanged', this.#onScoreChanged);

    this.#setupDebug();
  }

  #createText() {
    if (this.#text) {
      this.#text.dispose();
      this.#text.mesh.removeFromParent();
    }

    const score = this.#scoreManager.getScore();
    this.#text = createTextPlane(`${score}`, {
      height: this.#params.height,
      fontSize: this.#params.fontSize,
      color: '#000000',
      backgroundColor: '#FFFFFF',
      dropShadowColor: 'rgba(0,0,0,0.3)',
      dropShadowBlur: this.#params.shadowBlur,
      dropShadowOffsetX: this.#params.shadowOffsetX,
      dropShadowOffsetY: this.#params.shadowOffsetY,
      borderRadius: this.#params.borderRadius,
      backgroundPaddingX: this.#params.paddingX,
      backgroundPaddingY: this.#params.paddingY,
      backgroundPaddingTop: this.#params.paddingTop,
      referenceText: '0000',
    });
    this.#text.mesh.position.x = this.#text.width / 2 + this.#params.posX;
    this.#text.mesh.position.y = this.#params.posY;
    this.#text.mesh.rotation.z = this.#params.rotation;
    this.#group.add(this.#text.mesh);
  }

  #setupDebug() {
    const debug = Debug.getInstance();
    if (!debug?.active) return;

    const folder = debug.gui.addFolder('Score HUD');
    const rebuild = () => this.#createText();
    const updateTransform = () => {
      if (!this.#text) return;
      this.#text.mesh.position.x = this.#text.width / 2 + this.#params.posX;
      this.#text.mesh.position.y = this.#params.posY;
      this.#text.mesh.rotation.z = this.#params.rotation;
    };

    folder.add(this.#params, 'height', 0.1, 1, 0.01).name('Height').onChange(rebuild);
    folder.add(this.#params, 'fontSize', 32, 300, 1).name('Font Size').onChange(rebuild);
    folder.add(this.#params, 'posX', -2, 2, 0.01).name('Position X').onChange(updateTransform);
    folder.add(this.#params, 'posY', -2, 2, 0.01).name('Position Y').onChange(updateTransform);
    folder.add(this.#params, 'rotation', -0.5, 0.5, 0.01).name('Rotation').onChange(updateTransform);
    folder.add(this.#params, 'shadowBlur', 0, 40, 1).name('Shadow Blur').onChange(rebuild);
    folder.add(this.#params, 'shadowOffsetX', -20, 20, 1).name('Shadow X').onChange(rebuild);
    folder.add(this.#params, 'shadowOffsetY', -20, 20, 1).name('Shadow Y').onChange(rebuild);
    folder.close();
  }

  #updateScore(score: number) {
    if (this.#text) {
      this.#text.updateText(`${score}`);
      this.#text.mesh.position.x = this.#text.width / 2 + this.#params.posX;
    }
  }

  getGroup(): Group {
    return this.#group;
  }

  getHeight(): number {
    return this.#params.height;
  }

  show() {
    this.#group.visible = true;
  }

  hide() {
    this.#group.visible = false;
  }

  update() {}

  dispose() {
    this.#scoreManager.removeEventListener('scoreChanged', this.#onScoreChanged);
    this.#text?.dispose();
  }
}
