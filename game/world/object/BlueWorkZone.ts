import { type Group, Mesh, Vector3 } from 'three';

import { TILE_SIZE } from '../../constants';
import { ProgressBar } from '../../hud/ProgressBar';
import { createIconPlane, type IconPlaneResult } from '../../lib/createIconPlane';
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
const ASSEMBLY_RESOURCES: AssemblyResourceType[] = ['battery', 'screen', 'frame'];

const RESOURCE_ICON_MAP: Record<AssemblyResourceType, string> = {
  battery: 'batteryFilledIcon',
  frame: 'frameRepairedIcon',
  screen: 'screenRepairedIcon',
};

export class BlueWorkZone extends LevelObject {
  #params: BlueWorkZoneParams;
  #containedResources: Map<AssemblyResourceType, DroppedResource> = new Map();
  #slotIcons: Map<AssemblyResourceType, IconPlaneResult> = new Map();
  #assemblyProgress: number = 0;
  #progressBar: ProgressBar | null = null;
  #awaitingPackaging: boolean = false;
  #phoneResource: DroppedResource | null = null;
  #zoneIcon: IconPlaneResult | null = null;

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
      this.#createIndicators();
      this.resetAssemblyProgress();
      return;
    }
    const type = resource.getResourceType() as AssemblyResourceType;
    if (ASSEMBLY_RESOURCES.includes(type)) {
      this.#containedResources.set(type, resource);
      this.#setSlotIcon(type, RESOURCE_ICON_MAP[type]);
      this.resetAssemblyProgress();

      // Hide dropped resource model
      resource.getMesh()?.traverse((child) => {
        if (child instanceof Mesh) child.visible = false;
      });
    }
  }

  public removeResource(resource: DroppedResource): void {
    for (const [type, r] of this.#containedResources) {
      if (r === resource) {
        this.#containedResources.delete(type);
        this.#setSlotIcon(type, 'plusIcon');
        break;
      }
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

    // Hide phone model mesh
    phone.getMesh()?.traverse((child) => {
      if (child instanceof Mesh) child.visible = false;
    });
  }

  public clearAwaitingPackaging(): DroppedResource | null {
    const phone = this.#phoneResource;
    this.#awaitingPackaging = false;
    this.#phoneResource = null;
    this.hidePhoneIcon();
    return phone;
  }

  public showPhoneIcon(): void {
    if (this.#zoneIcon || !this.mesh) return;

    // Dispose all slot icons before showing phone icon
    for (const icon of this.#slotIcons.values()) {
      icon.mesh.removeFromParent();
      icon.dispose();
    }
    this.#slotIcons.clear();

    const texture = Resources.getInstance().getTextureAsset('phoneIcon');
    if (!texture) return;
    const anchor = new Vector3(
      this.mesh.position.x + TILE_SIZE / 2,
      2.8,
      this.mesh.position.z + TILE_SIZE / 2,
    );
    this.#zoneIcon = createIconPlane(texture, 0.3, anchor);
    this.mesh.parent?.add(this.#zoneIcon.mesh);
  }

  public hidePhoneIcon(): void {
    if (!this.#zoneIcon) return;
    this.#zoneIcon.mesh.removeFromParent();
    this.#zoneIcon.dispose();
    this.#zoneIcon = null;

    // Restore plus icons
    this.#createIndicators();
  }

  public override getDropSurface(): Vector3 | null {
    if (!this.mesh) return null;
    return new Vector3(
      this.mesh.position.x + TILE_SIZE / 2,
      0.5,
      this.mesh.position.z + TILE_SIZE / 2,
    );
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

  #getSlotAnchor(index: number): Vector3 {
    const spacing = 1.2;
    const totalWidth = spacing * (ASSEMBLY_RESOURCES.length - 1);
    const startX = TILE_SIZE * 0.5 - totalWidth / 2;
    return new Vector3(
      this.mesh!.position.x + startX + index * spacing,
      2.8,
      this.mesh!.position.z + TILE_SIZE * 0.5,
    );
  }

  #setSlotIcon(type: AssemblyResourceType, textureName: string): void {
    const old = this.#slotIcons.get(type);
    if (old) {
      old.mesh.removeFromParent();
      old.dispose();
    }

    const texture = Resources.getInstance().getTextureAsset(textureName);
    if (!texture || !this.mesh?.parent) return;

    const index = ASSEMBLY_RESOURCES.indexOf(type);
    const anchor = this.#getSlotAnchor(index);
    const icon = createIconPlane(texture, 0.3, anchor);
    this.mesh.parent.add(icon.mesh);
    this.#slotIcons.set(type, icon);
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

    this.mesh = mesh;
    group.add(mesh);

    this.#createIndicators();

    this.createPhysics(xIndex, zIndex, TILE_SIZE);
    this.isInteractable = true;
  }

  #createIndicators(): void {
    for (const type of ASSEMBLY_RESOURCES) {
      this.#setSlotIcon(type, 'plusIcon');
    }
  }

  override dispose(): void {
    for (const icon of this.#slotIcons.values()) {
      icon.mesh.removeFromParent();
      icon.dispose();
    }
    this.#slotIcons.clear();
    this.#progressBar?.dispose();
    this.hidePhoneIcon();
  }
}
