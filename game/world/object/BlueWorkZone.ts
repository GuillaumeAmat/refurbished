import { Box3, type Group, Mesh, Vector3 } from 'three';

import { TILE_SIZE } from '../../constants';
import type { ResourceState, ResourceType } from '../../types';
import { Resources } from '../../util/Resources';
import { Crate } from './Crate';
import type { DroppedResource } from './DroppedResource';
import { LevelObject } from './LevelObject';

export interface BlueWorkZoneParams {
  xIndex: number;
  zIndex: number;
  levelWidth: number;
  levelDepth: number;
}

type AssemblyResourceType = 'battery' | 'frame' | 'screen';
const ASSEMBLY_RESOURCES: AssemblyResourceType[] = ['battery', 'frame', 'screen'];

export class BlueWorkZone extends LevelObject {
  #params: BlueWorkZoneParams;
  #containedResources: Map<AssemblyResourceType, DroppedResource> = new Map();
  #indicatorMeshes: Map<AssemblyResourceType, Mesh> = new Map();

  constructor(params: BlueWorkZoneParams) {
    super();
    this.#params = params;
  }

  public hasResource(): boolean {
    return this.#containedResources.size > 0;
  }

  public getResource(): DroppedResource | null {
    const first = this.#containedResources.values().next();
    return first.done ? null : first.value;
  }

  public getResources(): Map<AssemblyResourceType, DroppedResource> {
    return this.#containedResources;
  }

  public setResource(resource: DroppedResource | null): void {
    if (!resource) {
      this.#containedResources.clear();
      return;
    }
    const type = resource.getResourceType() as AssemblyResourceType;
    if (ASSEMBLY_RESOURCES.includes(type)) {
      this.#containedResources.set(type, resource);
      this.#updateIndicators();
    }
  }

  public canAcceptResource(type: ResourceType, state: ResourceState): boolean {
    if (type === 'phone') return false;
    if (state !== 'repaired') return false;
    if (!ASSEMBLY_RESOURCES.includes(type as AssemblyResourceType)) return false;
    return !this.#containedResources.has(type as AssemblyResourceType);
  }

  public isReadyToAssemble(): boolean {
    return ASSEMBLY_RESOURCES.every((type) => this.#containedResources.has(type));
  }

  public assemble(): DroppedResource[] {
    const removed = Array.from(this.#containedResources.values());
    this.#containedResources.clear();
    this.#updateIndicators();
    return removed;
  }

  #updateIndicators(): void {
    for (const type of ASSEMBLY_RESOURCES) {
      const indicator = this.#indicatorMeshes.get(type);
      if (indicator) {
        indicator.visible = !this.#containedResources.has(type);
      }
    }
  }

  create(group: Group): void {
    const { xIndex, zIndex, levelWidth, levelDepth } = this.#params;

    const model = Resources.getInstance().getGLTFAsset('blueWorkZoneModel');
    if (!model) {
      console.error('BlueWorkZone model not loaded');
      return;
    }

    const mesh = model.scene.clone();
    mesh.position.x = xIndex * TILE_SIZE;
    mesh.position.y = 0;
    mesh.position.z = zIndex * TILE_SIZE;

    this.applyEdgeRotation(mesh, xIndex, zIndex, TILE_SIZE, levelWidth, levelDepth);
    this.cloneMaterials(mesh);
    this.setupShadows(mesh);

    this.#createIndicators(mesh);

    this.mesh = mesh;
    group.add(mesh);

    this.createPhysics(xIndex, zIndex, TILE_SIZE);
    this.isInteractable = true;
  }

  #createIndicators(parentMesh: Group): void {
    const resources = Resources.getInstance();
    const bbox = new Box3().setFromObject(parentMesh);
    const size = new Vector3();
    bbox.getSize(size);
    const topY = size.y + 0.1;

    const positions: Record<AssemblyResourceType, Vector3> = {
      battery: new Vector3(TILE_SIZE * 0.25, topY, TILE_SIZE * 0.5),
      frame: new Vector3(TILE_SIZE * 0.5, topY, TILE_SIZE * 0.5),
      screen: new Vector3(TILE_SIZE * 0.75, topY, TILE_SIZE * 0.5),
    };

    for (const type of ASSEMBLY_RESOURCES) {
      const modelName = Crate.getRepairedModelName(type);
      if (!modelName) continue;

      const indicatorModel = resources.getGLTFAsset(modelName);
      if (!indicatorModel) continue;

      const indicator = indicatorModel.scene.clone();
      indicator.scale.setScalar(0.5);
      indicator.position.copy(positions[type]);

      indicator.traverse((child) => {
        if (child instanceof Mesh) {
          child.material = child.material.clone();
          child.material.transparent = true;
          child.material.opacity = 0.4;
        }
      });

      parentMesh.add(indicator);
      this.#indicatorMeshes.set(type, indicator as unknown as Mesh);
    }
  }
}
