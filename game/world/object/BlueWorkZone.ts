import { type Group, Mesh, Vector3 } from 'three';

import { TILE_SIZE } from '../../constants';
import { ProgressBar } from '../../hud/ProgressBar';
import { createTextPlane, type TextPlaneResult } from '../../lib/createTextPlane';
import type { ResourceState, ResourceType } from '../../types';
import { Resources } from '../../util/Resources';
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

const LETTER_MAP: Record<AssemblyResourceType, string> = {
  battery: 'B',
  frame: 'F',
  screen: 'S',
};

export class BlueWorkZone extends LevelObject {
  #params: BlueWorkZoneParams;
  #containedResources: Map<AssemblyResourceType, DroppedResource> = new Map();
  #letterIndicators: Map<AssemblyResourceType, TextPlaneResult> = new Map();
  #assemblyProgress: number = 0;
  #progressBar: ProgressBar | null = null;
  #awaitingPackaging: boolean = false;
  #phoneResource: DroppedResource | null = null;

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
      this.resetAssemblyProgress();
      return;
    }
    const type = resource.getResourceType() as AssemblyResourceType;
    if (ASSEMBLY_RESOURCES.includes(type)) {
      this.#containedResources.set(type, resource);
      this.#updateIndicators();
      this.resetAssemblyProgress();

      // Hide dropped resource model
      resource.getMesh()?.traverse((child) => {
        if (child instanceof Mesh) child.visible = false;
      });
    }
  }

  public canAcceptResource(type: ResourceType, state: ResourceState): boolean {
    if (type === 'phone') return false;
    if (type === 'package') return false;
    if (state !== 'repaired') return false;
    if (!ASSEMBLY_RESOURCES.includes(type as AssemblyResourceType)) return false;
    return !this.#containedResources.has(type as AssemblyResourceType);
  }

  public isAwaitingPackaging(): boolean {
    return this.#awaitingPackaging;
  }

  public setAwaitingPackaging(phone: DroppedResource): void {
    this.#awaitingPackaging = true;
    this.#phoneResource = phone;
  }

  public clearAwaitingPackaging(): DroppedResource | null {
    const phone = this.#phoneResource;
    this.#awaitingPackaging = false;
    this.#phoneResource = null;
    return phone;
  }

  public canAcceptPackage(type: ResourceType, state: ResourceState): boolean {
    return this.#awaitingPackaging && type === 'package' && state === 'broken';
  }

  public isReadyToAssemble(): boolean {
    return ASSEMBLY_RESOURCES.every((type) => this.#containedResources.has(type));
  }

  public assemble(): DroppedResource[] {
    const removed = Array.from(this.#containedResources.values());
    this.#containedResources.clear();
    this.#updateIndicators();
    this.#progressBar?.dispose();
    this.#progressBar = null;
    return removed;
  }

  public getAssemblyProgress(): number {
    return this.#assemblyProgress;
  }

  public addAssemblyProgress(deltaMs: number): void {
    this.#assemblyProgress += deltaMs;
  }

  public resetAssemblyProgress(): void {
    this.#assemblyProgress = 0;
    this.#progressBar?.dispose();
    this.#progressBar = null;
  }

  public isAssemblyComplete(requiredDuration: number): boolean {
    return this.#assemblyProgress >= requiredDuration;
  }

  public getOrCreateProgressBar(levelGroup: Group): ProgressBar {
    if (!this.#progressBar) {
      this.#progressBar = new ProgressBar(1.2, 0.15);
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

  #updateIndicators(): void {
    for (const type of ASSEMBLY_RESOURCES) {
      const indicator = this.#letterIndicators.get(type);
      if (indicator) {
        const hasResource = this.#containedResources.has(type);
        indicator.updateColor(hasResource ? '#00FF88' : '#FFFFFF');
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
    const spacing = 0.4;
    const totalWidth = spacing * (ASSEMBLY_RESOURCES.length - 1);
    const startX = TILE_SIZE * 0.5 - totalWidth / 2;

    for (let i = 0; i < ASSEMBLY_RESOURCES.length; i++) {
      const type = ASSEMBLY_RESOURCES[i];
      const letter = LETTER_MAP[type];

      const textPlane = createTextPlane(letter, {
        height: 0.3,
        color: '#FFFFFF',
        fontFamily: 'monospace',
        fontWeight: 'bold',
      });

      textPlane.mesh.position.set(startX + i * spacing, 2.8, TILE_SIZE * 0.5);

      parentMesh.add(textPlane.mesh);
      this.#letterIndicators.set(type, textPlane);
    }
  }

  dispose(): void {
    for (const indicator of this.#letterIndicators.values()) {
      indicator.dispose();
    }
    this.#letterIndicators.clear();
    this.#progressBar?.dispose();
  }
}
