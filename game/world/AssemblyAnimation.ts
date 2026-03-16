import { BufferAttribute, BufferGeometry, type Group, Line, LineBasicMaterial } from 'three';

import { BLOOM_LAYER, TILE_SIZE } from '../constants';

const ARC_COUNT = 5;
const ARC_SEGMENTS = 6; // A + 4 intermediates + B
const ARC_REFRESH_MS = 50;
const ARC_COLOR = 0x88ccff;
const SHAKE_AMPLITUDE = 0.04;
const SHAKE_FREQ_X = 23; // rad/s
const SHAKE_FREQ_Z = 19; // rad/s

export class AssemblyAnimation {
  #time: number = 0;
  #arcTimer: number = 0;
  #arcs: Line[] = [];
  #mesh: Group | null = null;
  #baseX: number = 0;
  #baseZ: number = 0;
  #active: boolean = false;

  get active(): boolean {
    return this.#active;
  }

  start(mesh: Group): void {
    this.#mesh = mesh;
    this.#baseX = mesh.position.x;
    this.#baseZ = mesh.position.z;
    this.#time = 0;
    this.#arcTimer = ARC_REFRESH_MS; // immediate first refresh
    this.#active = true;

    const parent = mesh.parent;
    if (!parent) return;

    for (let i = 0; i < ARC_COUNT; i++) {
      const positions = new Float32Array(ARC_SEGMENTS * 3);
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(positions, 3));
      const mat = new LineBasicMaterial({ color: ARC_COLOR });
      const line = new Line(geo, mat);
      line.layers.enable(BLOOM_LAYER);
      line.frustumCulled = false;
      parent.add(line);
      this.#arcs.push(line);
    }
  }

  stop(): void {
    if (this.#mesh) {
      this.#mesh.position.x = this.#baseX;
      this.#mesh.position.z = this.#baseZ;
      this.#mesh = null;
    }
    for (const arc of this.#arcs) {
      arc.removeFromParent();
      arc.geometry.dispose();
      (arc.material as LineBasicMaterial).dispose();
    }
    this.#arcs = [];
    this.#active = false;
  }

  update(deltaMs: number): void {
    if (!this.#active || !this.#mesh) return;

    this.#time += deltaMs * 0.001;
    this.#mesh.position.x = this.#baseX + Math.sin(this.#time * SHAKE_FREQ_X) * SHAKE_AMPLITUDE;
    this.#mesh.position.z = this.#baseZ + Math.sin(this.#time * SHAKE_FREQ_Z) * SHAKE_AMPLITUDE;

    this.#arcTimer += deltaMs;
    if (this.#arcTimer >= ARC_REFRESH_MS) {
      this.#arcTimer = 0;
      for (const arc of this.#arcs) {
        this.#randomizeArc(arc);
      }
    }
  }

  #randomizeArc(arc: Line): void {
    const cx = this.#baseX + TILE_SIZE / 2;
    const cz = this.#baseZ + TILE_SIZE / 2;

    const rndX = () => cx + (Math.random() * 2 - 1) * 0.8;
    const rndZ = () => cz + (Math.random() * 2 - 1) * 0.8;
    const rndY = () => 0.3 + Math.random() * 1.2;

    const ax = rndX(), ay = rndY(), az = rndZ();
    const bx = rndX(), by = rndY(), bz = rndZ();

    const attr = arc.geometry.getAttribute('position') as BufferAttribute;
    const pos = attr.array as Float32Array;

    // Point 0: anchor A
    pos[0] = ax; pos[1] = ay; pos[2] = az;
    // Points 1–4: intermediates
    for (let i = 1; i <= 4; i++) {
      const t = i / 5;
      pos[i * 3 + 0] = ax + (bx - ax) * t + (Math.random() * 2 - 1) * 0.25;
      pos[i * 3 + 1] = ay + (by - ay) * t + (Math.random() * 2 - 1) * 0.25;
      pos[i * 3 + 2] = az + (bz - az) * t + (Math.random() * 2 - 1) * 0.25;
    }
    // Point 5: anchor B
    pos[15] = bx; pos[16] = by; pos[17] = bz;

    attr.needsUpdate = true;
  }
}
