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

import { type Order, type OrderZone, OrderManager } from '../state/OrderManager';
import { Resources } from '../util/Resources';
import type { IHUDItem } from './IHUDItem';

// Card dimensions in world units
const CARD_WIDTH = 0.15;
const CARD_HEIGHT = 0.22;
const CARD_GAP = 0.02;
const BAR_HEIGHT = 0.012;

// Canvas dimensions (high DPI)
const DPR = 2;
const CANVAS_W = Math.round(CARD_WIDTH * 1000 * DPR); // 300
const CANVAS_H = Math.round(CARD_HEIGHT * 1000 * DPR); // 440
const CORNER_R = 14 * DPR;

const ZONE_HEX: Record<OrderZone, number> = {
  green: 0x4caf50,
  yellow: 0xffc107,
  red: 0xf44336,
};

const BAR_BG_HEX = 0xdddddd;

// Slide-in animation speed (lerp factor per frame)
const SLIDE_SPEED = 0.12;

interface OrderCard {
  group: Group;
  cardGeometry: PlaneGeometry;
  cardMaterial: MeshBasicMaterial;
  cardTexture: CanvasTexture;
  barBgGeometry: PlaneGeometry;
  barBgMaterial: MeshBasicMaterial;
  barFillGeometry: PlaneGeometry;
  barFillMaterial: MeshBasicMaterial;
  barFillMesh: Mesh;
  targetX: number;
}

export class OrderQueueHUD implements IHUDItem {
  static readonly HEIGHT = CARD_HEIGHT;

  #group: Group;
  #cards: OrderCard[] = [];
  #orderManager: OrderManager;
  #bodyCanvas: HTMLCanvasElement | null = null;

  constructor() {
    this.#group = new Group();
    this.#orderManager = OrderManager.getInstance();
    this.#bodyCanvas = this.#renderCardBody();
  }

  /** Pre-render the static card body (white bg + icons) once, reused for all cards. */
  #renderCardBody(): HTMLCanvasElement | null {
    const res = Resources.getInstance();
    const phoneImg = res.getTextureAsset('phoneIcon')?.image as HTMLImageElement | undefined;
    const batteryImg = res.getTextureAsset('batteryFilledIcon')?.image as HTMLImageElement | undefined;
    const screenImg = res.getTextureAsset('screenRepairedIcon')?.image as HTMLImageElement | undefined;
    const frameImg = res.getTextureAsset('frameRepairedIcon')?.image as HTMLImageElement | undefined;
    const packageImg = res.getTextureAsset('packageOpenIcon')?.image as HTMLImageElement | undefined;

    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return null;

    // White card shape: straight top (bleed), rounded bottom corners
    const r = CORNER_R;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(CANVAS_W, 0);
    ctx.lineTo(CANVAS_W, CANVAS_H - r);
    ctx.arcTo(CANVAS_W, CANVAS_H, CANVAS_W - r, CANVAS_H, r);
    ctx.lineTo(r, CANVAS_H);
    ctx.arcTo(0, CANVAS_H, 0, CANVAS_H - r, r);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Subtle border
    ctx.strokeStyle = '#d0d0d0';
    ctx.lineWidth = 2;
    ctx.stroke();

    // --- Icon layout ---
    const barArea = Math.round(BAR_HEIGHT / CARD_HEIGHT * CANVAS_H); // progress bar reserved area
    const contentTop = barArea + 10 * DPR;
    const contentH = CANVAS_H - contentTop - 8 * DPR;

    // Phone icon: top 38% of content area
    const phoneSize = Math.round(contentH * 0.38);
    const phoneX = (CANVAS_W - phoneSize) / 2;
    const phoneY = contentTop + 4 * DPR;
    if (phoneImg) {
      ctx.drawImage(phoneImg, phoneX, phoneY, phoneSize, phoneSize);
    }

    // Separator line
    const sepY = phoneY + phoneSize + 6 * DPR;
    ctx.beginPath();
    ctx.moveTo(16 * DPR, sepY);
    ctx.lineTo(CANVAS_W - 16 * DPR, sepY);
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1.5 * DPR;
    ctx.stroke();

    // 3 resource icons row (battery, screen, frame) — matches workbench order
    const resSize = Math.round(contentH * 0.18);
    const resY = sepY + 8 * DPR;
    const resGap = (CANVAS_W - 3 * resSize) / 4;
    const icons = [batteryImg, screenImg, frameImg];
    for (let i = 0; i < 3; i++) {
      const x = resGap + i * (resSize + resGap);
      const img = icons[i];
      if (img) {
        ctx.drawImage(img, x, resY, resSize, resSize);
      }
    }

