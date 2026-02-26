import type { Material, Scene } from 'three';
import {
  CineonToneMapping,
  HalfFloatType,
  Mesh,
  MeshBasicMaterial,
  PCFSoftShadowMap,
  SRGBColorSpace,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { BLOOM_LAYER } from '../constants';
import type { Camera } from '../world/Camera';
import { Debug } from './Debug';
import { Sizes } from './Sizes';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D baseTexture;
  uniform sampler2D bloomTexture;
  varying vec2 vUv;
  void main() {
    gl_FragColor = texture2D(baseTexture, vUv) + vec4(1.0) * texture2D(bloomTexture, vUv);
  }
`;

export class Renderer {
  #canvas: HTMLCanvasElement;
  #camera: Camera;
  #renderer: WebGLRenderer;
  #bloomComposer: EffectComposer;
  #finalComposer: EffectComposer;
  #scene: Scene;
  #sizes: Sizes;
  #bloomPass: UnrealBloomPass;
  #debug: Debug;
  #darkMaterial = new MeshBasicMaterial({ color: 0x000000 });
  #materialCache: Map<string, Material | Material[]> = new Map();

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

    // Bloom composer — renders full scene with non-bloom objects darkened, no background
    const bloomRenderTarget = new WebGLRenderTarget(this.#sizes.width, this.#sizes.height, {
      type: HalfFloatType,
    });
    this.#bloomComposer = new EffectComposer(this.#renderer, bloomRenderTarget);
    this.#bloomComposer.renderToScreen = false;
    this.#bloomComposer.addPass(new RenderPass(this.#scene, this.#camera.camera));

    this.#bloomPass = new UnrealBloomPass(
      new Vector2(this.#sizes.width, this.#sizes.height),
      0.46, // strength
      0.01, // radius
      0.93, // threshold
    );
    this.#bloomComposer.addPass(this.#bloomPass);

    // Final composer — renders all layers and mixes in bloom texture
    this.#finalComposer = new EffectComposer(this.#renderer);
    this.#finalComposer.addPass(new RenderPass(this.#scene, this.#camera.camera));

    const mixPass = new ShaderPass(
      new ShaderMaterial({
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: { value: this.#bloomComposer.renderTarget2.texture },
        },
        vertexShader,
        fragmentShader,
        defines: {},
      }),
      'baseTexture',
    );
    mixPass.needsSwap = true;
    this.#finalComposer.addPass(mixPass);
    this.#finalComposer.addPass(new OutputPass());

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
    this.#bloomComposer.setSize(this.#sizes.width, this.#sizes.height);
    this.#bloomComposer.setPixelRatio(this.#sizes.pixelRatio);
    this.#finalComposer.setSize(this.#sizes.width, this.#sizes.height);
    this.#finalComposer.setPixelRatio(this.#sizes.pixelRatio);
  }

  public update() {
    // Bloom pass: darken non-bloom objects so depth is preserved but only neons contribute bloom
    this.#scene.traverse((obj) => {
      if (obj instanceof Mesh && !(obj.layers.mask & (1 << BLOOM_LAYER))) {
        this.#materialCache.set(obj.uuid, obj.material);
        obj.material = this.#darkMaterial;
      }
    });
    const savedBackground = this.#scene.background;
    this.#scene.background = null;
    this.#bloomComposer.render();
    this.#scene.background = savedBackground;

    // Restore materials before final pass
    this.#scene.traverse((obj) => {
      if (obj instanceof Mesh) {
        const saved = this.#materialCache.get(obj.uuid);
        if (saved !== undefined) {
          obj.material = saved as Material;
          this.#materialCache.delete(obj.uuid);
        }
      }
    });

    // Final pass: normal materials, mixes in bloom texture
    this.#finalComposer.render();
  }
}
