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
import { Debug } from '../util/Debug';
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
  #debugFakeOrders: Order[] = [];

  #params = {
    cardWidth: 0.49,
    cardHeight: 0.51,
    cardGap: 0.1,
    barHeight: 0.08,
    cardTopY: 0.15,
    cornerRadius: 29,
    slideSpeed: 0.12,
    // Canvas icon layout (fractions of content area)
    phoneSizePct: 0.47,
    resSizePct: 0.27,
    pkgSizePct: 0.26,
    // Vertical positions within content area (0 = top, 1 = bottom)
    phoneYPct: -0.13,
    resYPct: 0.42,
    pkgYPct: 0.72,
    // Debug
    debugOrderCount: 7,
  };

  constructor() {
    this.#group = new Group();
    this.#orderManager = OrderManager.getInstance();
    this.#bodyCanvas = this.#renderCardBody();
    this.#setupDebug();
  }

  /** Pre-render the static card body (white bg + icons) once, reused for all cards. */
  #renderCardBody(): HTMLCanvasElement | null {
    const p = this.#params;
    const canvasW = Math.round(p.cardWidth * 1000 * DPR);
    const canvasH = Math.round(p.cardHeight * 1000 * DPR);
    const cornerR = p.cornerRadius * DPR;

    const res = Resources.getInstance();
    const phoneImg = res.getTextureAsset('phoneIcon')?.image as HTMLImageElement | undefined;
    const batteryImg = res.getTextureAsset('batteryFilledIcon')?.image as HTMLImageElement | undefined;
    const screenImg = res.getTextureAsset('screenRepairedIcon')?.image as HTMLImageElement | undefined;
    const frameImg = res.getTextureAsset('frameRepairedIcon')?.image as HTMLImageElement | undefined;
    const packageImg = res.getTextureAsset('packageOpenIcon')?.image as HTMLImageElement | undefined;

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
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
    ctx.lineTo(canvasW, 0);
    ctx.lineTo(canvasW, canvasH - cornerR);
    ctx.arcTo(canvasW, canvasH, canvasW - cornerR, canvasH, cornerR);
    ctx.lineTo(cornerR, canvasH);
    ctx.arcTo(0, canvasH, 0, canvasH - cornerR, cornerR);
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
    const barArea = Math.round(p.barHeight / p.cardHeight * canvasH);
    const contentTop = barArea;
    const contentH = canvasH - contentTop;

    // 3 resource icons row (battery, screen, frame)
    const resSize = Math.round(contentH * p.resSizePct);
    const resY = contentTop + Math.round(contentH * p.resYPct);
    const resGap = (canvasW - 3 * resSize) / 4;
    const icons = [batteryImg, screenImg, frameImg];
    for (let i = 0; i < 3; i++) {
      const x = resGap + i * (resSize + resGap);
      const img = icons[i];
      if (img) {
        ctx.drawImage(img, x, resY, resSize, resSize);
      }
    }

    // Package icon (centered)
    const pkgSize = Math.round(contentH * p.pkgSizePct);
    const pkgY = contentTop + Math.round(contentH * p.pkgYPct);
    const pkgX = (canvasW - pkgSize) / 2;
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
    const p = this.#params;
    const canvasW = Math.round(p.cardWidth * 1000 * DPR);
    const canvasH = Math.round(p.cardHeight * 1000 * DPR);
    const group = new Group();
    group.visible = false;

    // Clone the pre-rendered card body onto a new canvas
    const cardCanvas = document.createElement('canvas');
    cardCanvas.width = canvasW;
    cardCanvas.height = canvasH;
    const ctx = cardCanvas.getContext('2d');
    if (ctx && this.#bodyCanvas) {
      ctx.drawImage(this.#bodyCanvas, 0, 0);
    }

    const cardTexture = new CanvasTexture(cardCanvas);
    cardTexture.minFilter = LinearFilter;
    cardTexture.magFilter = LinearFilter;
    cardTexture.generateMipmaps = false;
    cardTexture.colorSpace = SRGBColorSpace;

    const cardGeometry = new PlaneGeometry(p.cardWidth, p.cardHeight);
    const cardMaterial = new MeshBasicMaterial({
      map: cardTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });
    const cardMesh = new Mesh(cardGeometry, cardMaterial);
    cardMesh.renderOrder = 998;
    cardMesh.position.y = p.cardTopY - p.cardHeight / 2;
    group.add(cardMesh);

    // Progress bar background (at top edge of card)
    const barBgGeometry = new PlaneGeometry(p.cardWidth, p.barHeight);
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
    barBgMesh.position.y = p.cardTopY - p.barHeight / 2;
    barBgMesh.position.z = 0.001;
    group.add(barBgMesh);

    // Progress bar fill
    const barFillGeometry = new PlaneGeometry(p.cardWidth, p.barHeight);
    const barFillMaterial = new MeshBasicMaterial({
      color: ZONE_HEX.green,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });
    const barFillMesh = new Mesh(barFillGeometry, barFillMaterial);
    barFillMesh.renderOrder = 1000;
    barFillMesh.position.y = p.cardTopY - p.barHeight / 2;
    barFillMesh.position.z = 0.002;
    group.add(barFillMesh);

    // Phone icon mesh (rendered above the progress bar)
    const phoneWorldSize = (p.cardHeight - p.barHeight) * p.phoneSizePct;
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
    // Position: card top is at cardTopY, phone offset by phoneYPct relative to card content
    const contentTop = p.cardTopY - p.barHeight;
    const contentH = p.cardHeight - p.barHeight;
    phoneMesh.position.y = contentTop - contentH * p.phoneYPct - phoneWorldSize / 2;
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
    const p = this.#params;
    const orders: readonly Order[] = this.#debugFakeOrders.length > 0
      ? this.#debugFakeOrders
      : this.#orderManager.getOrders();
    const count = orders.length;

    this.#ensureCardCount(count);

    for (let i = 0; i < this.#cards.length; i++) {
      const card = this.#cards[i]!;

      if (i < count) {
        const order = orders[i]!;
        const remaining = 1 - order.elapsed / order.duration;
        const clamped = Math.max(0, Math.min(1, remaining));
        const targetX = i * (p.cardWidth + p.cardGap) + p.cardWidth / 2;

        // Slide-in animation from left
        if (!card.group.visible) {
          card.group.position.x = targetX - 0.6;
          card.group.visible = true;
        }
        card.targetX = targetX;
        card.group.position.x += (card.targetX - card.group.position.x) * p.slideSpeed;

        // Update progress bar
        card.barFillMaterial.color.setHex(ZONE_HEX[order.zone]);
        card.barFillMesh.scale.x = clamped || 0.001;
        card.barFillMesh.position.x = -(p.cardWidth / 2) * (1 - clamped);
      } else {
        card.group.visible = false;
      }
    }
  }

  /** Destroy all cards and rebuild from scratch (called when debug params change). */
  #rebuild(): void {
    for (const card of this.#cards) {
      card.group.removeFromParent();
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
    this.#cards = [];
    this.#bodyCanvas = this.#renderCardBody();
  }

  #setupDebug(): void {
    const debug = Debug.getInstance();
    if (!debug?.active) return;

    const rebuild = () => this.#rebuild();

    const folder = debug.gui.addFolder('Order Cards');
    folder.add(this.#params, 'cardWidth', 0.1, 0.8, 0.01).name('Card Width').onChange(rebuild);
    folder.add(this.#params, 'cardHeight', 0.1, 1.0, 0.01).name('Card Height').onChange(rebuild);
    folder.add(this.#params, 'cardGap', 0, 0.1, 0.005).name('Card Gap');
    folder.add(this.#params, 'barHeight', 0.005, 0.15, 0.005).name('Bar Height').onChange(rebuild);
    folder.add(this.#params, 'cardTopY', 0, 0.5, 0.01).name('Top Y Offset').onChange(rebuild);
    folder.add(this.#params, 'cornerRadius', 0, 40, 1).name('Corner Radius').onChange(rebuild);
    folder.add(this.#params, 'slideSpeed', 0.01, 0.5, 0.01).name('Slide Speed');
    folder.add(this.#params, 'phoneSizePct', 0.1, 0.6, 0.01).name('Phone Icon %').onChange(rebuild);
    folder.add(this.#params, 'phoneYPct', -1, 0.6, 0.01).name('Phone Y pos').onChange(rebuild);
    folder.add(this.#params, 'resSizePct', 0.05, 0.4, 0.01).name('Resource Icon %').onChange(rebuild);
    folder.add(this.#params, 'resYPct', 0.2, 0.8, 0.01).name('Resources Y pos').onChange(rebuild);
    folder.add(this.#params, 'pkgSizePct', 0.05, 0.5, 0.01).name('Package Icon %').onChange(rebuild);
    folder.add(this.#params, 'pkgYPct', 0.4, 0.9, 0.01).name('Package Y pos').onChange(rebuild);
    folder.add(this.#params, 'debugOrderCount', 1, 7, 1).name('Test Orders').onChange(() => this.#updateFakeOrders());

    // Create fake orders so cards are visible without playing the game
    this.#updateFakeOrders();

    folder.close();
  }

  #updateFakeOrders(): void {
    const count = this.#params.debugOrderCount;
    const duration = 95_000;
    this.#debugFakeOrders = [];
    for (let i = 0; i < count; i++) {
      // Spread orders across different elapsed states (green / yellow / red)
      const ratio = i / Math.max(count - 1, 1);
      const elapsed = ratio * duration * 0.9;
      const zone = ratio <= 0.4 ? 'green' : ratio <= 0.7 ? 'yellow' : 'red';
      this.#debugFakeOrders.push({ id: i, elapsed, duration, zone } as Order);
    }
    // Force the group visible (parent HUDRegion may be hidden)
    this.#group.visible = true;
    // Also force parent chain visible
    let parent = this.#group.parent;
    while (parent) {
      parent.visible = true;
      parent = parent.parent;
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
