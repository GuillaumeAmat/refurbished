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

import { COLORS, LEADERBOARD_LIMIT, LEADERBOARD_REFRESH_MS } from '../constants';
import {
  createLeaderboardTableTexture,
  type ScoreEntry,
} from '../lib/createLeaderboardTableTexture';
import { createPillButtonPlane, type PillButtonPlaneResult } from '../lib/createPillButtonPlane';
import { createQRCodePlane, type QRCodePlaneResult } from '../lib/createQRCodePlane';
import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import { HUDRegionManager } from './HUDRegionManager';
import type { IHUDItem } from './IHUDItem';

const QR_URL = 'https://refurbished.amat.io/leaderboard';
const PADDING = HUDRegionManager.HUD_PADDING;
const TITLE_HEIGHT = 0.25;

export class LeaderboardOverlayHUD implements IHUDItem {
  #group: Group;

  // Elements
  #bgMesh: Mesh | null = null;
  #bgGeometry: PlaneGeometry | null = null;
  #bgMaterial: MeshBasicMaterial | null = null;
  #top15Text: { mesh: Mesh; width: number; dispose: () => void } | null = null;
  #titleThe: TextPlaneResult | null = null;
  #titleLeaderboard: TextPlaneResult | null = null;
  #qrCode: QRCodePlaneResult | null = null;
  #backButton: PillButtonPlaneResult | null = null;
  #tableMesh: Mesh | null = null;
  #tableGeometry: PlaneGeometry | null = null;
  #tableMaterial: MeshBasicMaterial | null = null;

  #visibleWidth: number;
  #visibleHeight: number;
  #refreshInterval: ReturnType<typeof setInterval> | null = null;
  #lastScores: ScoreEntry[] = [];

