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
  #sunLight: DirectionalLight | null = null;
  #counterSunLight: DirectionalLight | null = null;
  #environmentMap: EnvironmentMap = {
    intensity: 0.4,
    texture: null,
  };

  #debug: Debug;
  #debugProperties = {
    DisplayAxesHelper: true,
    DisplayGridHelper: false,
    DisplayLightsHelpers: true,
  };

  constructor(scene: Scene, levelInfo: LevelInfo) {
    this.#scene = scene;
    this.#levelInfo = levelInfo;
    this.#debug = Debug.getInstance();

    this.setupLights();
    this.setupEnvironment();
    this.setupHelpers();
  }

  private setupLights() {
    const ambientLight = new AmbientLight('#ffffff', 1.5);
    this.#scene.add(ambientLight);

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

    this.#sunLight.position.set(width, 16, 0);
    this.#sunLight.target.position.set(center.x, 0, center.z);

    this.#scene.add(this.#sunLight);
    this.#scene.add(this.#sunLight.target);

    this.#counterSunLight = new DirectionalLight('#ffffff', 0.8);
    this.#counterSunLight.castShadow = false;

    this.#counterSunLight.position.set(0, 14, depth);
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

  public updateMeshesMaterial() {
    this.#scene.traverse((child) => {
      if (child instanceof Mesh && child.material instanceof MeshStandardMaterial) {
        child.material.envMap = this.#environmentMap.texture;
        child.material.envMapIntensity = this.#environmentMap.intensity;
        child.material.needsUpdate = true;
      }
    });
  }

  private async setupHelpers() {
    if (this.#debug.active) {
      const folderName = 'Environment';
      const guiFolder = this.#debug.gui.addFolder(folderName);

      this.#debugProperties = {
        ...this.#debugProperties,
        ...this.#debug.configFromLocaleStorage?.folders?.[folderName]?.controllers,
      };

      const { AxesHelper, GridHelper } = await import('three');
      const axesHelper = new AxesHelper(5);
      axesHelper.visible = this.#debugProperties.DisplayAxesHelper;
      this.#scene.add(axesHelper);

      guiFolder.add(this.#debugProperties, 'DisplayAxesHelper').onChange((value: boolean) => {
        axesHelper.visible = value;
        this.#debug.save();
      });

      const gridHelper = new GridHelper(100, 100);
      gridHelper.visible = this.#debugProperties.DisplayGridHelper;
      this.#scene.add(gridHelper);

      guiFolder.add(this.#debugProperties, 'DisplayGridHelper').onChange((value: boolean) => {
        gridHelper.visible = value;
        this.#debug.save();
      });

      if (this.#sunLight) {
        const { DirectionalLightHelper } = await import('three');
        const directionalLightHelper = new DirectionalLightHelper(this.#sunLight, 5, 'red');
        directionalLightHelper.visible = this.#debugProperties.DisplayLightsHelpers;
        this.#scene.add(directionalLightHelper);

        guiFolder.add(this.#debugProperties, 'DisplayLightsHelpers').onChange((value: boolean) => {
          directionalLightHelper.visible = value;
          this.#debug.save();
        });
      }
    }
  }
}
