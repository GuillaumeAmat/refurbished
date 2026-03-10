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
    this.#mesh.rotation.x = -Math.PI / 2;
    this.#mesh.position.set(x, y, z);
    parent.add(this.#mesh);
  }

  /** Returns true when animation is done. */
  update(deltaMs: number): boolean {
    this.#elapsed += deltaMs;
    const progress = Math.min(this.#elapsed / DURATION, 1);
    const scale = 1 - progress * progress; // ease-in shrink
    this.#mesh.scale.setScalar(scale);
    this.#material.opacity = scale;
    return progress >= 1;
  }

  dispose(): void {
    this.#mesh.removeFromParent();
    this.#geometry.dispose();
    this.#material.dispose();
  }
}
