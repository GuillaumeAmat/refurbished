import type { PerspectiveCamera } from 'three';
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';

import { PROGRESS_BAR_FILL_COLOR } from '../constants';

const PADDING = 0.045;
const REFERENCE_DIST = 14;
const SCREEN_UP_OFFSET = 0.2;

const _cameraUp = new Vector3();
const _toAnchor = new Vector3();
const _cameraDir = new Vector3();

export class ProgressBar {
  #group: Group;
  #backgroundMesh: Mesh;
  #fillMesh: Mesh;
  #width: number;
  #anchor: Vector3 = new Vector3();

  constructor(width = 1, height = 0.1) {
    this.#width = width;
    this.#group = new Group();

    const bgGeometry = new PlaneGeometry(width + 2 * PADDING, height + 2 * PADDING);
    const bgMaterial = new MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false });
    this.#backgroundMesh = new Mesh(bgGeometry, bgMaterial);
    this.#backgroundMesh.renderOrder = 999;
    this.#group.add(this.#backgroundMesh);

    const fillGeometry = new PlaneGeometry(width, height);
    const fillMaterial = new MeshBasicMaterial({ color: PROGRESS_BAR_FILL_COLOR, depthTest: false, depthWrite: false });
    this.#fillMesh = new Mesh(fillGeometry, fillMaterial);
    this.#fillMesh.position.z = 0.001;
    this.#fillMesh.renderOrder = 999;
    this.#group.add(this.#fillMesh);

    this.#backgroundMesh.onBeforeRender = (_, __, camera) => {
      (camera as PerspectiveCamera).getWorldDirection(_cameraDir);
      _cameraUp.setFromMatrixColumn((camera as PerspectiveCamera).matrixWorld, 1);
      _toAnchor.subVectors(this.#anchor, (camera as PerspectiveCamera).position);
      const depth = _toAnchor.dot(_cameraDir);
      const scaledOffset = SCREEN_UP_OFFSET * (depth / REFERENCE_DIST);
      this.#group.position.copy(this.#anchor).addScaledVector(_cameraUp, scaledOffset);
      this.#group.quaternion.copy(camera.quaternion);
      this.#group.scale.setScalar(depth / REFERENCE_DIST);
    };

    this.setProgress(0);
    this.hide();
  }

  public getGroup(): Group {
    return this.#group;
  }

  public setPosition(position: Vector3): void {
    this.#anchor.copy(position);
    this.#group.position.copy(position);
  }

  public setProgress(progress: number): void {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    this.#fillMesh.scale.x = clampedProgress || 0.001;
    this.#fillMesh.position.x = -(this.#width / 2) * (1 - clampedProgress);
  }

  public show(): void {
    this.#group.visible = true;
  }

  public hide(): void {
    this.#group.visible = false;
  }

  public dispose(): void {
    this.#backgroundMesh.geometry.dispose();
    (this.#backgroundMesh.material as MeshBasicMaterial).dispose();
    this.#fillMesh.geometry.dispose();
    (this.#fillMesh.material as MeshBasicMaterial).dispose();
    this.#group.removeFromParent();
  }
}
