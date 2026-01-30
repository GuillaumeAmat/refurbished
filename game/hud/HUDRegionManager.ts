import { Group, type PerspectiveCamera } from 'three';

import { HUDRegion, type HUDRegionId } from './HUDRegion';
import type { IHUDItem } from './IHUDItem';

export class HUDRegionManager {
  static readonly HUD_DISTANCE = 5;
  static readonly HUD_PADDING = 0.15;

  #camera: PerspectiveCamera;
  #group: Group;
  #regions: Map<HUDRegionId, HUDRegion>;

  constructor(camera: PerspectiveCamera) {
    this.#camera = camera;
    this.#group = new Group();
    this.#camera.add(this.#group);

    this.#regions = new Map([
      ['topLeft', new HUDRegion('topLeft', 'top')],
      ['topCenter', new HUDRegion('topCenter', 'top')],
      ['topRight', new HUDRegion('topRight', 'top')],
      ['middleLeft', new HUDRegion('middleLeft', 'center')],
      ['center', new HUDRegion('center', 'center')],
      ['middleRight', new HUDRegion('middleRight', 'center')],
      ['bottomLeft', new HUDRegion('bottomLeft', 'bottom')],
      ['bottomCenter', new HUDRegion('bottomCenter', 'bottom')],
      ['bottomRight', new HUDRegion('bottomRight', 'bottom')],
    ]);

    for (const region of this.#regions.values()) {
      this.#group.add(region.getGroup());
    }

    this.updatePositions();
  }

  #calculateFrustumBounds() {
    const distance = HUDRegionManager.HUD_DISTANCE;
    const vFov = (this.#camera.fov * Math.PI) / 180;
    const visibleHeight = 2 * Math.tan(vFov / 2) * distance;
    const visibleWidth = visibleHeight * this.#camera.aspect;

    return {
      top: visibleHeight / 2,
      bottom: -visibleHeight / 2,
      left: -visibleWidth / 2,
      right: visibleWidth / 2,
    };
  }

  add(regionId: HUDRegionId, item: IHUDItem) {
    const region = this.#regions.get(regionId);
    if (!region) return;

    region.add(item);
    this.updatePositions();
  }

  remove(regionId: HUDRegionId, item: IHUDItem) {
    const region = this.#regions.get(regionId);
    if (!region) return;

    region.remove(item);
    this.updatePositions();
  }

  updatePositions() {
    const bounds = this.#calculateFrustumBounds();
    const padding = HUDRegionManager.HUD_PADDING;
    const distance = HUDRegionManager.HUD_DISTANCE;

    // Top row
    this.#regions.get('topLeft')?.updateLayout({ x: bounds.left + padding, y: bounds.top - padding }, distance);
    this.#regions.get('topCenter')?.updateLayout({ x: 0, y: bounds.top - padding }, distance);
    this.#regions.get('topRight')?.updateLayout({ x: bounds.right - padding, y: bounds.top - padding }, distance);

    // Middle row
    this.#regions.get('middleLeft')?.updateLayout({ x: bounds.left + padding, y: 0 }, distance);
    this.#regions.get('center')?.updateLayout({ x: 0, y: 0 }, distance);
    this.#regions.get('middleRight')?.updateLayout({ x: bounds.right - padding, y: 0 }, distance);

    // Bottom row
    this.#regions.get('bottomLeft')?.updateLayout({ x: bounds.left + padding, y: bounds.bottom + padding }, distance);
    this.#regions.get('bottomCenter')?.updateLayout({ x: 0, y: bounds.bottom + padding }, distance);
    this.#regions.get('bottomRight')?.updateLayout({ x: bounds.right - padding, y: bounds.bottom + padding }, distance);
  }

  show() {
    this.#group.visible = true;
    for (const region of this.#regions.values()) {
      region.show();
    }
  }

  hide() {
    this.#group.visible = false;
    for (const region of this.#regions.values()) {
      region.hide();
    }
  }

  update() {
    for (const region of this.#regions.values()) {
      region.update();
    }
  }

  dispose() {
    for (const region of this.#regions.values()) {
      region.dispose();
      this.#group.remove(region.getGroup());
    }
    this.#regions.clear();
    this.#camera.remove(this.#group);
  }
}
