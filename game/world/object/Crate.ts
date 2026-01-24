import { Box3, type Group, Vector3 } from 'three';

import { TILE_SIZE } from '../../constants';
import { Cell } from '../../levels';
import { Resources } from '../../util/Resources';
import { LevelObject } from './LevelObject';

export type CrateType = typeof Cell.CRATE_BATTERY | typeof Cell.CRATE_FRAME | typeof Cell.CRATE_SCREEN;

export interface CrateParams {
  type: CrateType;
  xIndex: number;
  zIndex: number;
  levelWidth: number;
  levelDepth: number;
}

export class Crate extends LevelObject {
  #params: CrateParams;
  type: CrateType;

  constructor(params: CrateParams) {
    super();
    this.#params = params;
    this.type = params.type;
  }

  private static getResourceModelName(type: CrateType): string | null {
    switch (type) {
      case Cell.CRATE_BATTERY:
        return 'batteryEmptyModel';
      case Cell.CRATE_FRAME:
        return 'frameBrokenModel';
      case Cell.CRATE_SCREEN:
        return 'screenBrokenModel';
      default:
        return null;
    }
  }

  create(group: Group): void {
    const { type, xIndex, zIndex, levelWidth, levelDepth } = this.#params;

    const model = Resources.getInstance().getGLTFAsset('crateModel');
    if (!model) {
      console.error('Crate model not loaded');
      return;
    }

    const mesh = model.scene.clone();
    mesh.position.x = xIndex * TILE_SIZE;
    mesh.position.y = 0;
    mesh.position.z = zIndex * TILE_SIZE;

    this.applyEdgeRotation(mesh, xIndex, zIndex, TILE_SIZE, levelWidth, levelDepth);
    this.cloneMaterials(mesh);
    this.setupShadows(mesh);

    const resourceModelName = Crate.getResourceModelName(type);
    if (resourceModelName) {
      const resourceModel = Resources.getInstance().getGLTFAsset(resourceModelName);
      if (resourceModel) {
        const resource = resourceModel.scene.clone();

        const bbox = new Box3().setFromObject(mesh);
        const size = new Vector3();
        bbox.getSize(size);
        const meshHeight = size.y;

        resource.position.set(TILE_SIZE / 2, meshHeight, TILE_SIZE / 2);
        this.cloneMaterials(resource);
        this.setupShadows(resource);
        mesh.add(resource);
      }
    }

    this.mesh = mesh;
    group.add(mesh);

    this.createPhysics(xIndex, zIndex, TILE_SIZE);
    this.isInteractable = true;
  }
}
