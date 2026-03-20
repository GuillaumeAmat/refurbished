import { DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';

import { type Order, OrderManager } from '../state/OrderManager';
import type { IHUDItem } from './IHUDItem';

const SLOT_WIDTH = 0.25;
const SLOT_HEIGHT = 0.06;
const SLOT_GAP = 0.03;

const ZONE_COLORS = {
  green: 0x4caf50,
  yellow: 0xffc107,
  red: 0xf44336,
} as const;

const BG_COLOR = 0x333333;

interface OrderSlot {
  group: Group;
  bgMesh: Mesh;
  fillMesh: Mesh;
  fillMaterial: MeshBasicMaterial;
  bgGeometry: PlaneGeometry;
  fillGeometry: PlaneGeometry;
  bgMaterial: MeshBasicMaterial;
}

export class OrderQueueHUD implements IHUDItem {
  static readonly HEIGHT = SLOT_HEIGHT;

  #group: Group;
  #slots: OrderSlot[] = [];
  #orderManager: OrderManager;

  constructor() {
    this.#group = new Group();
    this.#orderManager = OrderManager.getInstance();
  }

  #ensureSlotCount(count: number): void {
    while (this.#slots.length < count) {
      const slot = this.#createSlot();
      this.#slots.push(slot);
      this.#group.add(slot.group);
    }
  }

  #createSlot(): OrderSlot {
    const group = new Group();

    const bgGeometry = new PlaneGeometry(SLOT_WIDTH, SLOT_HEIGHT);
    const bgMaterial = new MeshBasicMaterial({
      color: BG_COLOR,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });
    const bgMesh = new Mesh(bgGeometry, bgMaterial);
    bgMesh.renderOrder = 998;
    group.add(bgMesh);

    const fillGeometry = new PlaneGeometry(SLOT_WIDTH, SLOT_HEIGHT);
    const fillMaterial = new MeshBasicMaterial({
      color: ZONE_COLORS.green,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });
    const fillMesh = new Mesh(fillGeometry, fillMaterial);
    fillMesh.renderOrder = 999;
    fillMesh.position.z = 0.001;
    group.add(fillMesh);

    group.visible = false;

    return { group, bgMesh, fillMesh, fillMaterial, bgGeometry, fillGeometry, bgMaterial };
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

    this.#ensureSlotCount(count);

    const totalWidth = count > 0
      ? count * SLOT_WIDTH + (count - 1) * SLOT_GAP
      : 0;

    for (let i = 0; i < this.#slots.length; i++) {
      const slot = this.#slots[i]!;

      if (i < count) {
        const order = orders[i]!;
        const remaining = 1 - order.elapsed / order.duration;
        const clamped = Math.max(0, Math.min(1, remaining));
        const x = -totalWidth / 2 + i * (SLOT_WIDTH + SLOT_GAP) + SLOT_WIDTH / 2;

        slot.group.position.x = x;
        slot.group.visible = true;
        slot.fillMaterial.color.setHex(ZONE_COLORS[order.zone]);
        slot.fillMesh.scale.x = clamped || 0.001;
        slot.fillMesh.position.x = -(SLOT_WIDTH / 2) * (1 - clamped);
      } else {
        slot.group.visible = false;
      }
    }
  }

  dispose(): void {
    for (const slot of this.#slots) {
      slot.bgGeometry.dispose();
      slot.bgMaterial.dispose();
      slot.fillGeometry.dispose();
      slot.fillMaterial.dispose();
    }
  }
}
