import type { Group, MeshBasicMaterial } from 'three';

import { createTextPlane } from '../lib/createTextPlane';

const DURATION = 1.2;
const RISE_DISTANCE = 0.3;
const START_Y_OFFSET = 0.28;

export class HUDPointsPopAnimation {
  #textResult: ReturnType<typeof createTextPlane>;
  #elapsed = 0;
  #startY: number;

  constructor(group: Group, points: number) {
    this.#textResult = createTextPlane(`-${Math.abs(points)}`, {
      height: 0.35,
      fontSize: 244,
      color: '#000000',
    });

    const mesh = this.#textResult.mesh;
    this.#startY = START_Y_OFFSET;
    mesh.position.set(this.#textResult.width / 2, this.#startY, 0);
    mesh.scale.setScalar(0);

    const mat = mesh.material as MeshBasicMaterial;
    mat.opacity = 0;

    group.add(mesh);
  }

  update(dt: number): boolean {
    this.#elapsed += dt;
    const t = Math.min(this.#elapsed / DURATION, 1);

    let scale: number;
    if (t < 0.12) {
      scale = t / 0.12;
    } else if (t < 0.22) {
      scale = 1.0 + ((t - 0.12) / 0.1) * 0.3;
    } else if (t < 0.35) {
      scale = 1.3 - ((t - 0.22) / 0.13) * 0.3;
    } else {
      scale = 1.0;
    }

    let opacity: number;
    if (t < 0.15) {
      opacity = t / 0.15;
    } else if (t < 0.55) {
      opacity = 1.0;
    } else {
      opacity = 1 - (t - 0.55) / 0.45;
    }

    const easedT = 1 - (1 - t) * (1 - t);
    const y = this.#startY + easedT * RISE_DISTANCE;

    const mesh = this.#textResult.mesh;
    mesh.scale.setScalar(scale);
    mesh.position.y = y;
    (mesh.material as MeshBasicMaterial).opacity = opacity;

    if (t >= 1) {
      this.#dispose();
      return true;
    }
    return false;
  }

  #dispose(): void {
    this.#textResult.mesh.removeFromParent();
    this.#textResult.dispose();
  }
}
