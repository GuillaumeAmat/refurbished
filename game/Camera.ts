import type { Scene } from 'three';
import { PerspectiveCamera, Vector3 } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { LEVEL_1_MATRIX, TILE_SIZE } from './constants';
import { Debug } from './utils/Debug';
import { Sizes } from './utils/Sizes';

export class Camera {
  #canvas: HTMLCanvasElement;
  #camera: PerspectiveCamera;
  #scene: Scene;
  #sizes: Sizes;
  #debug: Debug;

  #controls?: OrbitControls;

  public get camera() {
    return this.#camera;
  }

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
    this.#scene = scene;
    this.#sizes = new Sizes();
    this.#debug = Debug.getInstance();

    const aspect = this.#sizes.width / this.#sizes.height;

    // Calculate level center in positive space
    const levelWidth = (LEVEL_1_MATRIX[0]?.length || 0) * TILE_SIZE;
    const levelDepth = LEVEL_1_MATRIX.length * TILE_SIZE;
    const levelCenter = new Vector3(levelWidth / 2, 0, levelDepth / 2);

    this.#camera = new PerspectiveCamera(35, aspect, 0.1, 100);
    this.#camera.position.set(levelCenter.x, levelCenter.y + 30, levelCenter.z + 18);
    this.#camera.lookAt(levelCenter);
    this.#scene.add(this.#camera);

    this.setupControls();
    this.setSizesAndRatio();
  }

  private async setupControls() {
    if (this.#debug.active) {
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

      // Calculate level center in positive space
      const levelWidth = (LEVEL_1_MATRIX[0]?.length || 0) * TILE_SIZE;
      const levelDepth = LEVEL_1_MATRIX.length * TILE_SIZE;
      const levelCenter = new Vector3(levelWidth / 2, 0, levelDepth / 2);

      this.#controls = new OrbitControls(this.#camera, this.#canvas);
      this.#controls.enableDamping = true;
      this.#controls.target.set(levelCenter.x, levelCenter.y, levelCenter.z);
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
