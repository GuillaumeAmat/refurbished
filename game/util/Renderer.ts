import type { Scene } from 'three';
import { CineonToneMapping, PCFSoftShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';

import type { Camera } from '../world/Camera';
import { Sizes } from './Sizes';

export class Renderer {
  #canvas: HTMLCanvasElement;
  #camera: Camera;
  #renderer: WebGLRenderer;
  #scene: Scene;
  #sizes: Sizes;

  constructor(scene: Scene, canvas: HTMLCanvasElement, camera: Camera) {
    this.#canvas = canvas;
    this.#camera = camera;
    this.#scene = scene;
    this.#sizes = new Sizes();

    this.#renderer = new WebGLRenderer({
      canvas: this.#canvas,
      antialias: true,
    });

    // this.#renderer.physicallyCorrectLights = true;
    this.#renderer.outputColorSpace = SRGBColorSpace;
    this.#renderer.toneMapping = CineonToneMapping;
    this.#renderer.toneMappingExposure = 1.75;

    this.#renderer.shadowMap.enabled = true;
    this.#renderer.shadowMap.type = PCFSoftShadowMap;

    this.setSizesAndRatio();
  }

  public setSizesAndRatio() {
    this.#renderer.setSize(this.#sizes.width, this.#sizes.height);
    this.#renderer.setPixelRatio(this.#sizes.pixelRatio);
  }

  public update() {
    this.#renderer.render(this.#scene, this.#camera.camera);
  }
}
