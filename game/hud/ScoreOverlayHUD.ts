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

import { COLORS, STAR_THRESHOLDS } from '../constants';
import { createPillButtonPlane, type PillButtonPlaneResult } from '../lib/createPillButtonPlane';
import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import { ScoreManager } from '../state/ScoreManager';
import { HUDRegionManager } from './HUDRegionManager';
import type { IHUDItem } from './IHUDItem';

const PADDING = HUDRegionManager.HUD_PADDING;
const SQUARE_SIZE = 1.26 * 1.1;
const SQUARE_BORDER_RADIUS = 20;
const ARROW_SIZE = 0.18 * 0.7;
const ARROW_MARGIN = 0.06;

export class ScoreOverlayHUD implements IHUDItem {
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
  #titleSaveYour: TextPlaneResult | null = null;
  #titleScore: TextPlaneResult | null = null;

  // Grey squares
  #leftSquare: Mesh | null = null;
  #rightSquare: Mesh | null = null;

  // Center content
  #scoreText: TextPlaneResult | null = null;
  #starsText: TextPlaneResult | null = null;

  // Pseudo inputs (0=left, 1=right)
  #pseudoTexts: [TextPlaneResult | null, TextPlaneResult | null] = [null, null];

  // Arrow chevrons (0=left side, 1=right side), each pair is [up, down]
  #arrowMeshes: [[Mesh | null, Mesh | null], [Mesh | null, Mesh | null]] = [
    [null, null],
    [null, null],
  ];

  // Buttons (indexed per side: 0=left, 1=right)
  #confirmButtons: [PillButtonPlaneResult | null, PillButtonPlaneResult | null] = [null, null];
  #readyTexts: [TextPlaneResult | null, TextPlaneResult | null] = [null, null];
  #skipButton: PillButtonPlaneResult | null = null;

  // Per-side ready state
  #sideReady: [boolean, boolean] = [false, false];

  // Layout reference positions
  #leftSquareX = 0;
  #rightSquareX = 0;

  #scoreManager: ScoreManager;

  constructor({ visibleWidth, visibleHeight }: { visibleWidth: number; visibleHeight: number }) {
    this.#group = new Group();
    this.#visibleWidth = visibleWidth;
    this.#visibleHeight = visibleHeight;
    this.#scoreManager = ScoreManager.getInstance();

    this.#createBackground();
    this.#createBadge();
    this.#createTitles();
    this.#createSquares();
    this.#createCenterContent();
    this.#createPseudoInputs();
    this.#createArrows();
    this.#createButtons();
    this.#positionElements();
  }

  #createBackground() {
    this.#bgGeometry = new PlaneGeometry(this.#visibleWidth, this.#visibleHeight);
    this.#bgMaterial = new MeshBasicMaterial({
      color: 0xf5f5f5,
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
    const text = 'GAME OVER';

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
    this.#titleSaveYour = createTextPlane('Save your ', {
      height: 0.25,
      fontSize: 128,
      fontFamily: 'IvarSoft, serif',
      fontWeight: '600',
      color: '#000000',
    });
    this.#group.add(this.#titleSaveYour.mesh);

    this.#titleScore = createTextPlane('Score.', {
      height: 0.25,
      fontSize: 128,
      fontFamily: 'IvarSoft, serif',
      fontWeight: '600',
      fontStyle: 'italic',
      color: '#000000',
    });
    this.#group.add(this.#titleScore.mesh);
  }

  #createRoundedRectTexture(cssWidth: number, cssHeight: number, radius: number, fillColor: string) {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = Math.ceil(cssWidth * dpr);
    const h = Math.ceil(cssHeight * dpr);
    const r = radius * dpr;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return null;

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

    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();

    const texture = new CanvasTexture(canvas);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;

    return texture;
  }

  #createSquares() {
    const geometry = new PlaneGeometry(SQUARE_SIZE, SQUARE_SIZE);

    const loadRounded = (src: string, onReady: (mesh: Mesh) => void) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        const dpr = Math.min(window.devicePixelRatio, 2);
        const size = Math.ceil(512 * dpr);
        const r = SQUARE_BORDER_RADIUS * dpr;

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        ctx.clearRect(0, 0, size, size);
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(size - r, 0);
        ctx.quadraticCurveTo(size, 0, size, r);
        ctx.lineTo(size, size - r);
        ctx.quadraticCurveTo(size, size, size - r, size);
        ctx.lineTo(r, size);
        ctx.quadraticCurveTo(0, size, 0, size - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(img, 0, 0, size, size);

        const texture = new CanvasTexture(canvas);
        texture.minFilter = LinearFilter;
        texture.magFilter = LinearFilter;
        texture.generateMipmaps = false;
        texture.colorSpace = SRGBColorSpace;
        texture.needsUpdate = true;

        const mat = new MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          side: DoubleSide,
        });
        const mesh = new Mesh(geometry.clone(), mat);
        mesh.renderOrder = 999;
        onReady(mesh);
      };
    };

    loadRounded('/game/texture/characters/pig.webp', (mesh) => {
      this.#leftSquare = mesh;
      this.#group.add(mesh);
      this.#positionElements();
    });

    loadRounded('/game/texture/characters/croco.webp', (mesh) => {
      this.#rightSquare = mesh;
      this.#group.add(mesh);
      this.#positionElements();
    });
  }

  #createCenterContent() {
    const score = this.#scoreManager.getScore();

    this.#scoreText = createTextPlane(`${score}`, {
      height: 0.18,
      fontSize: 96,
      fontFamily: 'BMDupletDSP, system-ui, sans-serif',
      fontWeight: '600',
      color: '#000000',
    });
    this.#scoreText.mesh.renderOrder = 999;
    this.#group.add(this.#scoreText.mesh);

    this.#starsText = createTextPlane(this.#computeStars(score), {
      height: 0.14,
      fontSize: 72,
      color: '#FBD954',
    });
    this.#starsText.mesh.renderOrder = 999;
    this.#group.add(this.#starsText.mesh);
  }

  #computeStars(score: number): string {
    let count = 0;
    for (const threshold of STAR_THRESHOLDS) {
      if (score >= threshold) count++;
    }
    return '\u2605'.repeat(count) + '\u2606'.repeat(STAR_THRESHOLDS.length - count);
  }

  #createPseudoInputs() {
    for (let i = 0; i < 2; i++) {
      const txt = createTextPlane('___', {
        height: 0.18,
        fontSize: 96,
        fontFamily: 'RobotoMono, monospace',
        fontWeight: '600',
        color: '#000000',
        referenceText: 'AAA',
      });
      txt.mesh.renderOrder = 999;
      this.#pseudoTexts[i] = txt;
      this.#group.add(txt.mesh);
    }
  }

  #createArrowTexture(direction: 'up' | 'down') {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const size = Math.ceil(128 * dpr);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 12 * dpr;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const cx = size / 2;
    const cy = size / 2;
    const hs = size * 0.22;
    if (direction === 'up') {
      ctx.moveTo(cx - hs, cy + hs);
      ctx.lineTo(cx, cy - hs);
      ctx.lineTo(cx + hs, cy + hs);
    } else {
      ctx.moveTo(cx - hs, cy - hs);
      ctx.lineTo(cx, cy + hs);
      ctx.lineTo(cx + hs, cy - hs);
    }
    ctx.stroke();

    const texture = new CanvasTexture(canvas);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  #createArrows() {
    for (let i = 0; i < 2; i++) {
      for (const [ai, dir] of ([[0, 'up'], [1, 'down']] as const)) {
        const tex = this.#createArrowTexture(dir);
        if (!tex) continue;
        const geo = new PlaneGeometry(ARROW_SIZE, ARROW_SIZE);
        const mat = new MeshBasicMaterial({
          map: tex,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          side: DoubleSide,
        });
        const mesh = new Mesh(geo, mat);
        mesh.renderOrder = 999;
        this.#arrowMeshes[i][ai] = mesh;
        this.#group.add(mesh);
      }
    }
  }

  #createButtons() {
    const buttonOptions = {
      height: 0.18,
      fontFamily: 'BMDupletTXT, system-ui, sans-serif',
      fontWeight: '600',
      fontSize: 64,
      fixedHeight: 160,
    };

    // Confirm buttons (0=left side, 1=right side) — hidden until pseudo complete
    for (let i = 0; i < 2; i++) {
      const btn = createPillButtonPlane(
        [
          { type: 'text', value: 'Confirm ' },
          { type: 'badge', label: 'A', color: '#107C10' },
        ],
        buttonOptions,
      );
      btn.mesh.visible = false;
      this.#confirmButtons[i] = btn;
      this.#group.add(btn.mesh);
    }

    // Ready texts (hidden initially)
    for (let i = 0; i < 2; i++) {
      const txt = createTextPlane('Ready!', {
        height: 0.18,
        fontSize: 128,
        fontFamily: 'BMDupletTXT, system-ui, sans-serif',
        fontWeight: '600',
        color: '#000000',
      });
      txt.mesh.visible = false;
      this.#readyTexts[i] = txt;
      this.#group.add(txt.mesh);
    }

    // Skip button (always visible, no background)
    this.#skipButton = createPillButtonPlane(
      [
        { type: 'text', value: 'Skip ' },
        { type: 'badge', label: 'B', color: '#CC0000' },
      ],
      { ...buttonOptions, transparent: true },
    );
    this.#group.add(this.#skipButton.mesh);
  }

  #positionElements() {
    const w = this.#visibleWidth;
    const h = this.#visibleHeight;
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

    // Title: "Save your " + "Score." side by side, centered
    if (this.#titleSaveYour && this.#titleScore) {
      const totalWidth = this.#titleSaveYour.width + this.#titleScore.width;
      const startX = -totalWidth / 2;
      const titleY = top - 0.22;
      this.#titleSaveYour.mesh.position.set(startX + this.#titleSaveYour.width / 2, titleY, 0);
      this.#titleScore.mesh.position.set(startX + this.#titleSaveYour.width + this.#titleScore.width / 2, titleY + 0.015, 0);
    }

    // Grey squares
    const squareY = 0;
    this.#leftSquareX = -w / 4;
    this.#rightSquareX = w / 4;

    if (this.#leftSquare) {
      this.#leftSquare.position.set(this.#leftSquareX, squareY, 0);
    }
    if (this.#rightSquare) {
      this.#rightSquare.position.set(this.#rightSquareX, squareY, 0);
    }

    // Center content: score + stars
    if (this.#scoreText) {
      this.#scoreText.mesh.position.set(0, 0.1, 0);
    }
    if (this.#starsText) {
      this.#starsText.mesh.position.set(0, -0.1, 0);
    }

    // Pseudo inputs: between square and confirm button
    const buttonY = bottom + 0.12;
    const pseudoY = buttonY + 0.26;

    if (this.#pseudoTexts[0]) {
      this.#pseudoTexts[0].mesh.position.set(this.#leftSquareX, pseudoY, 0);
    }
    if (this.#pseudoTexts[1]) {
      this.#pseudoTexts[1].mesh.position.set(this.#rightSquareX, pseudoY, 0);
    }

    // Arrow chevrons above/below pseudo inputs
    const arrowOffsetY = 0.18 / 2 + ARROW_SIZE / 2 + ARROW_MARGIN;
    for (let i = 0; i < 2; i++) {
      const squareX = i === 0 ? this.#leftSquareX : this.#rightSquareX;
      const [upArrow, downArrow] = this.#arrowMeshes[i];
      if (upArrow) upArrow.position.set(squareX, pseudoY + arrowOffsetY, 0);
      if (downArrow) downArrow.position.set(squareX, pseudoY - arrowOffsetY, 0);
    }

    // Buttons at bottom
    if (this.#confirmButtons[0]) {
      this.#confirmButtons[0].mesh.position.set(this.#leftSquareX, buttonY, 0);
    }
    if (this.#readyTexts[0]) {
      this.#readyTexts[0].mesh.position.set(this.#leftSquareX, buttonY, 0);
    }

    if (this.#skipButton) {
      this.#skipButton.mesh.position.set(0, buttonY, 0);
    }

    if (this.#confirmButtons[1]) {
      this.#confirmButtons[1].mesh.position.set(this.#rightSquareX, buttonY, 0);
    }
    if (this.#readyTexts[1]) {
      this.#readyTexts[1].mesh.position.set(this.#rightSquareX, buttonY, 0);
    }
  }

  setPseudoDisplay(sideIndex: 0 | 1, display: string) {
    this.#pseudoTexts[sideIndex]?.updateText(display);
  }

  setCursorPosition(sideIndex: 0 | 1, cursorPos: number) {
    const pseudo = this.#pseudoTexts[sideIndex];
    if (!pseudo) return;
    const squareX = sideIndex === 0 ? this.#leftSquareX : this.#rightSquareX;
    const charWidth = pseudo.width / 3;
    const charX = squareX - pseudo.width / 2 + (cursorPos + 0.5) * charWidth;
    const [upArrow, downArrow] = this.#arrowMeshes[sideIndex];
    if (upArrow) upArrow.position.x = charX;
    if (downArrow) downArrow.position.x = charX;
  }

  setConfirmVisible(sideIndex: 0 | 1, visible: boolean) {
    const btn = this.#confirmButtons[sideIndex];
    if (btn) btn.mesh.visible = visible && !this.#sideReady[sideIndex];
  }

  setSideReady(sideIndex: 0 | 1, ready: boolean) {
    this.#sideReady[sideIndex] = ready;
    const btn = this.#confirmButtons[sideIndex];
    const txt = this.#readyTexts[sideIndex];
    if (btn) btn.mesh.visible = !ready && btn.mesh.visible;
    if (txt) txt.mesh.visible = ready;
    const [upArrow, downArrow] = this.#arrowMeshes[sideIndex];
    if (upArrow) upArrow.visible = !ready;
    if (downArrow) downArrow.visible = !ready;
    if (!ready && btn) {
      // When unreadying, re-show confirm if pseudo is complete (caller manages this)
    }
  }

  areBothReady(): boolean {
    return this.#sideReady[0] && this.#sideReady[1];
  }

  updateScore() {
    const score = this.#scoreManager.getScore();
    this.#scoreText?.updateText(`${score}`);
    this.#starsText?.updateText(this.#computeStars(score));
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
    this.#sideReady = [false, false];
    for (let i = 0; i < 2; i++) {
      this.#pseudoTexts[i]?.updateText('A__');
      if (this.#confirmButtons[i]) this.#confirmButtons[i]!.mesh.visible = false;
      if (this.#readyTexts[i]) this.#readyTexts[i]!.mesh.visible = false;
    }
    this.updateScore();
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

    this.#titleSaveYour?.dispose();
    this.#titleScore?.dispose();

    if (this.#leftSquare) {
      (this.#leftSquare.material as MeshBasicMaterial).map?.dispose();
      (this.#leftSquare.material as MeshBasicMaterial).dispose();
      this.#leftSquare.geometry.dispose();
    }
    if (this.#rightSquare) {
      (this.#rightSquare.material as MeshBasicMaterial).map?.dispose();
      (this.#rightSquare.material as MeshBasicMaterial).dispose();
      this.#rightSquare.geometry.dispose();
    }

    this.#scoreText?.dispose();
    this.#starsText?.dispose();

    for (const txt of this.#pseudoTexts) txt?.dispose();
    for (const pair of this.#arrowMeshes) {
      for (const mesh of pair) {
        if (!mesh) continue;
        (mesh.material as MeshBasicMaterial).map?.dispose();
        (mesh.material as MeshBasicMaterial).dispose();
        mesh.geometry.dispose();
      }
    }
    for (const btn of this.#confirmButtons) btn?.dispose();
    for (const txt of this.#readyTexts) txt?.dispose();
    this.#skipButton?.dispose();
  }
}
