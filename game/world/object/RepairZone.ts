import { Box3, Group, Vector3 } from 'three';

import { TILE_SIZE } from '../../constants';
import { Resources } from '../../util/Resources';
import { LevelObject } from './LevelObject';

export interface RepairZoneParams {
  xIndex: number;
  zIndex: number;
  levelWidth: number;
  levelDepth: number;
}

export class RepairZone extends LevelObject {
  #params: RepairZoneParams;

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

    // Add repair zone centered on top of workbench
    const repairZone = repairZoneModel.scene.clone();
    repairZone.position.x = workbenchCenter.x;
    repairZone.position.y = workbenchBox.max.y;
    repairZone.position.z = workbenchCenter.z;
    container.add(repairZone);

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
}
