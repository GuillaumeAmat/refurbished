import type { Scene } from 'three';
import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { CAMERA_DEFAULT_FOV, CAMERA_PAN_MARGIN, CAMERA_SMOOTH_TIME, CAMERA_ZOOM_STRENGTH } from '../constants';
import type { LevelInfo } from '../levels';
import { Debug } from '../util/Debug';
import { Sizes } from '../util/Sizes';


export class Camera {
  #canvas: HTMLCanvasElement;
  #camera: PerspectiveCamera;
  #scene: Scene;
  #sizes: Sizes;
  #debug: Debug;
  #levelInfo: LevelInfo;

  #controls?: OrbitControls;

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

  constructor(scene: Scene, canvas: HTMLCanvasElement, levelInfo: LevelInfo) {
    this.#canvas = canvas;
    this.#scene = scene;
    this.#sizes = new Sizes();
    this.#debug = Debug.getInstance();
    this.#levelInfo = levelInfo;

    const aspect = this.#sizes.width / this.#sizes.height;
    const { center } = this.#levelInfo;

    this.#camera = new PerspectiveCamera(CAMERA_DEFAULT_FOV, aspect, 0.1, 100);
    this.#camera.position.set(center.x, center.y + 28, center.z + 23);
    this.#camera.lookAt(center);
    this.#scene.add(this.#camera);

    this.#defaultCameraPos = this.#camera.position.clone();
    this.#defaultLookAt = center.clone();

    this.#camera.updateMatrixWorld();
    this.#computePanBounds();

    this.setupControls();
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

  private async setupControls() {
    if (this.#debug.active) {
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

      const { center } = this.#levelInfo;

      this.#controls = new OrbitControls(this.#camera, this.#canvas);
      this.#controls.enableDamping = true;
      this.#controls.target.set(center.x, center.y, center.z);
      this.#controls.update();

      const folder = this.#debug.gui.addFolder('Camera');
      folder.add(this.#camera.position, 'x', -50, 50, 0.1).listen();
      folder.add(this.#camera.position, 'y', 0, 100, 0.1).listen();
      folder.add(this.#camera.position, 'z', -50, 100, 0.1).listen();
    }
  }

  public setSizesAndRatio() {
    this.#camera.aspect = this.#sizes.width / this.#sizes.height;
    this.#camera.updateProjectionMatrix();
  }

  public update() {
    if (this.#debug.active) {
      this.#controls?.update();
      return;
    }

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
