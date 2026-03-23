import {
  CanvasTexture,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';

import { COLORS } from '../constants';
import { createPillButtonPlane, type PillButtonPlaneResult } from '../lib/createPillButtonPlane';
import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import { HUDRegionManager } from './HUDRegionManager';
import type { IHUDItem } from './IHUDItem';

const PADDING = HUDRegionManager.HUD_PADDING;

export class TutorialOverlayHUD implements IHUDItem {
  #group: Group;
  #visibleWidth: number;
  #visibleHeight: number;

  // Background
  #bgMesh: Mesh | null = null;
  #bgGeometry: PlaneGeometry | null = null;
  #bgMaterial: MeshBasicMaterial | null = null;

  // Badge
  #badgeMesh: Mesh | null = null;

  // Titles
  #titleYour: TextPlaneResult | null = null;
  #titleMission: TextPlaneResult | null = null;

  // Mission image
  #missionMesh: Mesh | null = null;

  // Buttons
  #backButton: PillButtonPlaneResult | null = null;
  #startButton: PillButtonPlaneResult | null = null;

  constructor({ visibleWidth, visibleHeight }: { visibleWidth: number; visibleHeight: number }) {
    this.#group = new Group();
    this.#visibleWidth = visibleWidth;
    this.#visibleHeight = visibleHeight;

    this.#createBackground();
    this.#createBadge();
    this.#createTitles();
    this.#createMissionImage();
    this.#createButtons();
    this.#positionElements();
  }

  #createBackground() {
    this.#bgGeometry = new PlaneGeometry(this.#visibleWidth, this.#visibleHeight);
    this.#bgMaterial = new MeshBasicMaterial({
      color: 0xffffff,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });
    this.#bgMesh = new Mesh(this.#bgGeometry, this.#bgMaterial);
    this.#bgMesh.renderOrder = 998;
    this.#group.add(this.#bgMesh);
  }

  #createBadge() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const fontSize = 28 * dpr;
    const pad = 8 * dpr;
    const text = 'SET?';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const fontString = `600 ${fontSize}px BMDupletDSP, system-ui, sans-serif`;
    ctx.font = fontString;
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const ascent = metrics.actualBoundingBoxAscent;
    const descent = metrics.actualBoundingBoxDescent;
    const textHeight = ascent + descent;

    canvas.width = Math.ceil(textWidth + pad * 2);
    canvas.height = Math.ceil(textHeight + pad * 2);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const r = 6 * dpr;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(canvas.width - r, 0);
    ctx.quadraticCurveTo(canvas.width, 0, canvas.width, r);
    ctx.lineTo(canvas.width, canvas.height - r);
    ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - r, canvas.height);
    ctx.lineTo(r, canvas.height);
    ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fillStyle = COLORS.mindaro;
    ctx.fill();

    ctx.font = fontString;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#000000';
    ctx.fillText(text, pad, pad + ascent);

    const texture = new CanvasTexture(canvas);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;

    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const worldHeight = 0.07;
    const worldWidth = worldHeight * (width / height);

    const geometry = new PlaneGeometry(worldWidth, worldHeight);
    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });

    this.#badgeMesh = new Mesh(geometry, material);
    this.#badgeMesh.renderOrder = 999;
    this.#group.add(this.#badgeMesh);
  }

  #createTitles() {
    this.#titleYour = createTextPlane('Your ', {
      height: 0.25,
      fontSize: 128,
      fontFamily: 'IvarSoft, serif',
      fontWeight: '600',
      color: '#000000',
    });
    this.#group.add(this.#titleYour.mesh);

    this.#titleMission = createTextPlane('mission.', {
      height: 0.25,
      fontSize: 128,
      fontFamily: 'IvarSoft, serif',
      fontWeight: '600',
      fontStyle: 'italic',
      color: '#000000',
    });
    this.#group.add(this.#titleMission.mesh);
  }

  #createMissionImage() {
    const img = new Image();
    img.src = '/game/texture/characters/mission.webp';
    img.onload = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = Math.ceil(img.naturalWidth * dpr);
      const h = Math.ceil(img.naturalHeight * dpr);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;

      const r = 20 * dpr;
      ctx.clearRect(0, 0, w, h);
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(w - r, 0);
      ctx.quadraticCurveTo(w, 0, w, r);
      ctx.lineTo(w, h - r);
      ctx.quadraticCurveTo(w, h, w - r, h);
      ctx.lineTo(r, h);
      ctx.quadraticCurveTo(0, h, 0, h - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, 0, 0, w, h);

      const texture = new CanvasTexture(canvas);
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      texture.generateMipmaps = false;
      texture.colorSpace = SRGBColorSpace;
      texture.needsUpdate = true;

      // Compute available space and fit image
      const aspect = img.naturalWidth / img.naturalHeight;
      const { worldWidth, worldHeight } = this.#computeMissionSize(aspect);

      const geometry = new PlaneGeometry(worldWidth, worldHeight);
      const material = new MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: DoubleSide,
      });

      this.#missionMesh = new Mesh(geometry, material);
      this.#missionMesh.renderOrder = 999;
      this.#group.add(this.#missionMesh);
      this.#positionElements();
    };
  }

  #computeMissionSize(aspect: number) {
    const h = this.#visibleHeight;
    const w = this.#visibleWidth;
    const top = h / 2 - PADDING;
    const bottom = -h / 2 + PADDING;

    const titleBottom = top - 0.22 - 0.15; // title Y minus half title height + margin
    const buttonTop = bottom + 0.12 + 0.12; // button Y plus half button height + margin
    const availH = titleBottom - buttonTop;
    const availW = w - PADDING * 2;

    let worldWidth = availW;
    let worldHeight = worldWidth / aspect;
    if (worldHeight > availH) {
      worldHeight = availH;
      worldWidth = worldHeight * aspect;
    }
    return { worldWidth, worldHeight };
  }

  #createButtons() {
    const buttonOptions = {
      height: 0.18,
      fontFamily: 'BMDupletTXT, system-ui, sans-serif',
      fontWeight: '600',
      fontSize: 64,
      fixedHeight: 160,
      transparent: true,
    };

    this.#backButton = createPillButtonPlane(
      [
        { type: 'text', value: 'Back ' },
        { type: 'badge', label: 'B', color: '#CC0000' },
      ],
      buttonOptions,
    );
    this.#group.add(this.#backButton.mesh);

    this.#startButton = createPillButtonPlane(
      [
        { type: 'text', value: 'Start ' },
        { type: 'badge', label: 'A', color: '#107C10' },
      ],
      { ...buttonOptions, transparent: false },
    );
    this.#group.add(this.#startButton.mesh);
  }

  #positionElements() {
    const h = this.#visibleHeight;
    const w = this.#visibleWidth;
    const top = h / 2 - PADDING;
    const bottom = -h / 2 + PADDING;

    // Background
    if (this.#bgMesh && this.#bgGeometry) {
      this.#bgGeometry.dispose();
      this.#bgGeometry = new PlaneGeometry(w, h);
      this.#bgMesh.geometry = this.#bgGeometry;
    }

    // Badge centered at top
    if (this.#badgeMesh) {
      this.#badgeMesh.position.set(0, top - 0.05, 0);
    }

    // Title: "Your " + "mission." side by side, centered
    if (this.#titleYour && this.#titleMission) {
      const totalWidth = this.#titleYour.width + this.#titleMission.width;
      const startX = -totalWidth / 2;
      const titleY = top - 0.22;
      this.#titleYour.mesh.position.set(startX + this.#titleYour.width / 2, titleY, 0);
      this.#titleMission.mesh.position.set(
        startX + this.#titleYour.width + this.#titleMission.width / 2,
        titleY,
        0,
      );
    }

    // Mission image: centered between title and buttons
    if (this.#missionMesh) {
      const titleBottom = top - 0.22 - 0.15;
      const buttonTop = bottom + 0.12 + 0.12;
      const centerY = (titleBottom + buttonTop) / 2;
      this.#missionMesh.position.set(0, centerY, 0);

      // Recompute size on bounds change
      const aspect = this.#missionMesh.geometry.parameters.width / this.#missionMesh.geometry.parameters.height;
      const { worldWidth, worldHeight } = this.#computeMissionSize(aspect);
      this.#missionMesh.geometry.dispose();
      this.#missionMesh.geometry = new PlaneGeometry(worldWidth, worldHeight);
    }

    // Buttons at bottom
    const buttonY = bottom + 0.12;
    const buttonSpacing = 0.4;

    if (this.#backButton) {
      this.#backButton.mesh.position.set(-buttonSpacing, buttonY, 0);
    }
    if (this.#startButton) {
      this.#startButton.mesh.position.set(buttonSpacing, buttonY, 0);
    }
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
  }

  hide() {
    this.#group.visible = false;
  }

  update() {}

  dispose() {
    this.#bgGeometry?.dispose();
    this.#bgMaterial?.dispose();

    if (this.#badgeMesh) {
      (this.#badgeMesh.material as MeshBasicMaterial).map?.dispose();
      (this.#badgeMesh.material as MeshBasicMaterial).dispose();
      this.#badgeMesh.geometry.dispose();
    }

    this.#titleYour?.dispose();
    this.#titleMission?.dispose();

    if (this.#missionMesh) {
      (this.#missionMesh.material as MeshBasicMaterial).map?.dispose();
      (this.#missionMesh.material as MeshBasicMaterial).dispose();
      this.#missionMesh.geometry.dispose();
    }

    this.#backButton?.dispose();
    this.#startButton?.dispose();
  }
}
