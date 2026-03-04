import { Group, LinearFilter, type SpotLightHelper } from 'three';
import { Box3, CylinderGeometry, Mesh, MeshStandardMaterial, PlaneGeometry, SpotLight, SRGBColorSpace, Vector3 } from 'three';

import { LIGHT_COLOR, TILE_SIZE } from '../../constants';
import { Resources } from '../../util/Resources';
import { Time } from '../../util/Time';
import { LevelObject } from './LevelObject';
import type { WallSide } from './Wall';

const POSTER_ASPECT_RATIO = 6680 / 9449; // width / height

export interface PosterParams {
  textureKey: string;
  wallIndex: number;
  side: WallSide;
  levelWidth: number;
  levelDepth: number;
}

export class Poster extends LevelObject {
  static #lights: SpotLight[] = [];
  static get lights(): SpotLight[] {
    return Poster.#lights;
  }

  static #helpers: SpotLightHelper[] = [];
  static get helpers(): SpotLightHelper[] {
    return Poster.#helpers;
  }

  static #wires: Mesh[] = [];
  static get wires(): Mesh[] {
    return Poster.#wires;
  }

  #params: PosterParams;
  #pivot: Group | null = null;
  #basePosition = { x: 0, z: 0 };
  #baseRotationY = 0;
  #normalX = 0;
  #normalZ = 0;
  #depth = 0;
  #offsetX = 0;
  #rotationY = 0;
  #wireMeshes: Mesh[] = [];
  #posterTop = 0;
  #halfW = 0;
  #wireHeight = 25;

  // Pendulum oscillation — unique per poster for a natural look
  #pendulumFreq = 0.3 + Math.random() * 0.4;   // 0.3–0.7 Hz
  #pendulumAmp = 0.0042 + Math.random() * 0.0028; // ~0.2–0.4° in radians
  #pendulumPhase = Math.random() * Math.PI * 2;
  #yawFreq = 0.2 + Math.random() * 0.3;        // 0.2–0.5 Hz (slower)
  #yawAmp = 0.008 + Math.random() * 0.006;      // ~0.5–0.8° in radians
  #yawPhase = Math.random() * Math.PI * 2;

