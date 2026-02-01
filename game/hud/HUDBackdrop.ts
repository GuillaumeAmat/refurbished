import { DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';

import type { IHUDItem } from './IHUDItem';

export class HUDBackdrop implements IHUDItem {
  static readonly BACKDROP_WIDTH = 4;
  static readonly BACKDROP_HEIGHT = 2;

  #group: Group;
  #mesh: Mesh;
  #material: MeshBasicMaterial;
  #geometry: PlaneGeometry;

  constructor(width = HUDBackdrop.BACKDROP_WIDTH, height = HUDBackdrop.BACKDROP_HEIGHT) {
    this.#group = new Group();

    this.#geometry = new PlaneGeometry(width, height);
    this.#material = new MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.7,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });

    this.#mesh = new Mesh(this.#geometry, this.#material);
    this.#mesh.renderOrder = 998;
    this.#group.add(this.#mesh);
  }

  getGroup(): Group {
    return this.#group;
  }

  getHeight(): number {
    return HUDBackdrop.BACKDROP_HEIGHT;
  }

  show() {
    this.#group.visible = true;
  }

  hide() {
    this.#group.visible = false;
  }

  update() {}

  dispose() {
    this.#geometry.dispose();
    this.#material.dispose();
  }
}
