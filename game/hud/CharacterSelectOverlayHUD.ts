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

import type { PlayerId } from '../util/input/GamepadManager';

const PADDING = HUDRegionManager.HUD_PADDING;
const LERP_FACTOR = 0.15;
const SQUARE_SIZE = 1.26;
const GAMEPAD_SIZE = 0.25;
const GAMEPAD_MARGIN = 0.06;

interface PlayerState {
  choice: 'left' | 'right' | null;
  ready: boolean;
}

export class CharacterSelectOverlayHUD implements IHUDItem {
  #group: Group;
  #visibleWidth: number;
  #visibleHeight: number;

  // Background
  #bgMesh: Mesh | null = null;
  #bgGeometry: PlaneGeometry | null = null;
  #bgMaterial: MeshBasicMaterial | null = null;

  // Badge
  #badgeMesh: Mesh | null = null;
  #badgeWidth = 0;

  // Titles
  #titlePickYour: TextPlaneResult | null = null;
  #titleBuddy: TextPlaneResult | null = null;

  // Grey squares
  #leftSquare: Mesh | null = null;
  #rightSquare: Mesh | null = null;

  // Gamepad icons
  #gamepadMeshes: [Mesh | null, Mesh | null] = [null, null];
  #gamepadTargetX: [number, number] = [0, 0];
  #gamepadLoaded = false;

  // Buttons (indexed per side: 0=left, 1=right)
  #confirmButtons: [PillButtonPlaneResult | null, PillButtonPlaneResult | null] = [null, null];
  #readyTexts: [TextPlaneResult | null, TextPlaneResult | null] = [null, null];
  #menuButton: PillButtonPlaneResult | null = null;

