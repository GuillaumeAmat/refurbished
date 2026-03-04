import type { CubeTexture, Scene } from 'three';
import { AmbientLight, Color, DirectionalLight, Mesh, MeshStandardMaterial } from 'three';

import { BACKGROUND_COLOR, LIGHT_COLOR } from '../constants';
import type { LevelInfo } from '../levels';
import { Debug } from '../util/Debug';
import { NeonWall } from './object/NeonWall';
import { Poster } from './object/Poster';

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
  #frontSunLight: DirectionalLight | null = null;
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
    this.#ambientLight = new AmbientLight(LIGHT_COLOR, 1);
    this.#scene.add(this.#ambientLight);

    this.#sunLight = new DirectionalLight(LIGHT_COLOR, 1);
    this.#sunLight.castShadow = true;
    this.#sunLight.shadow.camera.far = 50;
    this.#sunLight.shadow.mapSize.set(1024, 1024);
    this.#sunLight.shadow.normalBias = 0.05;
    this.#sunLight.shadow.camera.top = -20;
    this.#sunLight.shadow.camera.bottom = 20;
    this.#sunLight.shadow.camera.left = -20;
    this.#sunLight.shadow.camera.right = 20;

    const { width, depth, center } = this.#levelInfo;

    this.#sunLight.position.set(width * 0.6, 16, depth * 0.3);
    this.#sunLight.target.position.set(center.x, 0, center.z);

    this.#scene.add(this.#sunLight);
    this.#scene.add(this.#sunLight.target);

    this.#counterSunLight = new DirectionalLight(LIGHT_COLOR, 1);
    this.#counterSunLight.castShadow = false;

    this.#counterSunLight.position.set(width * 0.4, 16, depth * 0.85);
    this.#counterSunLight.target.position.set(center.x, 0, center.z);

    this.#scene.add(this.#counterSunLight);
    this.#scene.add(this.#counterSunLight.target);

    this.#frontSunLight = new DirectionalLight(LIGHT_COLOR, 0.5);
    this.#frontSunLight.castShadow = false;

    this.#frontSunLight.position.set(center.x, 3, depth);
    this.#frontSunLight.target.position.set(center.x, 0, center.z);

    this.#scene.add(this.#frontSunLight);
    this.#scene.add(this.#frontSunLight.target);
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

    const posterLightsFolder = lightsFolder.addFolder('Poster Lights');
    const posterLightsParams = {
      color: LIGHT_COLOR,
      intensity: 5,
      distance: 4,
      angle: Math.PI / 5,
      penumbra: 0,
      decay: 0,
    };
    const updatePosterHelpers = () => {
      for (const helper of Poster.helpers) helper.update();
    };
    posterLightsFolder
      .addColor(posterLightsParams, 'color')
      .name('Color')
      .onChange((value: string) => {
        for (const light of Poster.lights) light.color.set(value);
        updatePosterHelpers();
        debug.save();
      });
    posterLightsFolder
      .add(posterLightsParams, 'intensity', 0, 20, 0.1)
      .name('Intensity')
      .onChange((value: number) => {
        for (const light of Poster.lights) light.intensity = value;
        updatePosterHelpers();
        debug.save();
      });
    posterLightsFolder
      .add(posterLightsParams, 'distance', 0, 20, 0.1)
      .name('Distance')
      .onChange((value: number) => {
        for (const light of Poster.lights) light.distance = value;
        updatePosterHelpers();
        debug.save();
      });
    posterLightsFolder
      .add(posterLightsParams, 'angle', 0, Math.PI / 2, 0.01)
      .name('Angle')
      .onChange((value: number) => {
        for (const light of Poster.lights) light.angle = value;
        updatePosterHelpers();
        debug.save();
      });
    posterLightsFolder
      .add(posterLightsParams, 'penumbra', 0, 1, 0.01)
      .name('Penumbra')
      .onChange((value: number) => {
        for (const light of Poster.lights) light.penumbra = value;
        updatePosterHelpers();
        debug.save();
      });
    posterLightsFolder
      .add(posterLightsParams, 'decay', 0, 5, 0.1)
      .name('Decay')
      .onChange((value: number) => {
        for (const light of Poster.lights) light.decay = value;
        updatePosterHelpers();
        debug.save();
      });

    const neonFolder = lightsFolder.addFolder('Neon');
    const neonParams = { intensity: 1 };
    neonFolder
      .add(neonParams, 'intensity', 0, 20, 0.1)
      .name('Intensity')
      .onChange((value: number) => {
        for (const light of NeonWall.lights) {
          light.intensity = value;
        }
      });
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
