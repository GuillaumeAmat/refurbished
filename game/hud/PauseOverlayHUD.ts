import {
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
} from 'three';

import { OVERLAY_LAYER } from '../constants';
import { createPillButtonPlane, type PillButtonPlaneResult } from '../lib/createPillButtonPlane';
import { createRoundedPlaneMesh } from '../lib/createRoundedPlaneMesh';
import { HUDRegionManager } from './HUDRegionManager';
import type { IHUDItem } from './IHUDItem';

const PADDING = HUDRegionManager.HUD_PADDING;
const CARD_WIDTH_RATIO = 0.9;
const CARD_RADIUS = 0.06;
const BUTTON_Y_MARGIN = 0.08;
const BUTTON_SPACING = 0.7;
const BG_RENDER_ORDER = 1000;
const CONTENT_RENDER_ORDER = 1001;

export class PauseOverlayHUD implements IHUDItem {
  #group: Group;

  #visibleWidth: number;
  #visibleHeight: number;

  #bgMesh: Mesh | null = null;
  #bgMaterial: MeshBasicMaterial | null = null;
  #imageMesh: Mesh | null = null;
  #imageAspect = 1024 / 577;
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
    this.#createImage();
    this.#createButtons();
    this.#positionElements();
  }

  #cardDimensions() {
    const cardWidth = this.#visibleWidth * CARD_WIDTH_RATIO;
    const cardHeight = this.#visibleHeight - PADDING * 2;
    return { cardWidth, cardHeight };
  }

  #createBackground() {
    this.#bgMaterial = new MeshBasicMaterial({
      color: 0xffffff,
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

  #createImage() {
    const loader = new TextureLoader();
    const texture = loader.load('/game/texture/characters/pause.webp', () => {
      // Re-position once texture dimensions are known
      this.#positionElements();
    });
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.colorSpace = SRGBColorSpace;

    const { imgWidth, imgHeight } = this.#computeImageSize();
    const geometry = new PlaneGeometry(imgWidth, imgHeight);
    const material = new MeshBasicMaterial({
      map: texture,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });

    this.#imageMesh = new Mesh(geometry, material);
    this.#imageMesh.renderOrder = CONTENT_RENDER_ORDER;
    this.#imageMesh.layers.enable(OVERLAY_LAYER);
    this.#group.add(this.#imageMesh);
  }

  #computeImageSize() {
    const { cardWidth, cardHeight } = this.#cardDimensions();
    const innerPad = PADDING * 0.5;
    const buttonHeight = 0.22;
    const availW = cardWidth - innerPad * 2;
    const availH = cardHeight - innerPad * 2 - buttonHeight - BUTTON_Y_MARGIN * 2;

    let imgWidth = availW;
    let imgHeight = imgWidth / this.#imageAspect;
    if (imgHeight > availH) {
      imgHeight = availH;
      imgWidth = imgHeight * this.#imageAspect;
    }
    return { imgWidth, imgHeight };
  }

  #createButtons() {
    const buttonOptions = {
      height: 0.22,
      fontSize: 64,
      fontWeight: '600',
      fixedHeight: 160,
    };

    this.#resumeButton = createPillButtonPlane('Resume', buttonOptions);
    const dpr = Math.min(window.devicePixelRatio, 2);
    const minWidth = Math.ceil(this.#resumeButton.width * dpr);

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

    // Recreate background with correct size
    if (this.#bgMesh && this.#bgMaterial) {
      this.#group.remove(this.#bgMesh);
      this.#bgMesh.geometry.dispose();
      this.#bgMesh = createRoundedPlaneMesh(cardWidth, cardHeight, CARD_RADIUS, {
        material: this.#bgMaterial,
      });
      this.#bgMesh.renderOrder = BG_RENDER_ORDER;
      this.#bgMesh.layers.enable(OVERLAY_LAYER);
      this.#group.add(this.#bgMesh);
    }

    const buttonY = -cardHeight / 2 + BUTTON_Y_MARGIN + 0.11;

    // Image: fill space above buttons, centered
    if (this.#imageMesh) {
      const { imgWidth, imgHeight } = this.#computeImageSize();
      this.#imageMesh.geometry.dispose();
      this.#imageMesh.geometry = new PlaneGeometry(imgWidth, imgHeight);

      const imageTop = cardHeight / 2 - PADDING * 0.5;
      const imageBottom = buttonY + 0.15;
      const centerY = (imageTop + imageBottom) / 2;
      this.#imageMesh.position.set(0, centerY, 0.01);
    }

    // Buttons side by side at bottom
    if (this.#resumeButton) {
      this.#resumeButton.mesh.position.set(-BUTTON_SPACING / 2, buttonY, 0.01);
    }
    if (this.#quitButton) {
      this.#quitButton.mesh.position.set(BUTTON_SPACING / 2, buttonY, 0.01);
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

    if (this.#imageMesh) {
      (this.#imageMesh.material as MeshBasicMaterial).map?.dispose();
      (this.#imageMesh.material as MeshBasicMaterial).dispose();
      this.#imageMesh.geometry.dispose();
    }

    this.#resumeButton?.dispose();
    this.#quitButton?.dispose();
  }
}