  // Player state
  #players: [PlayerState, PlayerState] = [
    { choice: null, ready: false },
    { choice: null, ready: false },
  ];

  // Layout reference positions
  #leftSquareX = 0;
  #rightSquareX = 0;
  #centerX = 0;

  constructor({ visibleWidth, visibleHeight }: { visibleWidth: number; visibleHeight: number }) {
    this.#group = new Group();
    this.#visibleWidth = visibleWidth;
    this.#visibleHeight = visibleHeight;

    this.#createBackground();
    this.#createBadge();
    this.#createTitles();
    this.#createSquares();
    this.#loadGamepadIcons();
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
    const text = 'READY?';

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
    this.#badgeWidth = worldWidth;
    this.#group.add(this.#badgeMesh);
  }

  #createTitles() {
    this.#titlePickYour = createTextPlane('Pick your ', {
      height: 0.25,
      fontSize: 128,
      fontFamily: 'IvarSoft, serif',
      fontWeight: '600',
      color: '#000000',
    });
    this.#group.add(this.#titlePickYour.mesh);

    this.#titleBuddy = createTextPlane('Buddy.', {
      height: 0.25,
      fontSize: 128,
      fontFamily: 'IvarSoft, serif',
      fontWeight: '600',
      fontStyle: 'italic',
      color: '#000000',
    });
    this.#group.add(this.#titleBuddy.mesh);
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

    // Border
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
    const texture = this.#createRoundedRectTexture(512, 512, 40, '#808080');
    if (!texture) return;

    const geometry = new PlaneGeometry(SQUARE_SIZE, SQUARE_SIZE);

    const mat1 = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });
    this.#leftSquare = new Mesh(geometry.clone(), mat1);
    this.#leftSquare.renderOrder = 999;
    this.#group.add(this.#leftSquare);

    const texture2 = this.#createRoundedRectTexture(512, 512, 40, '#808080');
    if (!texture2) return;
    const mat2 = new MeshBasicMaterial({
      map: texture2,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });
    this.#rightSquare = new Mesh(geometry.clone(), mat2);
    this.#rightSquare.renderOrder = 999;
    this.#group.add(this.#rightSquare);
  }

  #loadGamepadIcons() {
    const img = new Image();
    img.src = '/game/svg/gamepad.svg';
    img.onload = () => {
      for (let i = 0; i < 2; i++) {
        const dpr = Math.min(window.devicePixelRatio, 2);
        const size = Math.ceil(256 * dpr);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) continue;

        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);

        const texture = new CanvasTexture(canvas);
        texture.minFilter = LinearFilter;
        texture.magFilter = LinearFilter;
        texture.generateMipmaps = false;
        texture.colorSpace = SRGBColorSpace;
        texture.needsUpdate = true;

        const worldSize = 0.25;
        const geometry = new PlaneGeometry(worldSize, worldSize);
        const material = new MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          side: DoubleSide,
        });

        const mesh = new Mesh(geometry, material);
        mesh.renderOrder = 999;
        this.#gamepadMeshes[i] = mesh;
        this.#group.add(mesh);
      }
      this.#gamepadLoaded = true;
      this.#positionElements();
    };
  }

  #createButtons() {
    const buttonOptions = {
      height: 0.18,
      fontFamily: 'BMDupletTXT, system-ui, sans-serif',
      fontWeight: '600',
      fontSize: 64,
      fixedHeight: 160,
    };

    // Confirm buttons (0=left side, 1=right side) — hidden until a player picks that side
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

    // Main menu button (always visible, no background)
    this.#menuButton = createPillButtonPlane(
      [
        { type: 'text', value: 'Main menu ' },
        { type: 'badge', label: 'B', color: '#CC0000' },
      ],
      { ...buttonOptions, transparent: true },
    );
    this.#group.add(this.#menuButton.mesh);
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

    // Title: "Pick your " + "Buddy." side by side, centered
    if (this.#titlePickYour && this.#titleBuddy) {
      const totalWidth = this.#titlePickYour.width + this.#titleBuddy.width;
      const startX = -totalWidth / 2;
      const titleY = top - 0.22;
      this.#titlePickYour.mesh.position.set(startX + this.#titlePickYour.width / 2, titleY, 0);
      this.#titleBuddy.mesh.position.set(startX + this.#titlePickYour.width + this.#titleBuddy.width / 2, titleY, 0);
    }

    // Grey squares
    const squareY = 0;
    this.#leftSquareX = -w / 4;
    this.#rightSquareX = w / 4;
    this.#centerX = 0;

    if (this.#leftSquare) {
      this.#leftSquare.position.set(this.#leftSquareX, squareY, 0);
    }
    if (this.#rightSquare) {
      this.#rightSquare.position.set(this.#rightSquareX, squareY, 0);
    }

    // Gamepad icons — stacked vertically in center
    if (this.#gamepadLoaded) {
      const gap = 0.15;
      for (let i = 0; i < 2; i++) {
        const mesh = this.#gamepadMeshes[i];
        if (!mesh) continue;
        const targetX = this.#getGamepadTargetX(i as 0 | 1);
        this.#gamepadTargetX[i] = targetX;
        const y = squareY + (i === 0 ? gap : -gap);
        mesh.position.set(targetX, y, 0);
      }
    }

    // Buttons at bottom
    const buttonY = bottom + 0.12;

    if (this.#confirmButtons[0]) {
      this.#confirmButtons[0].mesh.position.set(this.#leftSquareX, buttonY, 0);
    }
    if (this.#readyTexts[0]) {
      this.#readyTexts[0].mesh.position.set(this.#leftSquareX, buttonY, 0);
    }

    if (this.#menuButton) {
      this.#menuButton.mesh.position.set(0, buttonY, 0);
    }

    if (this.#confirmButtons[1]) {
      this.#confirmButtons[1].mesh.position.set(this.#rightSquareX, buttonY, 0);
    }
    if (this.#readyTexts[1]) {
      this.#readyTexts[1].mesh.position.set(this.#rightSquareX, buttonY, 0);
    }
  }

  #getGamepadTargetX(playerIndex: 0 | 1): number {
    const choice = this.#players[playerIndex].choice;
    // Position gamepad at the inner edge of the square + margin
    const offset = SQUARE_SIZE / 2 + GAMEPAD_SIZE / 2 + GAMEPAD_MARGIN;
    if (choice === 'left') return this.#leftSquareX + offset;
    if (choice === 'right') return this.#rightSquareX - offset;
    return this.#centerX;
  }

  #sideIndex(side: 'left' | 'right'): 0 | 1 {
    return side === 'left' ? 0 : 1;
  }

  setPlayerChoice(playerId: PlayerId, choice: 'left' | 'right') {
    const idx = (playerId - 1) as 0 | 1;
    const otherIdx = (1 - idx) as 0 | 1;
    const prevChoice = this.#players[idx].choice;

    // Block if other player is already on that side
    if (this.#players[otherIdx].choice === choice) return;

    this.#players[idx].choice = choice;
    this.#gamepadTargetX[idx] = this.#getGamepadTargetX(idx);

    this.#updateSideVisuals(choice);
    if (prevChoice && prevChoice !== choice) this.#updateSideVisuals(prevChoice);
  }

  clearPlayerChoice(playerId: PlayerId) {
    const idx = (playerId - 1) as 0 | 1;
    const prevChoice = this.#players[idx].choice;
    this.#players[idx].choice = null;
    this.#players[idx].ready = false;
    this.#gamepadTargetX[idx] = this.#centerX;

    if (prevChoice) this.#updateSideVisuals(prevChoice);
  }

  #updateSideVisuals(side: 'left' | 'right') {
    const si = this.#sideIndex(side);
    const btn = this.#confirmButtons[si];
    const txt = this.#readyTexts[si];

    // Find player on this side
    const playerOnSide = this.#players.findIndex((p) => p.choice === side);
    const hasPlayer = playerOnSide !== -1;
    const isReady = hasPlayer && this.#players[playerOnSide]!.ready;

    if (btn) btn.mesh.visible = hasPlayer && !isReady;
    if (txt) txt.mesh.visible = isReady;
  }

  setPlayerReady(playerId: PlayerId, ready: boolean) {
    const idx = (playerId - 1) as 0 | 1;
    this.#players[idx].ready = ready;
    const choice = this.#players[idx].choice;
    if (choice) this.#updateSideVisuals(choice);
  }

  getPlayerState(playerId: PlayerId): PlayerState {
    return this.#players[(playerId - 1) as 0 | 1];
  }

  areBothReady(): boolean {
    return this.#players[0].ready && this.#players[1].ready;
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
    // Reset player state
    for (let i = 0; i < 2; i++) {
      this.#players[i] = { choice: null, ready: false };
      this.#gamepadTargetX[i] = this.#centerX;
      // Snap gamepad to center
      const mesh = this.#gamepadMeshes[i];
      if (mesh) mesh.position.x = this.#centerX;
    }
    // Reset side visuals (no player on either side)
    this.#updateSideVisuals('left');
    this.#updateSideVisuals('right');
  }

  hide() {
    this.#group.visible = false;
  }

  update() {
    // Lerp gamepad icons toward target
    for (const i of [0, 1] as const) {
      const mesh = this.#gamepadMeshes[i];
      if (!mesh) continue;
      const target = this.#gamepadTargetX[i];
      mesh.position.x += (target - mesh.position.x) * LERP_FACTOR;
    }
  }

  dispose() {
    this.#bgGeometry?.dispose();
    this.#bgMaterial?.dispose();

    if (this.#badgeMesh) {
      (this.#badgeMesh.material as MeshBasicMaterial).map?.dispose();
      (this.#badgeMesh.material as MeshBasicMaterial).dispose();
      this.#badgeMesh.geometry.dispose();
    }

    this.#titlePickYour?.dispose();
    this.#titleBuddy?.dispose();

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

    for (const mesh of this.#gamepadMeshes) {
      if (!mesh) continue;
      (mesh.material as MeshBasicMaterial).map?.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
      mesh.geometry.dispose();
    }

    for (const btn of this.#confirmButtons) btn?.dispose();
    for (const txt of this.#readyTexts) txt?.dispose();
    this.#menuButton?.dispose();
  }
}
