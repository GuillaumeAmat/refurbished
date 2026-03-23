import { DoubleSide, type Group, Mesh, MeshBasicMaterial, RingGeometry } from 'three';

const DURATION = 1200;

export class OnboardingRing {
  #mesh: Mesh;
  #geometry: RingGeometry;
  #material: MeshBasicMaterial;
  #elapsed = 0;

  constructor(parent: Group, x: number, y: number, z: number) {
    this.#geometry = new RingGeometry(1.6, 1.8, 48);
    this.#material = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      depthTest: false,
      side: DoubleSide,
    });
    this.#mesh = new Mesh(this.#geometry, this.#material);
    this.#mesh.renderOrder = 999;
    this.#mesh.position.set(x, y, z);
    this.#mesh.onBeforeRender = (_r, _s, cam) => {
      this.#mesh.quaternion.copy(cam.quaternion);
    };
    this.#mesh.scale.setScalar(2);
    parent.add(this.#mesh);
  }

  /** Returns true when animation is done. */
  update(deltaMs: number): boolean {
    this.#elapsed += deltaMs;
    const p = Math.min(this.#elapsed / DURATION, 1);
    let scale: number;
    let opacity: number;
    if (p < 0.5) {
      scale = 2 - p * 2;
      opacity = 1;
    } else {
      const q = (p - 0.5) * 2;
      scale = 1 - q;
      opacity = 1 - q;
    }
    this.#mesh.scale.setScalar(scale);
    this.#material.opacity = opacity;
    return p >= 1;
  }

  setVisible(visible: boolean): void {
    this.#mesh.visible = visible;
  }

  dispose(): void {
    this.#mesh.removeFromParent();
    this.#geometry.dispose();
    this.#material.dispose();
  }
}
