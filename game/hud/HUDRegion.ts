import { Group } from 'three';

import type { IHUDItem } from './IHUDItem';

export type HUDRegionId =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'middleLeft'
  | 'center'
  | 'middleRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight';

export type VerticalAlignment = 'top' | 'center' | 'bottom';

interface RegionBounds {
  x: number;
  y: number;
}

export class HUDRegion {
  #id: HUDRegionId;
  #group: Group;
  #items: IHUDItem[] = [];
  #verticalAlignment: VerticalAlignment;
  #itemSpacing = 0.02;

  constructor(id: HUDRegionId, verticalAlignment: VerticalAlignment) {
    this.#id = id;
    this.#verticalAlignment = verticalAlignment;
    this.#group = new Group();
  }

  get id() {
    return this.#id;
  }

  getGroup() {
    return this.#group;
  }

  add(item: IHUDItem) {
    if (this.#items.includes(item)) return;

    this.#items.push(item);
    this.#group.add(item.getGroup());
  }

  remove(item: IHUDItem) {
    const index = this.#items.indexOf(item);
    if (index === -1) return;

    this.#items.splice(index, 1);
    this.#group.remove(item.getGroup());
  }

  updateLayout(bounds: RegionBounds, distance: number) {
    this.#group.position.set(bounds.x, bounds.y, -distance);

    let yOffset = 0;

    for (const item of this.#items) {
      const itemGroup = item.getGroup();
      const itemHeight = item.getHeight();

      if (this.#verticalAlignment === 'top') {
        // Stack downward from top
        itemGroup.position.y = yOffset;
        yOffset -= itemHeight + this.#itemSpacing;
      } else if (this.#verticalAlignment === 'bottom') {
        // Stack upward from bottom
        itemGroup.position.y = yOffset;
        yOffset += itemHeight + this.#itemSpacing;
      } else {
        // Center: stack downward from center
        itemGroup.position.y = yOffset;
        yOffset -= itemHeight + this.#itemSpacing;
      }
    }
  }

  show() {
    this.#group.visible = true;
    for (const item of this.#items) {
      item.show();
    }
  }

  hide() {
    this.#group.visible = false;
    for (const item of this.#items) {
      item.hide();
    }
  }

  update() {
    for (const item of this.#items) {
      item.update();
    }
  }

  dispose() {
    for (const item of this.#items) {
      item.dispose();
      this.#group.remove(item.getGroup());
    }
    this.#items = [];
  }
}
