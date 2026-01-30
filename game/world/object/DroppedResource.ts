import { Box3, type Group, Mesh, Vector3 } from 'three';

import { TILE_SIZE } from '../../constants';
import type { ResourceType } from '../../types';
import { Resources } from '../../util/Resources';
import { Crate } from './Crate';
import { LevelObject } from './LevelObject';

export interface DroppedResourceParams {
  resourceType: ResourceType;
  position: Vector3;
  onTopOf?: LevelObject;
}

export class DroppedResource extends LevelObject {
  #params: DroppedResourceParams;
  #resourceType: ResourceType;

  constructor(params: DroppedResourceParams) {
    super();
    this.#params = params;
    this.#resourceType = params.resourceType;
    this.isInteractable = true;
  }

  public getResourceType(): ResourceType {
    return this.#resourceType;
  }

  create(group: Group): void {
    const { resourceType, position, onTopOf } = this.#params;

    const modelName = Crate.getResourceModelName(resourceType);
    if (!modelName) {
      console.error('Unknown resource type:', resourceType);
      return;
    }

    const model = Resources.getInstance().getGLTFAsset(modelName);
    if (!model) {
      console.error('Resource model not loaded:', modelName);
      return;
    }

    const mesh = model.scene.clone();

    if (onTopOf?.getMesh()) {
      const parentMesh = onTopOf.getMesh()!;
      const bbox = new Box3().setFromObject(parentMesh);
      const size = new Vector3();
      bbox.getSize(size);

      const offset = new Vector3(TILE_SIZE / 2, 0, TILE_SIZE / 2);
      offset.applyAxisAngle(new Vector3(0, 1, 0), parentMesh.rotation.y);

      mesh.position.copy(parentMesh.position);
      mesh.position.add(offset);
      mesh.position.y = size.y;
    } else {
      mesh.position.copy(position);
      mesh.position.y = 0;
    }

    mesh.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.cloneMaterials(mesh);

    this.mesh = mesh;
    group.add(mesh);
  }

  public override getPosition(): Vector3 | null {
    if (!this.mesh) return null;
    return this.mesh.position.clone();
  }
}
