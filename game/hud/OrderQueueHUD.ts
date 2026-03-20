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

// Canvas DPI multiplier
const DPR = 2;

const ZONE_HEX: Record<OrderZone, number> = {
  green: 0x4caf50,
  yellow: 0xffc107,
  red: 0xf44336,
};

const BAR_BG_HEX = 0xdddddd;

// Card dimensions and layout
const CARD_WIDTH = 0.49;
const CARD_HEIGHT = 0.51;
const CARD_GAP = 0.1;
const BAR_HEIGHT = 0.08;
const CARD_TOP_Y = 0.15;
const CORNER_RADIUS = 29;
const SLIDE_SPEED = 0.12;

// Canvas icon layout (fractions of content area)
const PHONE_SIZE_PCT = 0.47;
const RES_SIZE_PCT = 0.27;
const PKG_SIZE_PCT = 0.26;

// Vertical positions within content area
const PHONE_Y_PCT = -0.13;
const RES_Y_PCT = 0.42;
const PKG_Y_PCT = 0.72;

const CANVAS_W = Math.round(CARD_WIDTH * 1000 * DPR);
const CANVAS_H = Math.round(CARD_HEIGHT * 1000 * DPR);
const CORNER_R = CORNER_RADIUS * DPR;

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
  phoneGeometry: PlaneGeometry;
  phoneMaterial: MeshBasicMaterial;
  targetX: number;
}

export class OrderQueueHUD implements IHUDItem {
  static readonly HEIGHT = 0.25; // approximate visible height below anchor

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
    // Draw with strong black drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 20 * DPR;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4 * DPR;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(CANVAS_W, 0);
    ctx.lineTo(CANVAS_W, CANVAS_H - CORNER_R);
    ctx.arcTo(CANVAS_W, CANVAS_H, CANVAS_W - CORNER_R, CANVAS_H, CORNER_R);
    ctx.lineTo(CORNER_R, CANVAS_H);
    ctx.arcTo(0, CANVAS_H, 0, CANVAS_H - CORNER_R, CORNER_R);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // Subtle border
    ctx.strokeStyle = '#d0d0d0';
    ctx.lineWidth = 2;
    ctx.stroke();

    // --- Icon layout (phone icon is a separate mesh, drawn above the bar) ---
    const barArea = Math.round(BAR_HEIGHT / CARD_HEIGHT * CANVAS_H);
    const contentTop = barArea;
    const contentH = CANVAS_H - contentTop;

    // 3 resource icons row (battery, screen, frame)
    const resSize = Math.round(contentH * RES_SIZE_PCT);
    const resY = contentTop + Math.round(contentH * RES_Y_PCT);
    const resGap = (CANVAS_W - 3 * resSize) / 4;
    const icons = [batteryImg, screenImg, frameImg];
    for (let i = 0; i < 3; i++) {
      const x = resGap + i * (resSize + resGap);
      const img = icons[i];
      if (img) {
        ctx.drawImage(img, x, resY, resSize, resSize);
      }
    }

    // Package icon (centered)
    const pkgSize = Math.round(contentH * PKG_SIZE_PCT);
    const pkgY = contentTop + Math.round(contentH * PKG_Y_PCT);
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
    cardMesh.position.y = CARD_TOP_Y - CARD_HEIGHT / 2;
    group.add(cardMesh);

    // Progress bar background (at top edge of card)
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
    barBgMesh.position.y = CARD_TOP_Y - BAR_HEIGHT / 2;
    barBgMesh.position.z = 0.001;
    group.add(barBgMesh);

    // Progress bar fill
    const barFillGeometry = new PlaneGeometry(CARD_WIDTH, BAR_HEIGHT);
    const barFillMaterial = new MeshBasicMaterial({
      color: ZONE_HEX.green,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });
    const barFillMesh = new Mesh(barFillGeometry, barFillMaterial);
    barFillMesh.renderOrder = 1000;
    barFillMesh.position.y = CARD_TOP_Y - BAR_HEIGHT / 2;
    barFillMesh.position.z = 0.002;
    group.add(barFillMesh);

    // Phone icon mesh (rendered above the progress bar)
    const phoneWorldSize = (CARD_HEIGHT - BAR_HEIGHT) * PHONE_SIZE_PCT;
    const phoneTexture = Resources.getInstance().getTextureAsset('phoneIcon');
    const phoneGeometry = new PlaneGeometry(phoneWorldSize, phoneWorldSize);
    if (phoneTexture) {
      phoneTexture.colorSpace = SRGBColorSpace;
    }
    const phoneMaterial = new MeshBasicMaterial({
      map: phoneTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      side: DoubleSide,
    });
    const phoneMesh = new Mesh(phoneGeometry, phoneMaterial);
    phoneMesh.renderOrder = 1001;
    const contentTop = CARD_TOP_Y - BAR_HEIGHT;
    const contentH = CARD_HEIGHT - BAR_HEIGHT;
    phoneMesh.position.y = contentTop - contentH * PHONE_Y_PCT - phoneWorldSize / 2;
    phoneMesh.position.z = 0.003;
    group.add(phoneMesh);

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
      phoneGeometry,
      phoneMaterial,
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

    for (let i = 0; i < this.#cards.length; i++) {
      const card = this.#cards[i]!;

      if (i < count) {
        const order = orders[i]!;
        const remaining = 1 - order.elapsed / order.duration;
        const clamped = Math.max(0, Math.min(1, remaining));
        const targetX = i * (CARD_WIDTH + CARD_GAP) + CARD_WIDTH / 2;

        // Slide-in animation from right edge of screen
        if (!card.group.visible) {
          card.group.position.x = 6;
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
      card.phoneGeometry.dispose();
      card.phoneMaterial.dispose();
    }
  }
}