    // Package icon (centered, bottom)
    const pkgSize = Math.round(contentH * 0.22);
    const pkgY = resY + resSize + 6 * DPR;
    const pkgX = (CANVAS_W - pkgSize) / 2;
    if (packageImg) {
      ctx.drawImage(packageImg, pkgX, pkgY, pkgSize, pkgSize);
    }

    return canvas;
  }

  #ensureCardCount(count: number): void {
    while (this.#cards.length < count) {
      const card = this.#createCard();
      this.#cards.push(card);
      this.#group.add(card.group);
    }
  }

  #createCard(): OrderCard {
    const group = new Group();
    group.visible = false;

    // Clone the pre-rendered card body onto a new canvas
    const cardCanvas = document.createElement('canvas');
    cardCanvas.width = CANVAS_W;
    cardCanvas.height = CANVAS_H;
    const ctx = cardCanvas.getContext('2d');
    if (ctx && this.#bodyCanvas) {
      ctx.drawImage(this.#bodyCanvas, 0, 0);
    }

    const cardTexture = new CanvasTexture(cardCanvas);
    cardTexture.minFilter = LinearFilter;
    cardTexture.magFilter = LinearFilter;
    cardTexture.generateMipmaps = false;
    cardTexture.colorSpace = SRGBColorSpace;

    const cardGeometry = new PlaneGeometry(CARD_WIDTH, CARD_HEIGHT);
    const cardMaterial = new MeshBasicMaterial({
      map: cardTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });
    const cardMesh = new Mesh(cardGeometry, cardMaterial);
    cardMesh.renderOrder = 998;
    cardMesh.position.y = -CARD_HEIGHT / 2; // top edge at y=0
    group.add(cardMesh);

    // Progress bar background (top of card)
    const barBgGeometry = new PlaneGeometry(CARD_WIDTH, BAR_HEIGHT);
    const barBgMaterial = new MeshBasicMaterial({
      color: BAR_BG_HEX,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });
    const barBgMesh = new Mesh(barBgGeometry, barBgMaterial);
    barBgMesh.renderOrder = 999;
    barBgMesh.position.y = -BAR_HEIGHT / 2;
    barBgMesh.position.z = 0.001;
    group.add(barBgMesh);

    // Progress bar fill
    const barFillGeometry = new PlaneGeometry(CARD_WIDTH, BAR_HEIGHT);
    const barFillMaterial = new MeshBasicMaterial({
      color: ZONE_HEX.green,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });
    const barFillMesh = new Mesh(barFillGeometry, barFillMaterial);
    barFillMesh.renderOrder = 1000;
    barFillMesh.position.y = -BAR_HEIGHT / 2;
    barFillMesh.position.z = 0.002;
    group.add(barFillMesh);

    return {
      group,
      cardGeometry,
      cardMaterial,
      cardTexture,
      barBgGeometry,
      barBgMaterial,
      barFillGeometry,
      barFillMaterial,
      barFillMesh,
      targetX: 0,
    };
  }

  getGroup(): Group {
    return this.#group;
  }

  getHeight(): number {
    return OrderQueueHUD.HEIGHT;
  }

  show(): void {
    this.#group.visible = true;
  }

  hide(): void {
    this.#group.visible = false;
  }

  update(): void {
    const orders: readonly Order[] = this.#orderManager.getOrders();
    const count = orders.length;

    this.#ensureCardCount(count);

    const totalWidth = count > 0
      ? count * CARD_WIDTH + (count - 1) * CARD_GAP
      : 0;

    for (let i = 0; i < this.#cards.length; i++) {
      const card = this.#cards[i]!;

      if (i < count) {
        const order = orders[i]!;
        const remaining = 1 - order.elapsed / order.duration;
        const clamped = Math.max(0, Math.min(1, remaining));
        const targetX = -totalWidth / 2 + i * (CARD_WIDTH + CARD_GAP) + CARD_WIDTH / 2;

        // Slide-in animation from left
        if (!card.group.visible) {
          card.group.position.x = targetX - 0.3;
          card.group.visible = true;
        }
        card.targetX = targetX;
        card.group.position.x += (card.targetX - card.group.position.x) * SLIDE_SPEED;

        // Update progress bar
        card.barFillMaterial.color.setHex(ZONE_HEX[order.zone]);
        card.barFillMesh.scale.x = clamped || 0.001;
        card.barFillMesh.position.x = -(CARD_WIDTH / 2) * (1 - clamped);
      } else {
        card.group.visible = false;
      }
    }
  }

  dispose(): void {
    for (const card of this.#cards) {
      card.cardGeometry.dispose();
      card.cardMaterial.dispose();
      card.cardTexture.dispose();
      card.barBgGeometry.dispose();
      card.barBgMaterial.dispose();
      card.barFillGeometry.dispose();
      card.barFillMaterial.dispose();
    }
  }
}