  public get depth() { return this.#depth; }
  public get offsetX() { return this.#offsetX; }
  public get rotationY() { return this.#rotationY; }

  #onTick = () => {
    if (!this.#pivot) return;
    const t = Time.getInstance().elapsed / 1000;
    const pendulum = this.#pendulumAmp * Math.sin(2 * Math.PI * this.#pendulumFreq * t + this.#pendulumPhase);
    const yaw = this.#yawAmp * Math.sin(2 * Math.PI * this.#yawFreq * t + this.#yawPhase);
    this.#pivot.rotation.z = pendulum;
    this.#pivot.rotation.y = this.#baseRotationY + this.#rotationY * (Math.PI / 180) + yaw;
  };

  constructor(params: PosterParams) {
    super();
    this.#params = params;
  }

  public setDepth(depth: number) {
    if (!this.#pivot) return;
    this.#depth = depth;
    this.#applyTransform();
  }

  public setOffsetX(offset: number) {
    if (!this.#pivot) return;
    this.#offsetX = offset;
    this.#applyTransform();
  }

  public setRotationY(degrees: number) {
    if (!this.#pivot) return;
    this.#rotationY = degrees;
    this.#pivot.rotation.y = this.#baseRotationY + degrees * (Math.PI / 180);
  }

  public setWireHeight(height: number) {
    if (!this.#pivot || !this.mesh) return;
    this.#wireHeight = height;
    this.#pivot.position.y = this.#posterTop + height;
    this.mesh.position.y = -height;
    for (const wire of this.#wireMeshes) {
      wire.scale.y = height / 2; // base geometry height = 2
      wire.position.y = -height / 2;
    }
  }

  #applyTransform() {
    if (!this.#pivot) return;
    this.#pivot.position.x = this.#basePosition.x + this.#normalX * this.#depth + this.#offsetX;
    this.#pivot.position.z = this.#basePosition.z + this.#normalZ * this.#depth;
  }

  create(group: Group): void {
    const { textureKey, wallIndex, side, levelWidth, levelDepth } = this.#params;

    const wallModel = Resources.getInstance().getGLTFAsset('wallModel');
    if (!wallModel) return;

    const wallBox = new Box3().setFromObject(wallModel.scene);
    const wallSize = wallBox.getSize(new Vector3());
    const wallHeight = wallSize.y;

    const posterHeight = wallHeight * 0.9;
    const posterWidth = posterHeight * POSTER_ASPECT_RATIO;

    const texture = Resources.getInstance().getTextureAsset(textureKey);
    if (!texture) return;

    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;

    const geometry = new PlaneGeometry(posterWidth, posterHeight);
    geometry.translate(0, -posterHeight / 2, 0); // origin at top edge
    const material = new MeshStandardMaterial({
      map: texture,
      roughness: 0.4,
    });

    const TS = TILE_SIZE;
    const posterTop = wallHeight + wallHeight * 0.75 - 0.67 + posterHeight / 2;
    this.#posterTop = posterTop;
    this.#halfW = posterWidth / 2;

    let baseX = 0;
    let baseZ = 0;
    let baseRotY = 0;
    let lightOffsetX = 0;
    let lightOffsetZ = 0;
    let lightTargetX = 0;
    let lightTargetZ = 0;
    let downLightTargetX = 0;
    let downLightTargetZ = 0;

    if (side === 'top') {
      baseX = wallIndex * TS + TS / 2;
      baseZ = 0.01;
      baseRotY = 0;
      lightOffsetX = baseX; lightOffsetZ = 1.2;
      lightTargetX = baseX; lightTargetZ = 0;
      downLightTargetX = baseX; downLightTargetZ = -0.5;
    } else if (side === 'left') {
      baseX = 0.01;
      baseZ = wallIndex * TS + TS / 2;
      baseRotY = Math.PI / 2;
      lightOffsetX = 1.2; lightOffsetZ = baseZ;
      lightTargetX = 0; lightTargetZ = baseZ;
      downLightTargetX = -0.5; downLightTargetZ = baseZ;
    } else if (side === 'right') {
      baseX = levelWidth * TS - 0.01;
      baseZ = wallIndex * TS + TS / 2;
      baseRotY = -Math.PI / 2;
      lightOffsetX = levelWidth * TS - 1.2; lightOffsetZ = baseZ;
      lightTargetX = levelWidth * TS; lightTargetZ = baseZ;
      downLightTargetX = levelWidth * TS + 0.5; downLightTargetZ = baseZ;
    } else {
      // bottom
      baseX = wallIndex * TS + TS / 2;
      baseZ = levelDepth * TS - 0.01;
      baseRotY = Math.PI;
      lightOffsetX = baseX; lightOffsetZ = levelDepth * TS - 1.2;
      lightTargetX = baseX; lightTargetZ = levelDepth * TS;
      downLightTargetX = baseX; downLightTargetZ = levelDepth * TS + 0.5;
    }

    this.#basePosition = { x: baseX, z: baseZ };
    this.#baseRotationY = baseRotY;
    if (side === 'top') { this.#normalX = 0; this.#normalZ = 1; }
    else if (side === 'bottom') { this.#normalX = 0; this.#normalZ = -1; }
    else if (side === 'left') { this.#normalX = 1; this.#normalZ = 0; }
    else { this.#normalX = -1; this.#normalZ = 0; }

    // Pivot group at wire-top position — pendulum swings from here
    const pivot = new Group();
    pivot.position.set(baseX, posterTop + this.#wireHeight, baseZ);
    pivot.rotation.y = baseRotY;

    // Poster mesh as child of pivot, hanging below by wire height
    const mesh = new Mesh(geometry, material);
    mesh.position.y = -this.#wireHeight;
    pivot.add(mesh);

    this.mesh = mesh;
    this.#pivot = pivot;
    group.add(pivot);

    // Lights (world-space, independent of pivot)
    const upLight = new SpotLight(LIGHT_COLOR, 10, 5.5, Math.PI / 12, 0.2, 0.4);
    upLight.position.set(lightOffsetX, 0.3, lightOffsetZ);
    upLight.target.position.set(lightTargetX, posterTop, lightTargetZ);
    group.add(upLight);
    group.add(upLight.target);
    Poster.#lights.push(upLight);

    const downLight = new SpotLight(LIGHT_COLOR, 10, 4, Math.PI / 12, 0.4, 0.4);
    downLight.position.set(lightOffsetX, 4.5, lightOffsetZ);
    downLight.target.position.set(downLightTargetX, 0, downLightTargetZ);
    group.add(downLight);
    group.add(downLight.target);
    Poster.#lights.push(downLight);

    // Wires as children of pivot (local space)
    const wireRadius = 0.008;
    const wireMaterial = new MeshStandardMaterial({
      color: 0xcccccc,
      emissive: 0x444444,
      metalness: 0.9,
      roughness: 0.08,
    });
    const wireGeo = new CylinderGeometry(wireRadius, wireRadius, 2, 6);

    for (const sign of [-1, 1] as const) {
      const wire = new Mesh(wireGeo, wireMaterial);
      wire.scale.y = this.#wireHeight / 2;
      wire.position.set(sign * this.#halfW, -this.#wireHeight / 2, 0);
      pivot.add(wire);
      this.#wireMeshes.push(wire);
      Poster.#wires.push(wire);
    }

    Time.getInstance().addEventListener('tick', this.#onTick);
  }

  public override dispose(): void {
    Time.getInstance().removeEventListener('tick', this.#onTick);
    this.#pivot?.removeFromParent();
    this.#pivot = null;
    super.dispose();
  }
}
