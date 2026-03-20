import type { Scene } from 'three';
import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three';

import {
  CAMERA_DEFAULT_FOV,
  CAMERA_DEFAULT_Y,
  CAMERA_DEFAULT_Z,
  CAMERA_LOOKAT_Z,
  CAMERA_PAN_MARGIN,
  CAMERA_SMOOTH_TIME,
  CAMERA_ZOOM_STRENGTH,
} from '../constants';
import type { LevelInfo } from '../levels';
import { Sizes } from '../util/Sizes';

export class Camera {
  #camera: PerspectiveCamera;
  #scene: Scene;
  #sizes: Sizes;
  #levelInfo: LevelInfo;

  #defaultCameraPos: Vector3;
  #defaultLookAt: Vector3;
  #panBoundX = 0;
  #panBoundZ = 0;
  #currentPanOffset = new Vector3();
  #targetPanOffset = new Vector3();
  #currentLookAt = new Vector3();
  #currentZoom = 0;
  #targetZoom = 0;
  #lastUpdateTime = 0;

  public get camera() {
    return this.#camera;
  }

  constructor(scene: Scene, _canvas: HTMLCanvasElement, levelInfo: LevelInfo) {
    this.#scene = scene;
    this.#sizes = new Sizes();
    this.#levelInfo = levelInfo;

    const aspect = this.#sizes.width / this.#sizes.height;
    const { center } = this.#levelInfo;

    this.#camera = new PerspectiveCamera(CAMERA_DEFAULT_FOV, aspect, 0.1, 100);
    this.#camera.position.set(center.x, CAMERA_DEFAULT_Y, CAMERA_DEFAULT_Z);
    const lookAtTarget = center.clone();
    lookAtTarget.z = CAMERA_LOOKAT_Z;
    this.#camera.lookAt(lookAtTarget);
    this.#scene.add(this.#camera);

    this.#defaultCameraPos = this.#camera.position.clone();
    this.#defaultLookAt = lookAtTarget.clone();

    this.#camera.updateMatrixWorld();
    this.#computePanBounds();

    this.setSizesAndRatio();
  }

  #computePanBounds() {
    const plane = new Plane(new Vector3(0, 1, 0), 0);
    const raycaster = new Raycaster();

    const leftPt = new Vector3();
    raycaster.setFromCamera(new Vector2(-1, 0), this.#camera);
    raycaster.ray.intersectPlane(plane, leftPt);

    const rightPt = new Vector3();
    raycaster.setFromCamera(new Vector2(1, 0), this.#camera);
    raycaster.ray.intersectPlane(plane, rightPt);

    this.#panBoundX = Math.abs(rightPt.x - leftPt.x) * CAMERA_PAN_MARGIN;

    const topPt = new Vector3();
    raycaster.setFromCamera(new Vector2(0, 1), this.#camera);
    raycaster.ray.intersectPlane(plane, topPt);

    const bottomPt = new Vector3();
    raycaster.setFromCamera(new Vector2(0, -1), this.#camera);
    raycaster.ray.intersectPlane(plane, bottomPt);

    this.#panBoundZ = Math.abs(topPt.z - bottomPt.z) * CAMERA_PAN_MARGIN;
  }

  public setFollowTarget(center: Vector3 | null, zoomFactor: number): void {
    if (center === null) {
      this.#targetPanOffset.set(0, 0, 0);
      this.#targetZoom = 0;
      return;
    }

    const rawX = center.x - this.#defaultLookAt.x;
    const rawZ = center.z - this.#defaultLookAt.z;

    this.#targetPanOffset.set(
      Math.max(-this.#panBoundX, Math.min(this.#panBoundX, rawX)),
      0,
      Math.max(-this.#panBoundZ, Math.min(this.#panBoundZ, rawZ)),
    );
    this.#targetZoom = Math.max(-1, Math.min(1, zoomFactor));
  }

  public setSizesAndRatio() {
    this.#camera.aspect = this.#sizes.width / this.#sizes.height;
    this.#camera.updateProjectionMatrix();
  }

  public update() {
    const now = Date.now();
    const dt = this.#lastUpdateTime > 0 ? (now - this.#lastUpdateTime) / 1000 : 0;
    this.#lastUpdateTime = now;

    const factor = dt > 0 ? 1 - Math.exp(-dt / CAMERA_SMOOTH_TIME) : 0;

    this.#currentPanOffset.lerp(this.#targetPanOffset, factor);
    this.#currentZoom += (this.#targetZoom - this.#currentZoom) * factor;

    this.#camera.position.copy(this.#defaultCameraPos).add(this.#currentPanOffset);
    this.#camera.lookAt(this.#currentLookAt.copy(this.#defaultLookAt).add(this.#currentPanOffset));

    const newFov = CAMERA_DEFAULT_FOV * (1 - this.#currentZoom * CAMERA_ZOOM_STRENGTH);
    if (newFov !== this.#camera.fov) {
      this.#camera.fov = newFov;
      this.#camera.updateProjectionMatrix();
    }
  }
}
