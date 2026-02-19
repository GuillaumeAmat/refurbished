import type { Scene } from 'three';
import { CineonToneMapping, PCFSoftShadowMap, SRGBColorSpace, Vector2, WebGLRenderer } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import type { Camera } from '../world/Camera';
import { Debug } from './Debug';
import { Sizes } from './Sizes';

export class Renderer {
  #canvas: HTMLCanvasElement;
  #camera: Camera;
  #renderer: WebGLRenderer;
  #composer: EffectComposer;
  #scene: Scene;
  #sizes: Sizes;
  #bloomPass: UnrealBloomPass;
  #debug: Debug;

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

    // Post-processing
    this.#composer = new EffectComposer(this.#renderer);

    const renderPass = new RenderPass(this.#scene, this.#camera.camera);
    this.#composer.addPass(renderPass);

    this.#bloomPass = new UnrealBloomPass(
      new Vector2(this.#sizes.width, this.#sizes.height),
      0.46, // strength
      0.01, // radius
      0.93, // threshold
    );
    this.#composer.addPass(this.#bloomPass);

    const outputPass = new OutputPass();
    this.#composer.addPass(outputPass);

    this.setSizesAndRatio();

    // Debug controls for bloom
    this.#debug = Debug.getInstance();
    if (this.#debug.active) {
      const bloomFolder = this.#debug.gui.addFolder('Bloom');
      bloomFolder.add(this.#bloomPass, 'strength', 0, 3, 0.01).name('Strength').onChange(() => this.#debug.save());
      bloomFolder.add(this.#bloomPass, 'radius', 0, 2, 0.01).name('Radius').onChange(() => this.#debug.save());
      bloomFolder.add(this.#bloomPass, 'threshold', 0, 1, 0.01).name('Threshold').onChange(() => this.#debug.save());
    }
  }

  public setSizesAndRatio() {
    this.#renderer.setSize(this.#sizes.width, this.#sizes.height);
    this.#renderer.setPixelRatio(this.#sizes.pixelRatio);
    this.#composer.setSize(this.#sizes.width, this.#sizes.height);
    this.#composer.setPixelRatio(this.#sizes.pixelRatio);
  }

  public update() {
    this.#composer.render();
  }
}
