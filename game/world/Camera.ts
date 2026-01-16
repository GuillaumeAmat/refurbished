import type { Scene } from 'three';
import { PerspectiveCamera } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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

    this.#camera = new PerspectiveCamera(35, aspect, 0.1, 100);
    this.#camera.position.set(center.x, center.y + 30, center.z + 18);
    this.#camera.lookAt(center);
    this.#scene.add(this.#camera);

    this.setupControls();
    this.setSizesAndRatio();
  }

  private async setupControls() {
    if (this.#debug.active) {
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

      const { center } = this.#levelInfo;

      this.#controls = new OrbitControls(this.#camera, this.#canvas);
      this.#controls.enableDamping = true;
      this.#controls.target.set(center.x, center.y, center.z);
      this.#controls.update();
    }
  }

  public setSizesAndRatio() {
    // For perspective camera
    this.#camera.aspect = this.#sizes.width / this.#sizes.height;
    // End perspective camera

    // For orthographic camera
    // const aspect = this.#sizes.width / this.#sizes.height;
    // this.#camera.left = (-FRUSTUM * aspect) / 2;
    // this.#camera.right = (FRUSTUM * aspect) / 2;
    // this.#camera.top = FRUSTUM / 2;
    // this.#camera.bottom = -FRUSTUM / 2;
    // End orthographic camera

    this.#camera.updateProjectionMatrix();
  }

  public update() {
    if (this.#debug.active) {
      this.#controls?.update();
    }
  }
}
