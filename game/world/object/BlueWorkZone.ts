import { Box3, BoxGeometry, type Group, Mesh, MeshStandardMaterial, PointLight, Vector3 } from 'three';

import { BLOOM_LAYER, TILE_SIZE } from '../../constants';
import { ProgressBar } from '../../hud/ProgressBar';
import { createIconPlane, type IconPlaneResult } from '../../lib/createIconPlane';
import type { ResourceState, ResourceType } from '../../types';
import { Debug } from '../../util/Debug';
import { Resources } from '../../util/Resources';
import { AssemblyAnimation } from '../AssemblyAnimation';
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

const LED_COLORS = {
  empty: 0xff2200,
  partial: 0xff5500,
  assembling: 0x2244ff,
  ready: 0x55ff00,
} as const;
const LED_INTENSITIES: Record<keyof typeof LED_COLORS, number> = {
  empty: 3.95,
  partial: 3.2,
  assembling: 15,
  ready: 2.0,
};
type LedState = keyof typeof LED_COLORS;

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
  #ledMesh: Mesh | null = null;
  #ledMaterial: MeshStandardMaterial | null = null;
  #ledLight: PointLight | null = null;
  #assemblyAnim: AssemblyAnimation | null = null;

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
      this.#updateLed();
      this.#createIndicators();
      this.resetAssemblyProgress();
      return;
    }
    const type = resource.getResourceType() as AssemblyResourceType;
    if (ASSEMBLY_RESOURCES.includes(type)) {
      this.#containedResources.set(type, resource);
      this.#updateLed();
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
        this.#updateLed();
        this.#setSlotIcon(type, 'plusIcon');
        break;
      }
    }
  }

  public override setHighlight(enabled: boolean): void {
    super.setHighlight(enabled);
    this.#updateLed();
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
    this.#updateLed();
    this.#phoneResource = phone;

    // Hide phone model mesh
    phone.getMesh()?.traverse((child) => {
      if (child instanceof Mesh) child.visible = false;
    });
  }

  public clearAwaitingPackaging(): DroppedResource | null {
    const phone = this.#phoneResource;
    this.#awaitingPackaging = false;
    this.#containedResources.clear();
    this.#updateLed();
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
    const anchor = new Vector3(this.mesh.position.x + TILE_SIZE / 2, 2.8, this.mesh.position.z + TILE_SIZE / 2);
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
    return new Vector3(this.mesh.position.x + TILE_SIZE / 2, 0.5, this.mesh.position.z + TILE_SIZE / 2);
  }

  public canAcceptPackage(type: ResourceType, state: ResourceState): boolean {
    return this.#awaitingPackaging && type === 'package' && state === 'broken';
  }

  public isReadyToAssemble(): boolean {
    return ASSEMBLY_RESOURCES.every((type) => this.#containedResources.has(type));
  }

  public assemble(): DroppedResource[] {
    this.#assemblyAnim?.stop();
    const removed = Array.from(this.#containedResources.values());
    this.#containedResources.clear();
    this.#updateLed();
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
    this.#assemblyAnim?.stop();
    this.#assemblyProgress = 0;
    this.#progressBar?.dispose();
    this.#progressBar = null;
  }

  public updateAnimation(deltaMs: number): void {
    if (this.isReadyToAssemble()) {
      if (!this.#assemblyAnim!.active) this.#assemblyAnim!.start(this.mesh!);
      this.#assemblyAnim!.update(deltaMs);
    }
  }

  public isAssemblyComplete(requiredDuration: number): boolean {
    return this.#assemblyProgress >= requiredDuration;
  }

  public getOrCreateProgressBar(levelGroup: Group): ProgressBar {
    if (!this.#progressBar) {
      this.#progressBar = new ProgressBar(0.5, 0.075);
      const pos = this.getPosition();
      if (pos) {
        this.#progressBar.setPosition(new Vector3(pos.x, 1.3, pos.z));
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
    return new Vector3(this.mesh!.position.x + startX + index * spacing, 2.8, this.mesh!.position.z + TILE_SIZE * 0.5);
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
    this.#createLed();

    this.createPhysics(xIndex, zIndex, TILE_SIZE);
    this.isInteractable = true;
    this.#assemblyAnim = new AssemblyAnimation();
  }

  #getLedState(): LedState {
    if (this.#awaitingPackaging) return 'ready';
    if (this.isReadyToAssemble()) return 'assembling';
    if (this.#containedResources.size > 0) return 'partial';
    return 'empty';
  }

  #updateLed(): void {
    if (!this.#ledMaterial || !this.#ledLight) return;
    const state = this.#getLedState();
    const color = LED_COLORS[state];
    this.#ledMaterial.emissive.setHex(color);
    this.#ledMaterial.emissiveIntensity = LED_INTENSITIES[state];
    this.#ledLight.color.setHex(color);
  }

  #createLed(): void {
    if (!this.mesh) return;
    const model = Resources.getInstance().getGLTFAsset('blueWorkZoneModel');
    if (!model) return;
    const modelSize = new Box3().setFromObject(model.scene).getSize(new Vector3());

    const geo = new BoxGeometry(0.76, 0.2, 0.04);
    const mat = new MeshStandardMaterial({
      color: 0x111111,
      emissive: LED_COLORS.empty,
      emissiveIntensity: 2.0,
      roughness: 0.3,
      metalness: 0.6,
    });
    const ledMesh = new Mesh(geo, mat);
    ledMesh.position.set(TILE_SIZE / 2, 1.85, 1.4);
    ledMesh.rotation.x = -Math.PI / 5;
    ledMesh.frustumCulled = false;
    ledMesh.layers.enable(BLOOM_LAYER);
    this.mesh.add(ledMesh);

    const light = new PointLight(LED_COLORS.empty, 0.4, 1.5);
    light.position.set(TILE_SIZE / 2, modelSize.y - 0.05, 0.15);
    this.mesh.add(light);

    this.#ledMesh = ledMesh;
    this.#ledMaterial = mat;
    this.#ledLight = light;
    this.#updateLed();

    const debug = Debug.getInstance();
    if (debug?.active) {
      const folder = debug.gui.addFolder('BlueWorkZone LED');
      const pos = ledMesh.position;
      folder
        .add(pos, 'x', -2, 4, 0.01)
        .name('pos x')
        .onChange(() => {
          light.position.x = pos.x;
        });
      folder
        .add(pos, 'y', 0, 4, 0.01)
        .name('pos y')
        .onChange(() => {
          light.position.y = pos.y;
        });
      folder
        .add(pos, 'z', -2, 2, 0.01)
        .name('pos z')
        .onChange(() => {
          light.position.z = pos.z;
        });
      folder.add(ledMesh.rotation, 'x', -Math.PI, Math.PI, 0.01).name('rot x');
      folder.add(ledMesh.rotation, 'y', -Math.PI, Math.PI, 0.01).name('rot y');
      folder.add(ledMesh.rotation, 'z', -Math.PI, Math.PI, 0.01).name('rot z');
      folder.open();
    }
  }

  #createIndicators(): void {
    for (const type of ASSEMBLY_RESOURCES) {
      this.#setSlotIcon(type, 'plusIcon');
    }
  }

  override dispose(): void {
    this.#assemblyAnim?.stop();
    for (const icon of this.#slotIcons.values()) {
      icon.mesh.removeFromParent();
      icon.dispose();
    }
    this.#slotIcons.clear();
    this.#progressBar?.dispose();
    this.hidePhoneIcon();
    this.#ledMesh?.removeFromParent();
    this.#ledMesh?.geometry.dispose();
    this.#ledMaterial?.dispose();
    this.#ledMesh = null;
    this.#ledMaterial = null;
    this.#ledLight?.removeFromParent();
    this.#ledLight = null;
    super.dispose();
  }
}
