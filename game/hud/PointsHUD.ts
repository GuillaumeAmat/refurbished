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
import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import { ComboManager } from '../state/ComboManager';
import { ScoreManager } from '../state/ScoreManager';
import { Debug } from '../util/Debug';
import type { IHUDItem } from './IHUDItem';

export class PointsHUD implements IHUDItem {
  #group: Group;
  #text: TextPlaneResult | null = null;
  #scoreManager: ScoreManager;
  #comboManager: ComboManager;
  #onScoreChanged: EventListener;
  #onComboChanged: EventListener;
  #comboBadgeMesh: Mesh | null = null;
  #comboBadgeGeometry: PlaneGeometry | null = null;
  #comboBadgeMaterial: MeshBasicMaterial | null = null;
  #comboBadgeTexture: CanvasTexture | null = null;

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
    forceCombo: false,
  };

  constructor() {
    this.#group = new Group();
    this.#scoreManager = ScoreManager.getInstance();
    this.#comboManager = ComboManager.getInstance();
    this.#createText();

    this.#onScoreChanged = ((event: CustomEvent) => {
      this.#updateScore(event.detail.score);
    }) as EventListener;
    this.#scoreManager.addEventListener('scoreChanged', this.#onScoreChanged);

    this.#onComboChanged = ((e: CustomEvent) => {
      this.#updateComboBadge(e.detail.multiplier);
    }) as EventListener;
    this.#comboManager.addEventListener('comboChanged', this.#onComboChanged);

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

    this.#createComboBadge(this.#comboManager.getMultiplier());
  }

  #createComboBadge(multiplier: number) {
    // Dispose previous
    if (this.#comboBadgeMesh) {
      this.#comboBadgeMesh.removeFromParent();
    }
    this.#comboBadgeGeometry?.dispose();
    this.#comboBadgeMaterial?.dispose();
    this.#comboBadgeTexture?.dispose();
    this.#comboBadgeMesh = null;
    this.#comboBadgeGeometry = null;
    this.#comboBadgeMaterial = null;
    this.#comboBadgeTexture = null;

    const dpr = Math.min(window.devicePixelRatio, 2);
    const worldDiameter = this.#params.height / 2;
    const canvasSize = Math.ceil(this.#params.fontSize / 2) * dpr * 2; // square canvas, diameter in px
    const radius = canvasSize / 2;

    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasSize, canvasSize);
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.mindaro;
    ctx.fill();

    const badgeFontSize = Math.ceil((this.#params.fontSize / 2) * dpr);
    ctx.font = `600 ${badgeFontSize}px BMDupletDSP, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000000';
    ctx.fillText(`x${multiplier}`, radius, radius);

    const texture = new CanvasTexture(canvas);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;

    this.#comboBadgeTexture = texture;
    this.#comboBadgeGeometry = new PlaneGeometry(worldDiameter, worldDiameter);
    this.#comboBadgeMaterial = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });

    this.#comboBadgeMesh = new Mesh(this.#comboBadgeGeometry, this.#comboBadgeMaterial);
    this.#comboBadgeMesh.renderOrder = 1000;
    this.#comboBadgeMesh.visible = multiplier > 1;
    this.#group.add(this.#comboBadgeMesh);

    this.#positionComboBadge();
  }

  #positionComboBadge() {
    if (!this.#comboBadgeMesh || !this.#text) return;
    const x = this.#text.width + this.#params.posX;
    const y = this.#params.posY + this.#params.height / 2;
    this.#comboBadgeMesh.position.set(x, y, 0);
  }

  #updateComboBadge(multiplier: number) {
    if (!this.#comboBadgeMesh || !this.#comboBadgeTexture) return;

    if (multiplier <= 1) {
      this.#comboBadgeMesh.visible = false;
      return;
    }

    const canvas = this.#comboBadgeTexture.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const canvasSize = canvas.width;
    const radius = canvasSize / 2;
    const dpr = Math.min(window.devicePixelRatio, 2);

    ctx.clearRect(0, 0, canvasSize, canvasSize);
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.mindaro;
    ctx.fill();

    const badgeFontSize = Math.ceil((this.#params.fontSize / 2) * dpr);
    ctx.font = `600 ${badgeFontSize}px BMDupletDSP, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000000';
    ctx.fillText(`x${multiplier}`, radius, radius);

    this.#comboBadgeTexture.needsUpdate = true;
    this.#comboBadgeMesh.visible = true;
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
      this.#positionComboBadge();
    };

    folder.add(this.#params, 'height', 0.1, 1, 0.01).name('Height').onChange(rebuild);
    folder.add(this.#params, 'fontSize', 32, 300, 1).name('Font Size').onChange(rebuild);
    folder.add(this.#params, 'posX', -2, 2, 0.01).name('Position X').onChange(updateTransform);
    folder.add(this.#params, 'posY', -2, 2, 0.01).name('Position Y').onChange(updateTransform);
    folder.add(this.#params, 'rotation', -0.5, 0.5, 0.01).name('Rotation').onChange(updateTransform);
    folder.add(this.#params, 'shadowBlur', 0, 40, 1).name('Shadow Blur').onChange(rebuild);
    folder.add(this.#params, 'shadowOffsetX', -20, 20, 1).name('Shadow X').onChange(rebuild);
    folder.add(this.#params, 'shadowOffsetY', -20, 20, 1).name('Shadow Y').onChange(rebuild);
    folder.add(this.#params, 'forceCombo').name('Force x3 Combo').onChange((v: boolean) => {
      this.#updateComboBadge(v ? 3 : this.#comboManager.getMultiplier());
    });
    folder.close();
  }

  #updateScore(score: number) {
    if (this.#text) {
      this.#text.updateText(`${score}`);
      this.#text.mesh.position.x = this.#text.width / 2 + this.#params.posX;
      this.#positionComboBadge();
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
    this.#comboManager.removeEventListener('comboChanged', this.#onComboChanged);
    this.#text?.dispose();
    this.#comboBadgeGeometry?.dispose();
    this.#comboBadgeMaterial?.dispose();
    this.#comboBadgeTexture?.dispose();
  }
}
