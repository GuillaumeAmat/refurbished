import { Box3, Group, SpotLight, Vector3 } from 'three';

import { LIGHT_COLOR, TILE_SIZE } from '../../constants';
import { Resources } from '../../util/Resources';
import { LevelObject } from './LevelObject';

export interface RepairZoneParams {
  xIndex: number;
  zIndex: number;
  levelWidth: number;
  levelDepth: number;
}

export class RepairZone extends LevelObject {
  static #lights: SpotLight[] = [];
  static get lights(): SpotLight[] {
    return RepairZone.#lights;
  }

  #params: RepairZoneParams;
  #ownLight: SpotLight | null = null;
  #screwdriver: Group | null = null;

  constructor(params: RepairZoneParams) {
    super();
    this.#params = params;
  }

  create(group: Group): void {
    const { xIndex, zIndex, levelWidth, levelDepth } = this.#params;

    const workbenchModel = Resources.getInstance().getGLTFAsset('workbenchModel');
    const repairZoneModel = Resources.getInstance().getGLTFAsset('repairZoneModel');

    if (!workbenchModel || !repairZoneModel) {
      console.error('RepairZone models not loaded');
      return;
    }

    // Create container group
    const container = new Group();

    // Add workbench at origin of container
    const workbench = workbenchModel.scene.clone();
    container.add(workbench);

    // Calculate workbench bounding box
    const workbenchBox = new Box3().setFromObject(workbench);
    const workbenchCenter = new Vector3();
    workbenchBox.getCenter(workbenchCenter);

    // Add repair zone centered on top of workbench, nudged toward back
    const repairZone = repairZoneModel.scene.clone();
    repairZone.position.x = workbenchCenter.x;
    repairZone.position.y = workbenchBox.max.y;
    repairZone.position.z = workbenchCenter.z - TILE_SIZE * 0.05;
    container.add(repairZone);

    // Place screwdriver on the mat, nudged toward back
    const screwdriverModel = Resources.getInstance().getGLTFAsset('screwdriverModel');
    if (screwdriverModel) {
      this.#screwdriver = screwdriverModel.scene.clone();
      this.#screwdriver.position.set(1.55, 1.25, 1.2 + TILE_SIZE * 0.02);
      this.#screwdriver.scale.setScalar(1.2);
      this.cloneMaterials(this.#screwdriver);
      this.setupShadows(this.#screwdriver);
      container.add(this.#screwdriver);
    }

    const light = new SpotLight(LIGHT_COLOR, 5, 2, Math.PI / 4, 0.5, 0);
    light.position.set(0.8, 1.8, 0.7);
    light.target.position.set(0.95, 1.2, 1.3);
    container.add(light);
    container.add(light.target);
    RepairZone.#lights.push(light);
    this.#ownLight = light;

    // Position container in level
    container.position.x = xIndex * TILE_SIZE;
    container.position.y = 0;
    container.position.z = zIndex * TILE_SIZE;

    // Apply edge rotation to container
    this.applyEdgeRotation(container, xIndex, zIndex, TILE_SIZE, levelWidth, levelDepth);

    // Setup materials and shadows on container
    this.cloneMaterials(container);
    this.setupShadows(container);

    this.mesh = container;
    group.add(container);

    this.createPhysics(xIndex, zIndex, TILE_SIZE);
    this.isInteractable = true;
  }

  public override dispose(): void {
    if (this.#ownLight) {
      this.#ownLight.target.removeFromParent();
      this.#ownLight.removeFromParent();
      const idx = RepairZone.#lights.indexOf(this.#ownLight);
      if (idx !== -1) RepairZone.#lights.splice(idx, 1);
      this.#ownLight = null;
    }
    if (this.#screwdriver) {
      this.#screwdriver.removeFromParent();
      this.#screwdriver = null;
    }
    super.dispose();
  }

  public hideScrewdriver(): void {
    if (this.#screwdriver) this.#screwdriver.visible = false;
  }

  public showScrewdriver(): void {
    if (this.#screwdriver) this.#screwdriver.visible = true;
  }

  override getDropSurface(): Vector3 | null {
    const { xIndex, zIndex } = this.#params;
    return new Vector3(xIndex * TILE_SIZE + 1, 1.01, zIndex * TILE_SIZE + 1);
  }
}
