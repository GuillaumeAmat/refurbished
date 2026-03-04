import type { CubeTexture, Scene } from 'three';
import { AmbientLight, Color, DirectionalLight, Mesh, MeshStandardMaterial } from 'three';

import { BACKGROUND_COLOR, LIGHT_COLOR } from '../constants';
import type { LevelInfo } from '../levels';
import { Debug } from '../util/Debug';
import { DeliveryZone } from './object/DeliveryZone';
import { NeonWall } from './object/NeonWall';
import { Poster } from './object/Poster';
import { RepairZone } from './object/RepairZone';

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

    const lightColorParams = { color: LIGHT_COLOR };
    lightsFolder
      .addColor(lightColorParams, 'color')
      .name('LIGHT_COLOR')
      .onChange((value: string) => {
        this.#ambientLight!.color.set(value);
        this.#sunLight!.color.set(value);
        this.#counterSunLight!.color.set(value);
        this.#frontSunLight!.color.set(value);
        for (const light of Poster.lights) light.color.set(value);
        for (const light of DeliveryZone.lights) light.color.set(value);
        for (const light of RepairZone.lights) light.color.set(value);
        debug.save();
      });

    const addIntensityFolder = (name: string, initial: number, setter: (v: number) => void) => {
      const folder = lightsFolder.addFolder(name);
      const state = { intensity: initial };
      const ctrl = folder
        .add(state, 'intensity')
        .name('Intensity')
        .step(0.1)
        .onChange((v: number) => { setter(v); debug.save(); });
      const actions = {
        inc: () => {
          state.intensity = Math.round((state.intensity + 0.1) * 10) / 10;
          ctrl.updateDisplay();
          setter(state.intensity);
          debug.save();
        },
        dec: () => {
          state.intensity = Math.round((state.intensity - 0.1) * 10) / 10;
          ctrl.updateDisplay();
          setter(state.intensity);
          debug.save();
        },
      };
      folder.add(actions, 'inc').name('+');
      folder.add(actions, 'dec').name('-');
    };

    addIntensityFolder('Ambient', 1, (v) => { this.#ambientLight!.intensity = v; });
    addIntensityFolder('Sun', 1, (v) => { this.#sunLight!.intensity = v; });
    addIntensityFolder('Counter Sun', 1, (v) => { this.#counterSunLight!.intensity = v; });
    addIntensityFolder('Front Sun', 0.5, (v) => { this.#frontSunLight!.intensity = v; });
    addIntensityFolder('Poster Lights', 10, (v) => { for (const light of Poster.lights) light.intensity = v; });
    addIntensityFolder('Delivery Zone', 6, (v) => { for (const light of DeliveryZone.lights) light.intensity = v; });
    addIntensityFolder('Repair Zone', 5, (v) => { for (const light of RepairZone.lights) light.intensity = v; });
    addIntensityFolder('Neon', 1, (v) => { for (const light of NeonWall.lights) light.intensity = v; });
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
