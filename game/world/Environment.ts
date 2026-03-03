import type { CubeTexture, Scene } from 'three';
import { AmbientLight, Color, DirectionalLight, Mesh, MeshStandardMaterial } from 'three';

import { BACKGROUND_COLOR } from '../constants';
import type { LevelInfo } from '../levels';
import { Debug } from '../util/Debug';

type EnvironmentMap = {
  intensity: number;
  texture: CubeTexture | null;
};

export class Environment {
  #scene: Scene;
  #levelInfo: LevelInfo;
  #ambientLight: AmbientLight | null = null;
  #sunLight: DirectionalLight | null = null;
  #counterSunLight: DirectionalLight | null = null;
  #environmentMap: EnvironmentMap = {
    intensity: 0.4,
    texture: null,
  };

  constructor(scene: Scene, levelInfo: LevelInfo) {
    this.#scene = scene;
    this.#levelInfo = levelInfo;

    this.setupLights();
    this.setupEnvironment();
    this.setupDebug();
  }

  private setupLights() {
    this.#ambientLight = new AmbientLight('#ffffff', 1.6);
    this.#scene.add(this.#ambientLight);

    this.#sunLight = new DirectionalLight('#ffffff', 1);
    this.#sunLight.castShadow = true;
    this.#sunLight.shadow.camera.far = 50;
    this.#sunLight.shadow.mapSize.set(1024, 1024);
    this.#sunLight.shadow.normalBias = 0.05;
    this.#sunLight.shadow.camera.top = -20;
    this.#sunLight.shadow.camera.bottom = 20;
    this.#sunLight.shadow.camera.left = -20;
    this.#sunLight.shadow.camera.right = 20;

    const { width, depth, center } = this.#levelInfo;

    this.#sunLight.position.set(width * 0.6, 16, depth * 0.15);
    this.#sunLight.target.position.set(center.x, 0, center.z);

    this.#scene.add(this.#sunLight);
    this.#scene.add(this.#sunLight.target);

    this.#counterSunLight = new DirectionalLight('#ffffff', 1);
    this.#counterSunLight.castShadow = false;

    this.#counterSunLight.position.set(width * 0.4, 16, depth * 0.85);
    this.#counterSunLight.target.position.set(center.x, 0, center.z);

    this.#scene.add(this.#counterSunLight);
    this.#scene.add(this.#counterSunLight.target);
  }

  private setupEnvironment() {
    this.#scene.background = new Color(BACKGROUND_COLOR);

    // this.#environmentMap.intensity = 0.4;
    // this.#environmentMap.texture = this.#resources.assets.environmentMapTexture as CubeTexture;
    // this.#environmentMap.texture.colorSpace = SRGBColorSpace;
    // this.#scene.environment = this.#environmentMap.texture;
    // this.updateMeshesMaterial();
  }

  private setupDebug() {
    const debug = Debug.getInstance();
    if (!debug.active) return;

    const lightsFolder = debug.gui.addFolder('Lights');

    const ambientFolder = lightsFolder.addFolder('Ambient');
    const ambientParams = { color: '#ffffff' };
    ambientFolder
      .addColor(ambientParams, 'color')
      .name('Color')
      .onChange((value: string) => {
        this.#ambientLight!.color.set(value);
        debug.save();
      });
    ambientFolder
      .add(this.#ambientLight!, 'intensity', 0, 10, 0.01)
      .name('Intensity')
      .onChange(() => debug.save());

    const sunFolder = lightsFolder.addFolder('Sun');
    const sunParams = { color: '#ffffff' };
    sunFolder
      .addColor(sunParams, 'color')
      .name('Color')
      .onChange((value: string) => {
        this.#sunLight!.color.set(value);
        debug.save();
      });
    sunFolder
      .add(this.#sunLight!, 'intensity', 0, 10, 0.01)
      .name('Intensity')
      .onChange(() => debug.save());

    const counterSunFolder = lightsFolder.addFolder('Counter Sun');
    const counterSunParams = { color: '#ffffff' };
    counterSunFolder
      .addColor(counterSunParams, 'color')
      .name('Color')
      .onChange((value: string) => {
        this.#counterSunLight!.color.set(value);
        debug.save();
      });
    counterSunFolder
      .add(this.#counterSunLight!, 'intensity', 0, 10, 0.01)
      .name('Intensity')
      .onChange(() => debug.save());
  }

  public updateMeshesMaterial() {
    this.#scene.traverse((child) => {
      if (child instanceof Mesh && child.material instanceof MeshStandardMaterial) {
        child.material.envMap = this.#environmentMap.texture;
        child.material.envMapIntensity = this.#environmentMap.intensity;
        child.material.needsUpdate = true;
      }
    });
  }
}
