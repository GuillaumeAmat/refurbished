import { Box3, type Group, Mesh, Vector3 } from 'three';

import { TILE_SIZE } from '../../constants';
import type { ResourceState, ResourceType } from '../../types';
import { Resources } from '../../util/Resources';
import { Crate } from './Crate';
import { LevelObject } from './LevelObject';
import { RepairZone } from './RepairZone';

export interface DroppedResourceParams {
  resourceType: ResourceType;
  position: Vector3;
  onTopOf?: LevelObject;
  state?: ResourceState;
}

export class DroppedResource extends LevelObject {
  #params: DroppedResourceParams;
  #resourceType: ResourceType;
  #state: ResourceState;
  #group: Group | null = null;

  constructor(params: DroppedResourceParams) {
    super();
    this.#params = params;
    this.#resourceType = params.resourceType;
    this.#state = params.state ?? 'broken';
    this.isInteractable = true;
  }

  public getResourceType(): ResourceType {
    return this.#resourceType;
  }

  public getState(): ResourceState {
    return this.#state;
  }

  public setState(state: ResourceState): void {
    this.#state = state;
  }

  public repair(): void {
    if (this.#state === 'repaired') return;
    this.#state = 'repaired';
    this.swapModel();
  }

  public swapModel(): void {
    if (!this.mesh || !this.#group) return;

    const modelName = this.#state === 'repaired'
      ? Crate.getRepairedModelName(this.#resourceType)
      : Crate.getResourceModelName(this.#resourceType);

    if (!modelName) return;

    const model = Resources.getInstance().getGLTFAsset(modelName);
    if (!model) return;

    const oldPosition = this.mesh.position.clone();
    const oldRotation = this.mesh.rotation.clone();

    this.mesh.removeFromParent();

    const newMesh = model.scene.clone();
    newMesh.position.copy(oldPosition);
    newMesh.rotation.copy(oldRotation);

    newMesh.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.cloneMaterials(newMesh);
    this.mesh = newMesh;
    this.#group.add(newMesh);
  }

  create(group: Group): void {
    const { resourceType, position, onTopOf } = this.#params;
    this.#group = group;

    const modelName = this.#state === 'repaired'
      ? Crate.getRepairedModelName(resourceType)
      : Crate.getResourceModelName(resourceType);

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

      const isRepairZone = onTopOf instanceof RepairZone;
      const offset = isRepairZone
        ? new Vector3(TILE_SIZE / 2, 0, (TILE_SIZE / 3) * 2)
        : new Vector3(TILE_SIZE / 2, 0, TILE_SIZE / 2);
      offset.applyAxisAngle(new Vector3(0, 1, 0), parentMesh.rotation.y);

      mesh.position.copy(parentMesh.position);
      mesh.position.add(offset);
      mesh.position.y = 1.05;
      mesh.position.y = isRepairZone ? 1.06 : size.y;
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
