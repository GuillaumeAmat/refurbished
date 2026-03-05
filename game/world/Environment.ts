import type { CubeTexture, Scene } from 'three';
import { AmbientLight, CameraHelper, Color, Mesh, MeshStandardMaterial, SpotLight } from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

import { BACKGROUND_COLOR, LIGHT_COLOR } from '../constants';
import type { LevelInfo } from '../levels';
import { Debug } from '../util/Debug';
import { DeliveryZone } from './object/DeliveryZone';
import { NeonWall } from './object/NeonWall';
import { RepairZone } from './object/RepairZone';
import { WallLight } from './object/WallLight';

type EnvironmentMap = {
  intensity: number;
  texture: CubeTexture | null;
};

export class Environment {
  #scene: Scene;
  #levelInfo: LevelInfo;
  #ambientLight: AmbientLight | null = null;
  #quadLights: SpotLight[] = [];
  #shadowHelpers: CameraHelper[] = [];
  #environmentMap: EnvironmentMap = {
    intensity: 0.4,
    texture: null,
  };

  constructor(scene: Scene, levelInfo: LevelInfo) {
    this.#scene = scene;
    this.#levelInfo = levelInfo;

    RectAreaLightUniformsLib.init();
    this.setupLights();
    this.setupEnvironment();
    this.setupDebug();
  }

  private setupLights() {
    this.#ambientLight = new AmbientLight(LIGHT_COLOR, 1.1);
    this.#scene.add(this.#ambientLight);

    const { center } = this.#levelInfo;
    const qx = center.x / 2;
    const qz = center.z / 2;

    const quadrants = [
      { x: center.x - qx, z: center.z - qz },
      { x: center.x + qx, z: center.z - qz },
      { x: center.x - qx, z: center.z + qz },
      { x: center.x + qx, z: center.z + qz },
    ];

    for (let i = 0; i < quadrants.length; i++) {
      const q = quadrants[i];
      const castShadow = i === 1 || i === 2; // diagonal: back-right + front-left
      const light = new SpotLight(castShadow ? '#fbf8e5' : LIGHT_COLOR, 77, 35, 1.07, 0.05, 1.6);
      light.castShadow = castShadow;
      if (castShadow) {
        light.shadow.mapSize.set(1024, 1024);
        light.shadow.normalBias = 0.05;
        light.shadow.camera.near = 1;
        light.shadow.camera.far = 40;
      }
      light.position.set(q.x, 14, q.z);
      light.target.position.set(q.x, 0, q.z);
      this.#quadLights.push(light);
      this.#scene.add(light);
      this.#scene.add(light.target);

      if (castShadow) {
        const helper = new CameraHelper(light.shadow.camera);
        helper.visible = false;
        this.#shadowHelpers.push(helper);
        this.#scene.add(helper);
      }
    }
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
        for (const light of this.#quadLights) light.color.set(value);
        for (const light of WallLight.lights) light.color.set(value);
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
        .onChange((v: number) => {
          setter(v);
          debug.save();
        });
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

    addIntensityFolder('Ambient', 1.1, (v) => {
      this.#ambientLight!.intensity = v;
    });

    const quadFolder = lightsFolder.addFolder('Quad Lights');
    const ref = this.#quadLights[0]!;
    const quadState = {
      intensity: ref.intensity,
      height: ref.position.y,
      decay: ref.decay,
      distance: ref.distance,
      angle: ref.angle,
      penumbra: ref.penumbra,
      castShadow: ref.castShadow,
    };
    quadFolder
      .add(quadState, 'intensity', 0, 200, 1)
      .name('Intensity')
      .onChange((v: number) => { for (const l of this.#quadLights) l.intensity = v; debug.save(); });
    quadFolder
      .add(quadState, 'height', 1, 50, 0.5)
      .name('Height')
      .onChange((v: number) => { for (const l of this.#quadLights) l.position.y = v; debug.save(); });
    quadFolder
      .add(quadState, 'decay', 0, 5, 0.1)
      .name('Decay')
      .onChange((v: number) => { for (const l of this.#quadLights) l.decay = v; debug.save(); });
    quadFolder
      .add(quadState, 'distance', 0, 200, 1)
      .name('Distance')
      .onChange((v: number) => { for (const l of this.#quadLights) l.distance = v; debug.save(); });
    quadFolder
      .add(quadState, 'angle', 0.1, Math.PI / 2, 0.01)
      .name('Angle')
      .onChange((v: number) => { for (const l of this.#quadLights) l.angle = v; debug.save(); });
    quadFolder
      .add(quadState, 'penumbra', 0, 1, 0.05)
      .name('Penumbra')
      .onChange((v: number) => { for (const l of this.#quadLights) l.penumbra = v; debug.save(); });
    quadFolder
      .add(quadState, 'castShadow')
      .name('Cast Shadow')
      .onChange((v: boolean) => { for (const l of this.#quadLights) l.castShadow = v; debug.save(); });
    addIntensityFolder('Delivery Zone', 6, (v) => {
      for (const light of DeliveryZone.lights) light.intensity = v;
    });
    addIntensityFolder('Repair Zone', 5, (v) => {
      for (const light of RepairZone.lights) light.intensity = v;
    });
    addIntensityFolder('Neon Emissive', 2.0, (v) => {
      NeonWall.setEmissiveIntensity(v);
    });
    addIntensityFolder('Neon Lights', 1, (v) => {
      for (const light of NeonWall.lights) light.intensity = v;
    });

    const shadowHelperState = { visible: false };
    lightsFolder
      .add(shadowHelperState, 'visible')
      .name('Shadow Helpers')
      .onChange((v: boolean) => {
        for (const helper of this.#shadowHelpers) helper.visible = v;
        debug.save();
      });

    const neonHelperState = { visible: false };
    lightsFolder
      .add(neonHelperState, 'visible')
      .name('Neon Helpers')
      .onChange((v: boolean) => {
        for (const helper of NeonWall.helpers) helper.visible = v;
        debug.save();
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
