import { DoubleSide, Group, type Mesh, MeshBasicMaterial } from 'three';

import { COLORS, OVERLAY_LAYER } from '../constants';
import { createPillButtonPlane, type PillButtonPlaneResult } from '../lib/createPillButtonPlane';
import { createRoundedPlaneMesh } from '../lib/createRoundedPlaneMesh';
import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import { HUDRegionManager } from './HUDRegionManager';
import type { IHUDItem } from './IHUDItem';

const PADDING = HUDRegionManager.HUD_PADDING;
const CARD_ASPECT = 0.6;
const CARD_RADIUS = 0.06;
const BG_RENDER_ORDER = 1000;
const CONTENT_RENDER_ORDER = 1001;

export class PauseOverlayHUD implements IHUDItem {
  #group: Group;

  #visibleWidth: number;
  #visibleHeight: number;

  #bgMesh: Mesh | null = null;
  #bgMaterial: MeshBasicMaterial | null = null;
  #titleText: TextPlaneResult | null = null;
  #resumeButton: PillButtonPlaneResult | null = null;
  #quitButton: PillButtonPlaneResult | null = null;

  #selectedOption: 'resume' | 'quit' = 'resume';
  #onResume: (() => void) | null = null;
  #onQuit: (() => void) | null = null;

  constructor({ visibleWidth, visibleHeight }: { visibleWidth: number; visibleHeight: number }) {
    this.#group = new Group();
    this.#visibleWidth = visibleWidth;
    this.#visibleHeight = visibleHeight;

    this.#createBackground();
    this.#createTitle();
    this.#createButtons();
    this.#positionElements();
  }

  #cardDimensions() {
    const fullHeight = this.#visibleHeight - PADDING * 2;
    const cardHeight = fullHeight * 0.5;
    const cardWidth = Math.min(fullHeight * CARD_ASPECT, this.#visibleWidth - PADDING * 2);
    return { cardWidth, cardHeight };
  }

  #createBackground() {
    this.#bgMaterial = new MeshBasicMaterial({
      color: COLORS.mindaro,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });

    const { cardWidth, cardHeight } = this.#cardDimensions();
    this.#bgMesh = createRoundedPlaneMesh(cardWidth, cardHeight, CARD_RADIUS, {
      material: this.#bgMaterial,
    });
    this.#bgMesh.renderOrder = BG_RENDER_ORDER;
    this.#bgMesh.layers.enable(OVERLAY_LAYER);
    this.#group.add(this.#bgMesh);
  }

  #createTitle() {
    this.#titleText = createTextPlane('Pause!', {
      height: 0.35,
      fontSize: 256,
      fontFamily: 'IvarSoft, serif',
      fontStyle: 'italic',
      fontWeight: '600',
      color: COLORS.night,
    });
    this.#titleText.mesh.renderOrder = CONTENT_RENDER_ORDER;
    this.#titleText.mesh.layers.enable(OVERLAY_LAYER);
    this.#group.add(this.#titleText.mesh);
  }

  #createButtons() {
    const buttonOptions = {
      height: 0.22,
      fontSize: 64,
      fontWeight: '600',
      fixedHeight: 160,
    };

    // Create Resume first to measure its natural width
    this.#resumeButton = createPillButtonPlane('Resume', buttonOptions);
    // Use Resume's canvas width as minimum for both buttons
    const dpr = Math.min(window.devicePixelRatio, 2);
    const minWidth = Math.ceil(this.#resumeButton.width * dpr);

    // Recreate both with matched width
    this.#resumeButton.dispose();
    this.#resumeButton = createPillButtonPlane('Resume', { ...buttonOptions, minCanvasWidth: minWidth });
    this.#resumeButton.mesh.renderOrder = CONTENT_RENDER_ORDER;
    this.#resumeButton.mesh.layers.enable(OVERLAY_LAYER);
    this.#group.add(this.#resumeButton.mesh);

    this.#quitButton = createPillButtonPlane('Quit', { ...buttonOptions, minCanvasWidth: minWidth, transparent: true });
    this.#quitButton.mesh.renderOrder = CONTENT_RENDER_ORDER;
    this.#quitButton.mesh.layers.enable(OVERLAY_LAYER);
    this.#group.add(this.#quitButton.mesh);
  }

  #positionElements() {
    const { cardWidth, cardHeight } = this.#cardDimensions();
    const yOffset = -cardHeight * 0.3;

    // Recreate background with correct size
    if (this.#bgMesh && this.#bgMaterial) {
      this.#group.remove(this.#bgMesh);
      this.#bgMesh.geometry.dispose();
      this.#bgMesh = createRoundedPlaneMesh(cardWidth, cardHeight, CARD_RADIUS, {
        material: this.#bgMaterial,
      });
      this.#bgMesh.renderOrder = BG_RENDER_ORDER;
      this.#bgMesh.layers.enable(OVERLAY_LAYER);
      this.#bgMesh.position.set(0, yOffset, 0);
      this.#group.add(this.#bgMesh);
    }

    // Title — upper portion
    if (this.#titleText) {
      this.#titleText.mesh.position.set(0, yOffset + cardHeight * 0.25, 0);
    }

    // Resume — below title with gap
    if (this.#resumeButton) {
      this.#resumeButton.mesh.position.set(0, yOffset - cardHeight * 0.1, 0);
    }

    // Quit — below Resume with smaller gap
    if (this.#quitButton) {
      this.#quitButton.mesh.position.set(0, yOffset - cardHeight * 0.28, 0);
    }
  }

  setSelectedOption(option: 'resume' | 'quit') {
    this.#selectedOption = option;
    this.#resumeButton?.updateState(option === 'resume');
    this.#quitButton?.updateState(option === 'quit');
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

  updateBounds(visibleWidth: number, visibleHeight: number) {
    this.#visibleWidth = visibleWidth;
    this.#visibleHeight = visibleHeight;
    this.#positionElements();
  }

  getGroup(): Group {
    return this.#group;
  }

  getHeight(): number {
    return this.#visibleHeight;
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
    this.#bgMesh?.geometry.dispose();
    this.#bgMaterial?.dispose();
    this.#titleText?.dispose();
    this.#resumeButton?.dispose();
    this.#quitButton?.dispose();
  }
}
