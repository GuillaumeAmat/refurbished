import { DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';

import { ORDER_MAX_ACTIVE } from '../constants';
import { type Order,OrderManager } from '../state/OrderManager';
import type { IHUDItem } from './IHUDItem';

const SLOT_WIDTH = 0.25;
const SLOT_HEIGHT = 0.06;
const SLOT_GAP = 0.03;
const TOTAL_WIDTH = ORDER_MAX_ACTIVE * SLOT_WIDTH + (ORDER_MAX_ACTIVE - 1) * SLOT_GAP;

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

    for (let i = 0; i < ORDER_MAX_ACTIVE; i++) {
      const slot = this.#createSlot(i);
      this.#slots.push(slot);
      this.#group.add(slot.group);
    }
  }

  #createSlot(index: number): OrderSlot {
    const group = new Group();
    const x = -TOTAL_WIDTH / 2 + index * (SLOT_WIDTH + SLOT_GAP) + SLOT_WIDTH / 2;
    group.position.x = x;

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

    for (let i = 0; i < ORDER_MAX_ACTIVE; i++) {
      const slot = this.#slots[i];

      if (i < orders.length) {
        const order = orders[i];
        const remaining = 1 - order.elapsed / order.duration;
        const clamped = Math.max(0, Math.min(1, remaining));

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
