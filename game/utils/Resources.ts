import { type CubeTexture, type CubeTextureLoader, EventDispatcher, type Texture, type TextureLoader } from 'three';
import type { Font, FontLoader } from 'three/addons/loaders/FontLoader.js';
import type { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { SVGLoader, SVGResult } from 'three/examples/jsm/loaders/SVGLoader.js';

type AssetName = string;
type Asset =
  | {
      type: 'audio' | 'font' | 'gltf' | 'svg' | 'texture';
      path: string;
      priority: 'low' | 'high';
    }
  | {
      type: 'cubeTexture';
      path: string[];
      priority: 'low' | 'high';
    };

type Assets = Record<AssetName, HTMLAudioElement | Font | GLTF | SVGResult | Texture | CubeTexture>;
type AssetsToLoad = Record<AssetName, Asset>;

type LoadedEvent = {
  type: 'loaded';
  name: AssetName;
};

type ReadyEvent = {
  type: 'ready';
};

type DoneEvent = {
  type: 'done';
};

type ResourcesEvents = {
  loaded: LoadedEvent;
  ready: ReadyEvent;
  done: DoneEvent;
};

export class Resources extends EventDispatcher<ResourcesEvents> {
  static #instance: Resources;

  #assets: Assets = {};
  #assetsToLoad: AssetsToLoad = {};

  #fontLoader: FontLoader | null = null;
  #gltfLoader: GLTFLoader | null = null;
  #svgLoader: SVGLoader | null = null;
  #textureLoader: TextureLoader | null = null;
  #cubeTextureLoader: CubeTextureLoader | null = null;

  // The high priority assets are loaded
  #isReady = false;

  // All the assets are loaded
  #isDone = false;

  /**
   * All loaded assets.
   */
  get assets() {
    return this.#assets;
  }

  /**
   * Indicates whether all high priority assets have been loaded.
   */
  get isReady() {
    return this.#isReady;
  }

  /**
   * Indicates whether all assets have been loaded.
   */
  get isDone() {
    return this.#isDone;
  }

  constructor(assets: AssetsToLoad) {
    super();

    Resources.#instance = this;

    this.#assetsToLoad = assets;
  }

  static getInstance() {
    return Resources.#instance;
  }

  public async load() {
    const assetsToLoad = Object.values(this.#assetsToLoad).sort((a, b) => {
      if (a.priority === b.priority) {
        return 0;
      }

      return a.priority === 'high' ? -1 : 1;
    });

    const hasFonts = assetsToLoad.some((asset) => asset.type === 'font');
    const hasGLTF = assetsToLoad.some((asset) => asset.type === 'gltf');
    const hasSVGs = assetsToLoad.some((asset) => asset.type === 'svg');
    const hasTextures = assetsToLoad.some((asset) => asset.type === 'texture');
    const hasCubeTextures = assetsToLoad.some((asset) => asset.type === 'cubeTexture');

    if (hasFonts && !this.#fontLoader) {
      const { FontLoader } = await import('three/addons/loaders/FontLoader.js');
      this.#fontLoader = new FontLoader();
    }

    if (hasGLTF && !this.#gltfLoader) {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js');

      this.#gltfLoader = new GLTFLoader();

      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('/game/libs/draco/');

      this.#gltfLoader.setDRACOLoader(dracoLoader);
    }

    if (hasSVGs && !this.#svgLoader) {
      const { SVGLoader } = await import('three/examples/jsm/loaders/SVGLoader.js');
      this.#svgLoader = new SVGLoader();
    }

    if (hasTextures && !this.#textureLoader) {
      const { TextureLoader } = await import('three');
      this.#textureLoader = new TextureLoader();
    }

    if (hasCubeTextures && !this.#cubeTextureLoader) {
      const { CubeTextureLoader } = await import('three');
      this.#cubeTextureLoader = new CubeTextureLoader();
    }

    Object.entries(this.#assetsToLoad).forEach(([assetName, asset]) => {
      if (asset.type === 'audio') {
        this.onAssetLoaded(assetName, new Audio(asset.path));
      } else if (asset.type === 'font') {
        this.#fontLoader?.load(asset.path, (file) => {
          this.onAssetLoaded(assetName, file);
        });
      } else if (asset.type === 'gltf') {
        this.#gltfLoader?.load(asset.path, (file) => {
          this.onAssetLoaded(assetName, file);
        });
      } else if (asset.type === 'svg') {
        this.#svgLoader?.load(asset.path, (file) => {
          this.onAssetLoaded(assetName, file);
        });
      } else if (asset.type === 'texture') {
        this.#textureLoader?.load(asset.path, (file) => {
          this.onAssetLoaded(assetName, file);
        });
      } else if (asset.type === 'cubeTexture') {
        this.#cubeTextureLoader?.load(asset.path, (file) => {
          this.onAssetLoaded(assetName, file);
        });
      }
    });
  }

  private onAssetLoaded(name: AssetName, file: HTMLAudioElement | Font | GLTF | SVGResult | Texture | CubeTexture) {
    this.#assets[name] = file;

    this.dispatchEvent({ type: 'loaded', name });

    const loadedAssetsCount = Object.keys(this.#assets).length;
    const assetsToLoadCount = Object.keys(this.#assetsToLoad).length;

    if (!this.#isReady) {
      const areHighPriorityAssetsLoaded = Object.entries(this.#assetsToLoad)
        .filter(([, asset]) => asset.priority === 'high')
        .every(([assetName]) => Object.hasOwn(this.#assets, assetName));

      if (areHighPriorityAssetsLoaded) {
        this.#isReady = true;

        setTimeout(() => {
          this.dispatchEvent({ type: 'ready' });
        }, 0);
      }
    }

    if (loadedAssetsCount === assetsToLoadCount) {
      this.#isDone = true;

      setTimeout(() => {
        this.dispatchEvent({ type: 'done' });
      }, 0);
    }
  }

  public getAudioAsset(name: string) {
    if (!Object.hasOwn(this.#assets, name)) return null;
    return this.#assets[name] as HTMLAudioElement;
  }

  public getFontAsset(name: string) {
    if (!Object.hasOwn(this.#assets, name)) return null;
    return this.#assets[name] as Font;
  }

  public getGLTFAsset(name: string) {
    if (!Object.hasOwn(this.#assets, name)) return null;
    return this.#assets[name] as GLTF;
  }

  public getSVGAsset(name: string) {
    if (!Object.hasOwn(this.#assets, name)) return null;
    return this.#assets[name] as SVGResult;
  }

  public getTextureAsset(name: string) {
    if (!Object.hasOwn(this.#assets, name)) return null;
    return this.#assets[name] as Texture;
  }

  public getCubeTextureAsset(name: string) {
    if (!Object.hasOwn(this.#assets, name)) return null;
    return this.#assets[name] as CubeTexture;
  }
}
