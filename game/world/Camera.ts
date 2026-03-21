import type { Scene } from 'three';
import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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
    this.#camera.position.set(center.x, CAMERA_DEFAULT_Y, CAMERA_DEFAULT_Z);
    const lookAtTarget = center.clone();
    lookAtTarget.z = CAMERA_LOOKAT_Z;
    this.#camera.lookAt(lookAtTarget);
    this.#scene.add(this.#camera);

    this.#defaultCameraPos = this.#camera.position.clone();
    this.#defaultLookAt = lookAtTarget.clone();

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

      this.#controls = new OrbitControls(this.#camera, this.#canvas);
      this.#controls.enableDamping = true;
      this.#controls.target.copy(this.#defaultLookAt);
      this.#controls.enablePan = false;
      // Left-click: vertical rotation only (azimuth locked)
      this.#controls.mouseButtons = {
        LEFT: 0 as never, // ROTATE
        MIDDLE: 1 as never, // DOLLY
        RIGHT: undefined as never, // disabled — handled manually below
      };
      this.#controls.update();
      const azimuth = this.#controls.getAzimuthalAngle();
      this.#controls.minAzimuthAngle = azimuth;
      this.#controls.maxAzimuthAngle = azimuth;

      // Right-click drag: move camera + target along world Z axis
      let rightDragging = false;
      let lastClientY = 0;
      const onPointerDown = (e: PointerEvent) => {
        if (e.button === 2) {
          rightDragging = true;
          lastClientY = e.clientY;
          this.#canvas.setPointerCapture(e.pointerId);
        }
      };
      const onPointerMove = (e: PointerEvent) => {
        if (!rightDragging) return;
        const deltaY = e.clientY - lastClientY;
        lastClientY = e.clientY;
        const speed = 0.05;
        this.#camera.position.z += deltaY * speed;
        this.#controls!.target.z += deltaY * speed;
      };
      const onPointerUp = (e: PointerEvent) => {
        if (e.button === 2) {
          rightDragging = false;
        }
      };
      this.#canvas.addEventListener('pointerdown', onPointerDown);
      this.#canvas.addEventListener('pointermove', onPointerMove);
      this.#canvas.addEventListener('pointerup', onPointerUp);
      this.#canvas.addEventListener('contextmenu', (e) => e.preventDefault());

      const folder = this.#debug.gui.addFolder('Camera');
      folder.add(this.#camera.position, 'x', -50, 50, 0.1).name('pos x').listen();
      folder.add(this.#camera.position, 'y', 0, 100, 0.1).name('pos y').listen();
      folder.add(this.#camera.position, 'z', -50, 100, 0.1).name('pos z').listen();
      folder.add(this.#controls.target, 'x', -50, 50, 0.1).name('target x').listen();
      folder.add(this.#controls.target, 'y', -50, 50, 0.1).name('target y').listen();
      folder.add(this.#controls.target, 'z', -50, 50, 0.1).name('target z').listen();
      folder.add(this.#camera.rotation, 'x', -Math.PI, Math.PI, 0.01).name('rot x').listen();
      folder.add(this.#camera.rotation, 'y', -Math.PI, Math.PI, 0.01).name('rot y').listen();
      folder.add(this.#camera.rotation, 'z', -Math.PI, Math.PI, 0.01).name('rot z').listen();
      folder
        .add(this.#camera, 'fov', 1, 120, 0.1)
        .name('fov')
        .listen()
        .onChange(() => {
          this.#camera.updateProjectionMatrix();
        });
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