  constructor({ visibleWidth, visibleHeight }: { visibleWidth: number; visibleHeight: number }) {
    this.#group = new Group();
    this.#visibleWidth = visibleWidth;
    this.#visibleHeight = visibleHeight;

    this.#createBackground();
    this.#createTop15Badge();
    this.#createTitles();
    this.#createBackButton();
    this.#createTable([]);
    this.#createQRCode();
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

  #createTop15Badge() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const fontSize = 28 * dpr;
    const pad = 8 * dpr;
    const text = 'TOP 15';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const fontString = `600 ${fontSize}px BMDupletDSP, system-ui, sans-serif`;
    ctx.font = fontString;
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize;

    canvas.width = Math.ceil(textWidth + pad * 2);
    canvas.height = Math.ceil(textHeight + pad * 2);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Mindaro background rect
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

    // Black text
    ctx.font = fontString;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000000';
    ctx.fillText(text, pad, pad);

    const texture = new CanvasTexture(canvas);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;

    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const worldHeight = 0.1;
    const worldWidth = worldHeight * (width / height);

    const geometry = new PlaneGeometry(worldWidth, worldHeight);
    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });

    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = 999;

    this.#top15Text = {
      mesh,
      width: worldWidth,
      dispose: () => {
        texture.dispose();
        geometry.dispose();
        material.dispose();
      },
    };
    this.#group.add(mesh);
  }

  #createTitles() {
    this.#titleThe = createTextPlane('The', {
      height: TITLE_HEIGHT,
      fontSize: 128,
      fontFamily: 'IvarSoft, serif',
      fontWeight: '600',
      color: '#000000',
    });
    this.#group.add(this.#titleThe.mesh);

    this.#titleLeaderboard = createTextPlane('Leaderboard.', {
      height: TITLE_HEIGHT,
      fontSize: 128,
      fontFamily: 'IvarSoft, serif',
      fontWeight: '600',
      fontStyle: 'italic',
      color: '#000000',
    });
    this.#group.add(this.#titleLeaderboard.mesh);
  }

  async #createQRCode() {
    const qrHeight = 0.5;
    this.#qrCode = await createQRCodePlane(QR_URL, qrHeight);
    this.#group.add(this.#qrCode.mesh);
    this.#positionElements();
  }

  #createBackButton() {
    // Same size as start screen button
    this.#backButton = createPillButtonPlane('Main menu (A)', {
      height: 0.22,
      fontFamily: 'BMDupletTXT, system-ui, sans-serif',
      fontWeight: '600',
      fontSize: 64,
      fixedHeight: 160,
    });
    this.#group.add(this.#backButton.mesh);
  }

  #createTable(scores: ScoreEntry[]) {
    // Dispose old table
    if (this.#tableMesh) {
      this.#group.remove(this.#tableMesh);
      this.#tableGeometry?.dispose();
      this.#tableMaterial?.dispose();
    }

    const h = this.#visibleHeight;
    const tableWorldHeight = h - PADDING * 2;
    // Convert world units to CSS px for the texture (approximate: 1 world unit ≈ 200 CSS px)
    const targetCSSHeight = tableWorldHeight * 200;

    const tableResult = createLeaderboardTableTexture(scores, LEADERBOARD_LIMIT, targetCSSHeight);
    const tableWorldWidth = tableWorldHeight * tableResult.aspectRatio;

    this.#tableGeometry = new PlaneGeometry(tableWorldWidth, tableWorldHeight);
    this.#tableMaterial = new MeshBasicMaterial({
      map: tableResult.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });

    this.#tableMesh = new Mesh(this.#tableGeometry, this.#tableMaterial);
    this.#tableMesh.renderOrder = 999;
    this.#group.add(this.#tableMesh);
    this.#positionElements();
  }

  #positionElements() {
    const w = this.#visibleWidth;
    const h = this.#visibleHeight;
    const left = -w / 2 + PADDING;
    const right = w / 2 - PADDING;
    const top = h / 2 - PADDING;
    const bottom = -h / 2 + PADDING;

    // Background
    if (this.#bgMesh && this.#bgGeometry) {
      this.#bgGeometry.dispose();
      this.#bgGeometry = new PlaneGeometry(w, h);
      this.#bgMesh.geometry = this.#bgGeometry;
    }

    // TOP 15 badge — top-left, left-aligned
    if (this.#top15Text) {
      this.#top15Text.mesh.position.set(left + this.#top15Text.width / 2, top - 0.07, 0);
    }

    // "The" — below TOP 15
    if (this.#titleThe) {
      this.#titleThe.mesh.position.set(left + this.#titleThe.width / 2, top - 0.3, 0);
    }

    // "Leaderboard." — below "The"
    if (this.#titleLeaderboard) {
      this.#titleLeaderboard.mesh.position.set(
        left + this.#titleLeaderboard.width / 2,
        top - 0.57,
        0,
      );
    }

    // QR code — vertically centered, same horizontal placement (left side)
    if (this.#qrCode) {
      this.#qrCode.mesh.position.set(left + this.#qrCode.width / 2 + 0.05, 0, 0);
    }

    // Back button — bottom-left
    if (this.#backButton) {
      this.#backButton.mesh.position.set(left + this.#backButton.width / 2, bottom + 0.12, 0);
    }

    // Table — right side, full height, vertically centered
    if (this.#tableMesh && this.#tableGeometry) {
      const tableHeight = h - PADDING * 2;
      const tableWidth = tableHeight * (this.#tableGeometry.parameters.width / this.#tableGeometry.parameters.height);
      this.#tableMesh.position.set(right - tableWidth / 2, 0, 0);
    }
  }

  updateBounds(visibleWidth: number, visibleHeight: number) {
    this.#visibleWidth = visibleWidth;
    this.#visibleHeight = visibleHeight;
    this.#createTable(this.#lastScores);
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
    this.#fetchScores();
    this.#refreshInterval = setInterval(() => this.#fetchScores(), LEADERBOARD_REFRESH_MS);
  }

  async #fetchScores() {
    try {
      const res = await fetch(`/api/scores?limit=${LEADERBOARD_LIMIT}`);
      const data = (await res.json()) as ScoreEntry[];
      this.#lastScores = data;
      this.#createTable(data);
    } catch {
      // Keep current display on error
    }
  }

  hide() {
    this.#group.visible = false;
    if (this.#refreshInterval !== null) {
      clearInterval(this.#refreshInterval);
      this.#refreshInterval = null;
    }
  }

  update() {}

  dispose() {
    if (this.#refreshInterval !== null) {
      clearInterval(this.#refreshInterval);
      this.#refreshInterval = null;
    }
    this.#bgGeometry?.dispose();
    this.#bgMaterial?.dispose();
    this.#top15Text?.dispose();
    this.#titleThe?.dispose();
    this.#titleLeaderboard?.dispose();
    this.#qrCode?.dispose();
    this.#backButton?.dispose();
    this.#tableGeometry?.dispose();
    this.#tableMaterial?.dispose();
  }
}
