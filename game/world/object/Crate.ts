import { Box3, Group, Mesh, MeshBasicMaterial, type Object3D, PlaneGeometry, SRGBColorSpace, Vector3 } from 'three';

import { TILE_SIZE } from '../../constants';
import { Cell } from '../../levels';
import type { ResourceType } from '../../types';
import { Resources } from '../../util/Resources';
import { Time } from '../../util/Time';
import { LevelObject } from './LevelObject';

const LID = {
  openAngle: -Math.PI * 0.35,
  openMs: 150,
  holdMs: 100,
  closeMs: 150,
};

type LidState = 'idle' | 'opening' | 'open' | 'closing';

export type CrateType =
  | typeof Cell.CRATE_BATTERY
  | typeof Cell.CRATE_FRAME
  | typeof Cell.CRATE_SCREEN
  | typeof Cell.CRATE_PACKAGE;

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
  #lidPivot: Object3D | null = null;
  #lidAngle = 0;
  #lidState: LidState = 'idle';
  #holdTimer = 0;
  #iconMesh: Mesh | null = null;

  #onTick = (): void => {
    if (!this.#lidPivot || this.#lidState === 'idle') return;

    const delta = Time.getInstance().delta;
    this.#holdTimer += delta;

    if (this.#lidState === 'opening') {
      const t = Math.min(this.#holdTimer / LID.openMs, 1);
      // ease-out: fast start, smooth stop
      this.#lidAngle = LID.openAngle * (1 - Math.pow(1 - t, 2));
      if (t >= 1) {
        this.#lidState = 'open';
        this.#holdTimer = 0;
      }
    } else if (this.#lidState === 'open') {
      if (this.#holdTimer >= LID.holdMs) {
        this.#lidState = 'closing';
        this.#holdTimer = 0;
      }
    } else if (this.#lidState === 'closing') {
      const t = Math.min(this.#holdTimer / LID.closeMs, 1);
      // ease-in: gradual start, fast finish
      this.#lidAngle = LID.openAngle * (1 - t * t);
      if (t >= 1) {
        this.#lidAngle = 0;
        this.#lidState = 'idle';
        this.#holdTimer = 0;
      }
    }

    this.#lidPivot.rotation.x = this.#lidAngle;
  };

  constructor(params: CrateParams) {
    super();
    this.#params = params;
    this.type = params.type;
  }

  public openLid(): void {
    if (this.#lidState !== 'idle') return;
    this.#lidState = 'opening';
  }

  public override dispose(): void {
    Time.getInstance().removeEventListener('tick', this.#onTick);
    if (this.#iconMesh) {
      (this.#iconMesh.material as MeshBasicMaterial).dispose();
      this.#iconMesh.geometry.dispose();
      this.#iconMesh = null;
    }
    super.dispose();
  }

  #setupLidPivot(mesh: Object3D): void {
    // Find direct child with highest Y center — that's the lid
    let lidChild: Object3D | null = null;
    let maxY = -Infinity;
    const tmpBox = new Box3();
    const tmpCenter = new Vector3();

    for (const child of mesh.children) {
      tmpBox.setFromObject(child);
      tmpBox.getCenter(tmpCenter);
      if (tmpCenter.y > maxY) {
        maxY = tmpCenter.y;
        lidChild = child;
      }
    }

    if (!lidChild) return;

    // Get lid bounds in mesh-local space (glTF nodes have no transforms, so
    // geometry bounding box == mesh-local bounding box)
    const lidLocalBox = new Box3();
    if (lidChild instanceof Mesh && lidChild.geometry) {
      lidChild.geometry.computeBoundingBox();
      if (lidChild.geometry.boundingBox) {
        lidLocalBox.copy(lidChild.geometry.boundingBox);
      }
    } else {
      lidLocalBox.setFromObject(lidChild);
    }

    // Hinge at bottom-front edge of lid (rotate around min-Z edge)
    const hinge = new Vector3((lidLocalBox.min.x + lidLocalBox.max.x) / 2, lidLocalBox.min.y, lidLocalBox.min.z);

    const pivot = new Group();
    pivot.position.copy(hinge);

    // Offset lid so it stays visually in place after reparenting
    mesh.remove(lidChild);
    lidChild.position.set(-hinge.x, -hinge.y, -hinge.z);
    pivot.add(lidChild);
    mesh.add(pivot);

    this.#lidPivot = pivot;

    const iconTextureName = Crate.#getIconTextureName(this.type);
    if (iconTextureName) {
      const texture = Resources.getInstance().getTextureAsset(iconTextureName);
      const alphaTexture = Resources.getInstance().getTextureAsset('alphaIcon');
      if (texture) {
        texture.colorSpace = SRGBColorSpace;
        const lidWidth = lidLocalBox.max.x - lidLocalBox.min.x;
        const iconSize = lidWidth * 0.7;
        const geometry = new PlaneGeometry(iconSize, iconSize);
        const material = new MeshBasicMaterial({
          map: texture,
          alphaTest: 0.5,
          alphaMap: alphaTexture ?? undefined,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });
        const iconMesh = new Mesh(geometry, material);
        iconMesh.position.set(0, lidLocalBox.max.y - lidLocalBox.min.y, (lidLocalBox.max.z - lidLocalBox.min.z) / 2);
        iconMesh.rotation.x = -Math.PI / 2;
        pivot.add(iconMesh);
        this.#iconMesh = iconMesh;
      }
    }
  }

  public getResourceType(): ResourceType {
    switch (this.type) {
      case Cell.CRATE_BATTERY:
        return 'battery';
      case Cell.CRATE_FRAME:
        return 'frame';
      case Cell.CRATE_SCREEN:
        return 'screen';
      case Cell.CRATE_PACKAGE:
        return 'package';
      default:
        return 'battery';
    }
  }

  public static getResourceModelName(type: CrateType | ResourceType): string | null {
    switch (type) {
      case Cell.CRATE_BATTERY:
      case 'battery':
        return 'batteryEmptyModel';
      case Cell.CRATE_FRAME:
      case 'frame':
        return 'frameBrokenModel';
      case Cell.CRATE_SCREEN:
      case 'screen':
        return 'screenBrokenModel';
      case 'phone':
        return 'phoneAssembledModel';
      case Cell.CRATE_PACKAGE:
      case 'package':
        return 'packageOpenModel';
      default:
        return null;
    }
  }

  public static getRepairedModelName(type: ResourceType): string | null {
    switch (type) {
      case 'battery':
        return 'batteryFullModel';
      case 'frame':
        return 'frameRepairedModel';
      case 'screen':
        return 'screenRepairedModel';
      case 'phone':
        return 'phoneAssembledModel';
      case 'package':
        return 'packageClosedModel';
      default:
        return null;
    }
  }

  static #getIconTextureName(type: CrateType): string | null {
    switch (type) {
      case Cell.CRATE_BATTERY:
        return 'batteryEmptyIcon';
      case Cell.CRATE_FRAME:
        return 'frameBrokenIcon';
      case Cell.CRATE_SCREEN:
        return 'screenBrokenIcon';
      case Cell.CRATE_PACKAGE:
        return 'packageOpenIcon';
      default:
        return null;
    }
  }

  static getCrateModelName(type: CrateType): string {
    switch (type) {
      case Cell.CRATE_BATTERY:
        return 'crateBatteryModel';
      case Cell.CRATE_FRAME:
        return 'crateFrameModel';
      case Cell.CRATE_SCREEN:
        return 'crateScreenModel';
      case Cell.CRATE_PACKAGE:
      default:
        return 'crateModel';
    }
  }

  create(group: Group): void {
    const { type, xIndex, zIndex, levelWidth, levelDepth } = this.#params;

    const modelName = Crate.getCrateModelName(type);
    const model = Resources.getInstance().getGLTFAsset(modelName);
    if (!model) {
      console.error(`Crate model "${modelName}" not loaded`);
      return;
    }

    const mesh = model.scene.clone();
    mesh.position.x = xIndex * TILE_SIZE;
    mesh.position.y = 0;
    mesh.position.z = zIndex * TILE_SIZE;

    this.applyEdgeRotation(mesh, xIndex, zIndex, TILE_SIZE, levelWidth, levelDepth);
    this.cloneMaterials(mesh);
    this.setupShadows(mesh);

    // Setup lid pivot before adding resource (avoid misidentifying resource as lid)
    this.#setupLidPivot(mesh);
    Time.getInstance().addEventListener('tick', this.#onTick);

    this.mesh = mesh;
    group.add(mesh);

    this.createPhysics(xIndex, zIndex, TILE_SIZE);
    this.isInteractable = true;
  }
}
