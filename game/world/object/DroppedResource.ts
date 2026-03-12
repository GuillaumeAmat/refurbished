import { Box3, type Group, Vector3 } from 'three';

import { TILE_SIZE } from '../../constants';
import { ProgressBar } from '../../hud/ProgressBar';
import { createIconPlane, type IconPlaneResult } from '../../lib/createIconPlane';
import type { ResourceState, ResourceType } from '../../types';
import { Resources } from '../../util/Resources';
import { Crate } from './Crate';
import { LevelObject } from './LevelObject';

export interface DroppedResourceParams {
  resourceType: ResourceType;
  position: Vector3;
  onTopOf?: LevelObject;
  state?: ResourceState;
  skipIcon?: boolean;
}

const RESOURCE_SCALE: Record<ResourceType, number> = {
  frame: 1.5,
  screen: 1.4,
  battery: 1.3,
  phone: 1.5,
  package: 1.2,
};

function iconNameForResource(resourceType: ResourceType, state: ResourceState): string | null {
  if (state === 'broken') return null;
  if (resourceType === 'frame') return 'frameRepairedIcon';
  if (resourceType === 'battery') return 'batteryFilledIcon';
  if (resourceType === 'screen') return 'screenRepairedIcon';
  if (resourceType === 'phone') return 'phoneIcon';
  return null;
}

export class DroppedResource extends LevelObject {
  #params: DroppedResourceParams;
  #resourceType: ResourceType;
  #state: ResourceState;
  #group: Group | null = null;
  #repairProgress: number = 0;
  #progressBar: ProgressBar | null = null;
  #iconPlane: IconPlaneResult | null = null;

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

  public getRepairProgress(): number {
    return this.#repairProgress;
  }

  public addRepairProgress(deltaMs: number): void {
    this.#repairProgress += deltaMs;
  }

  public resetRepairProgress(): void {
    this.#repairProgress = 0;
    this.#progressBar?.dispose();
    this.#progressBar = null;
  }

  public isRepairComplete(requiredDuration: number): boolean {
    return this.#repairProgress >= requiredDuration;
  }

  public getOrCreateProgressBar(levelGroup: Group): ProgressBar {
    if (!this.#progressBar) {
      this.#progressBar = new ProgressBar(0.5, 0.075);
      const pos = this.getPosition();
      if (pos) {
        this.#progressBar.setPosition(new Vector3(pos.x, 2.5, pos.z));
      }
      levelGroup.add(this.#progressBar.getGroup());
      this.#progressBar.show();
    }
    return this.#progressBar;
  }

  public updateProgressBar(progress: number): void {
    this.#progressBar?.setProgress(progress);
  }

  public override dispose(): void {
    this.#progressBar?.dispose();
    this.#progressBar = null;
    this.#iconPlane?.mesh.removeFromParent();
    this.#iconPlane?.dispose();
    this.#iconPlane = null;
    super.dispose();
  }

  public swapModel(): void {
    if (!this.mesh || !this.#group) return;

    const modelName =
      this.#state === 'repaired'
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
    newMesh.scale.setScalar(RESOURCE_SCALE[this.#resourceType]);

    this.setupShadows(newMesh);
    this.cloneMaterials(newMesh);
    this.mesh = newMesh;
    this.invalidateBox();
    this.#group.add(newMesh);

    this.#iconPlane?.mesh.removeFromParent();
    this.#iconPlane?.dispose();
    this.#iconPlane = null;
    this.#attachIcon(newMesh);
  }

  create(group: Group): void {
    const { resourceType, position, onTopOf } = this.#params;
    this.#group = group;

    const modelName =
      this.#state === 'repaired' ? Crate.getRepairedModelName(resourceType) : Crate.getResourceModelName(resourceType);

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
    mesh.scale.setScalar(RESOURCE_SCALE[resourceType]);

    const dropSurface = onTopOf?.getDropSurface();
    if (dropSurface) {
      mesh.position.copy(dropSurface);
    } else if (onTopOf?.getMesh()) {
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
      mesh.position.y = 0.01;
    }

    this.setupShadows(mesh);
    this.cloneMaterials(mesh);

    this.mesh = mesh;
    group.add(mesh);

    if (!this.#params.skipIcon) this.#attachIcon(mesh);
  }

  #attachIcon(meshObject: Group): void {
    if (!this.#group) return;
    const iconName = iconNameForResource(this.#resourceType, this.#state);
    if (!iconName) return;
    const texture = Resources.getInstance().getTextureAsset(iconName);
    if (!texture) return;

    const bbox = new Box3().setFromObject(meshObject);

    let iconX: number;

    const onTopOf = this.#params.onTopOf;
    if (onTopOf?.getMesh()) {
      const parentMesh = onTopOf.getMesh()!;
      const tileOffset = new Vector3(TILE_SIZE / 2, 0, TILE_SIZE / 2);
      tileOffset.applyAxisAngle(new Vector3(0, 1, 0), parentMesh.rotation.y);
      iconX = parentMesh.position.x + tileOffset.x;
    } else {
      const center = new Vector3();
      bbox.getCenter(center);
      iconX = center.x;
    }

    const anchor = new Vector3(iconX, bbox.max.y, bbox.min.z);
    this.#iconPlane = createIconPlane(texture, 0.3, anchor);
    this.#group.add(this.#iconPlane.mesh);
  }

  public override getPosition(): Vector3 | null {
    if (!this.mesh) return null;
    return this.mesh.position.clone();
  }
}
