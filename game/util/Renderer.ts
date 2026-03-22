import type { Material, Scene } from 'three';
import {
  HalfFloatType,
  Mesh,
  MeshBasicMaterial,
  PCFSoftShadowMap,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { BLOOM_LAYER, OVERLAY_LAYER } from '../constants';
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
  #darkTransparentMaterial = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false });
  #materialCache: Map<string, Material | Material[]> = new Map();

  constructor(scene: Scene, canvas: HTMLCanvasElement, camera: Camera) {
    this.#canvas = canvas;
    this.#camera = camera;
    this.#scene = scene;
    this.#sizes = Sizes.getInstance();

    this.#renderer = new WebGLRenderer({
      canvas: this.#canvas,
      antialias: true,
    });

    // this.#renderer.physicallyCorrectLights = true;
    this.#renderer.outputColorSpace = SRGBColorSpace;

    this.#renderer.shadowMap.enabled = true;
    this.#renderer.shadowMap.type = PCFSoftShadowMap;

    // Bloom composer at half resolution — bloom is inherently blurry, no need for full res
    const bloomRenderTarget = new WebGLRenderTarget(
      Math.ceil(this.#sizes.width / 2),
      Math.ceil(this.#sizes.height / 2),
      { type: HalfFloatType },
    );
    this.#bloomComposer = new EffectComposer(this.#renderer, bloomRenderTarget);
    this.#bloomComposer.renderToScreen = false;
    this.#bloomComposer.addPass(new RenderPass(this.#scene, this.#camera.camera));

    this.#bloomPass = new UnrealBloomPass(
      new Vector2(this.#sizes.width, this.#sizes.height),
      0.5, // strength
      0.2, // radius
      0.9, // threshold
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
      bloomFolder
        .add(this.#bloomPass, 'strength', 0, 3, 0.01)
        .name('Strength')
        .onChange(() => this.#debug.save());
      bloomFolder
        .add(this.#bloomPass, 'radius', 0, 2, 0.01)
        .name('Radius')
        .onChange(() => this.#debug.save());
      bloomFolder
        .add(this.#bloomPass, 'threshold', 0, 1, 0.01)
        .name('Threshold')
        .onChange(() => this.#debug.save());
    }
  }

  public setSizesAndRatio() {
    this.#renderer.setSize(this.#sizes.width, this.#sizes.height);
    this.#renderer.setPixelRatio(this.#sizes.pixelRatio);
    this.#bloomComposer.setSize(Math.ceil(this.#sizes.width / 2), Math.ceil(this.#sizes.height / 2));
    this.#bloomComposer.setPixelRatio(1);
    this.#finalComposer.setSize(this.#sizes.width, this.#sizes.height);
    this.#finalComposer.setPixelRatio(this.#sizes.pixelRatio);
  }

  public update() {
    // Bloom pass: single traverse to darken non-bloom objects, collect refs for restore.
    // Transparent objects get an invisible material (no depth write) so they
    // don't occlude bloom-layer meshes behind them in the depth buffer.
    const darkened: Mesh[] = [];
    this.#scene.traverse((obj) => {
      if (obj instanceof Mesh && !(obj.layers.mask & (1 << BLOOM_LAYER))) {
        this.#materialCache.set(obj.uuid, obj.material);
        const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
        const isOverlay = obj.layers.mask & (1 << OVERLAY_LAYER);
        obj.material = mat?.transparent && !isOverlay ? this.#darkTransparentMaterial : this.#darkMaterial;
        darkened.push(obj);
      }
    });
    const savedBackground = this.#scene.background;
    this.#scene.background = null;
    this.#bloomComposer.render();
    this.#scene.background = savedBackground;

    // Restore materials from collected refs (no second traverse)
    for (const mesh of darkened) {
      const saved = this.#materialCache.get(mesh.uuid);
      if (saved !== undefined) {
        mesh.material = saved as Material;
        this.#materialCache.delete(mesh.uuid);
      }
    }

    // Final pass: normal materials, mixes in bloom texture
    this.#finalComposer.render();
  }

  public dispose() {
    // Dispose render targets owned by each composer
    this.#bloomComposer.renderTarget1.dispose();
    this.#bloomComposer.renderTarget2.dispose();
    this.#finalComposer.renderTarget1.dispose();
    this.#finalComposer.renderTarget2.dispose();

    // Dispose passes (frees internal shaders / render targets)
    for (const pass of this.#bloomComposer.passes) pass.dispose();
    for (const pass of this.#finalComposer.passes) pass.dispose();

    this.#darkMaterial.dispose();
    this.#darkTransparentMaterial.dispose();
    this.#materialCache.clear();

    this.#renderer.dispose();
  }
}
