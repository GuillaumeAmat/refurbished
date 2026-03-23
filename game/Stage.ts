import { Color, Scene } from 'three';

import { BACKGROUND_COLOR, OVERLAY_LAYER } from './constants';
import { type Actor, type AnyActorLogic, type Subscription, createActor, fromPromise } from 'xstate';

import { navigateTo, useRuntimeConfig } from '#app';

import { levelsInfo } from './levels';
import { LoadingOverlay } from './LoadingOverlay';
import { CharacterSelectScreen } from './screen/CharacterSelectScreen';
import { LeaderboardScreen } from './screen/LeaderboardScreen';
import { LevelScreen } from './screen/LevelScreen';
import { LoadingScreen } from './screen/LoadingScreen';
import { MenuScreen } from './screen/MenuScreen';
import { PauseScreen } from './screen/PauseScreen';
import { SavingScoreScreen } from './screen/SavingScoreScreen';
import { ScoreScreen } from './screen/ScoreScreen';
import { StartScreen } from './screen/StartScreen';
import { TutorialScreen } from './screen/TutorialScreen';
import { stageMachine } from './Stage.machine';
import { SessionManager } from './state/SessionManager';
import { Debug } from './util/Debug';
import { GamepadManager } from './util/input/GamepadManager';
import { Physics } from './util/Physics';
import { Renderer } from './util/Renderer';
import { Resources } from './util/Resources';
import { Sizes } from './util/Sizes';
import { SoundManager } from './util/SoundManager';
import { Time } from './util/Time';
import { Camera } from './world/Camera';
import { Environment } from './world/Environment';

interface Disposable {
  dispose(): void;
}

export class Stage {
  #actor: Actor<AnyActorLogic>;
  #scene: Scene;
  #camera: Camera;
  #resources: Resources;
  #time: Time;
  #sizes: Sizes;
  #renderer: Renderer;
  #pauseBgColor = new Color(0xffffff);
  #defaultBgColor = new Color(BACKGROUND_COLOR);
  #loadingOverlay: LoadingOverlay;
  #environment: Environment | null = null;
  #levelInfo = levelsInfo[0]!;

  // Screens (created lazily via setupScreens, disposed in dispose)
  #screens: Disposable[] = [];
  #audioSubscription: Subscription | null = null;

  // Bound listener references for cleanup
  #onResize: () => void;
  #onMuteKey: (e: KeyboardEvent) => void;
  #onKonamiKey: (e: KeyboardEvent) => void;
  #onTickCore: () => void = () => {};
  #onTickLoadingScreen: () => void = () => {};
  #onTickScreens: () => void = () => {};
  #konamiIndex: number = 0;
  #konamiGamepadIndex: number = 0;
  #konamiPrevMovement: Array<{ x: number; z: number }> = [{ x: 0, z: 0 }, { x: 0, z: 0 }];

  constructor(canvas: HTMLCanvasElement) {
    if (!window) {
      throw new Error('"Stage" can only be instanciated in a browser environment.');
    }

    new Debug();

    this.#scene = new Scene();
    this.#camera = new Camera(this.#scene, canvas, this.#levelInfo);
    this.#renderer = new Renderer(this.#scene, canvas, this.#camera);
    this.#loadingOverlay = new LoadingOverlay(this.#scene);

    this.#sizes = new Sizes();
    this.#onResize = () => {
      window.requestAnimationFrame(() => {
        this.#camera.setSizesAndRatio();

        /**
         * Must be called after the camera has been resized,
         * as it updates the renderer's size and pixel ratio.
         * Also, it would take into account a re-positionning of the camera.
         */
        this.#renderer.setSizesAndRatio();
      });
    };
    this.#sizes.addEventListener('resize', this.#onResize);

    this.#resources = new Resources({
      // High priorities, `ready` event will be emitted when loaded
      interFont: {
        type: 'font',
        path: 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
        priority: 'high',
      },
      bmDupletDSP: {
        type: 'webFont',
        path: '/game/font/BMDupletDSP-Semibold.woff2',
        family: 'BMDupletDSP',
        weight: 600,
        priority: 'high',
      },
      ivarSoft: {
        type: 'webFont',
        path: '/game/font/IvarSoft-SemiBold.woff2',
        family: 'IvarSoft',
        weight: 600,
        priority: 'high',
      },
      bmDupletTXT: {
        type: 'webFont',
        path: '/game/font/BMDupletTXT-Regular.woff2',
        family: 'BMDupletTXT',
        weight: 400,
        priority: 'high',
      },
      bmDupletTXTSemibold: {
        type: 'webFont',
        path: '/game/font/BMDupletTXT-Semibold.woff2',
        family: 'BMDupletTXT',
        weight: 600,
        priority: 'high',
      },
      bmDupletTXTItalic: {
        type: 'webFont',
        path: '/game/font/BMDupletTXT-Italic.woff2',
        family: 'BMDupletTXT',
        weight: 400,
        style: 'italic',
        priority: 'high',
      },
      ivarSoftItalic: {
        type: 'webFont',
        path: '/game/font/IvarSoft-SemiBoldItalic.woff2',
        family: 'IvarSoft',
        weight: 600,
        style: 'italic',
        priority: 'high',
      },
      robotoMono: {
        type: 'webFont',
        path: '/game/font/RobotoMono-Regular.woff2',
        family: 'RobotoMono',
        weight: 400,
        priority: 'high',
      },
      robotoMonoBold: {
        type: 'webFont',
        path: '/game/font/RobotoMono-Bold.woff2',
        family: 'RobotoMono',
        weight: 700,
        priority: 'high',
      },

      // Low priorities, `done` event will be emitted when loaded
      pigModel: {
        type: 'gltf',
        path: '/game/model/characters/pig.glb',
        priority: 'low',
      },
      crocoModel: {
        type: 'gltf',
        path: '/game/model/characters/croco.glb',
        priority: 'low',
      },
      workbenchModel: {
        type: 'gltf',
        path: '/game/model/environment/workbench.glb',
        priority: 'low',
      },
      wallModel: {
        type: 'gltf',
        path: '/game/model/environment/wall.glb',
        priority: 'low',
      },
      wallTopRegularModel: {
        type: 'gltf',
        path: '/game/model/environment/wall_top_regular.glb',
        priority: 'low',
      },
      neonWallModel: {
        type: 'gltf',
        path: '/game/model/environment/neon_wall.glb',
        priority: 'low',
      },
      neonWallBlueModel: {
        type: 'gltf',
        path: '/game/model/environment/neon_wall_blue.glb',
        priority: 'low',
      },
      blueWorkZoneModel: {
        type: 'gltf',
        path: '/game/model/environment/blue_work_zone.glb',
        priority: 'low',
      },
      repairZoneModel: {
        type: 'gltf',
        path: '/game/model/environment/repair_zone.glb',
        priority: 'low',
      },
      screwdriverModel: {
        type: 'gltf',
        path: '/game/model/environment/screwdriver.glb',
        priority: 'low',
      },
      deliveryZoneModel: {
        type: 'gltf',
        path: '/game/model/environment/delivery_zone.glb',
        priority: 'low',
      },
      crateModel: {
        type: 'gltf',
        path: '/game/model/environment/crate.glb',
        priority: 'low',
      },
      batteryEmptyModel: {
        type: 'gltf',
        path: '/game/model/resource/battery_empty.glb',
        priority: 'low',
      },
      batteryFullModel: {
        type: 'gltf',
        path: '/game/model/resource/battery_full.glb',
        priority: 'low',
      },
      frameBrokenModel: {
        type: 'gltf',
        path: '/game/model/resource/frame_broken.glb',
        priority: 'low',
      },
      frameRepairedModel: {
        type: 'gltf',
        path: '/game/model/resource/frame_repaired.glb',
        priority: 'low',
      },
      screenBrokenModel: {
        type: 'gltf',
        path: '/game/model/resource/screen_broken.glb',
        priority: 'low',
      },
      screenRepairedModel: {
        type: 'gltf',
        path: '/game/model/resource/screen_repaired.glb',
        priority: 'low',
      },
      groundModel: {
        type: 'gltf',
        path: '/game/model/environment/ground.glb',
        priority: 'low',
      },
      phoneAssembledModel: {
        type: 'gltf',
        path: '/game/model/resource/phone_assembled.glb',
        priority: 'low',
      },
      packageOpenModel: {
        type: 'gltf',
        path: '/game/model/resource/package_open.glb',
        priority: 'low',
      },
      packageClosedModel: {
        type: 'gltf',
        path: '/game/model/resource/package_closed.glb',
        priority: 'low',
      },
      frameBrokenIcon: {
        type: 'texture',
        path: '/game/texture/frame_broken_icon.png',
        priority: 'low',
      },
      frameRepairedIcon: {
        type: 'texture',
        path: '/game/texture/frame_repaired_icon.png',
        priority: 'low',
      },
      batteryEmptyIcon: {
        type: 'texture',
        path: '/game/texture/battery_empty_icon.png',
        priority: 'low',
      },
      batteryFilledIcon: {
        type: 'texture',
        path: '/game/texture/battery_filled_icon.png',
        priority: 'low',
      },
      screenBrokenIcon: {
        type: 'texture',
        path: '/game/texture/screen_broken_icon.png',
        priority: 'low',
      },
      screenRepairedIcon: {
        type: 'texture',
        path: '/game/texture/screen_repaired_icon.png',
        priority: 'low',
      },
      phoneIcon: {
        type: 'texture',
        path: '/game/texture/phone_icon.png',
        priority: 'low',
      },
      alphaIcon: {
        type: 'texture',
        path: '/game/texture/alpha_icon.png',
        priority: 'low',
      },
      packageOpenIcon: {
        type: 'texture',
        path: '/game/texture/package_open_icon.png',
        priority: 'low',
      },
      packageClosedIcon: {
        type: 'texture',
        path: '/game/texture/package_closed_icon.png',
        priority: 'low',
      },
      plusIcon: {
        type: 'texture',
        path: '/game/texture/plus_icon.png',
        priority: 'low',
      },
      poster1: {
        type: 'texture',
        path: '/game/texture/poster_1.webp',
        priority: 'low',
      },
      poster2: {
        type: 'texture',
        path: '/game/texture/poster_2.webp',
        priority: 'low',
      },
      poster3: {
        type: 'texture',
        path: '/game/texture/poster_3.webp',
        priority: 'low',
      },
      poster4: {
        type: 'texture',
        path: '/game/texture/poster_4.webp',
        priority: 'low',
      },
      poster5: {
        type: 'texture',
        path: '/game/texture/poster_5.webp',
        priority: 'low',
      },
      poster6: {
        type: 'texture',
        path: '/game/texture/poster_6.webp',
        priority: 'low',
      },
      poster7: {
        type: 'texture',
        path: '/game/texture/poster_7.webp',
        priority: 'low',
      },
      poster8: {
        type: 'texture',
        path: '/game/texture/poster_8.webp',
        priority: 'low',
      },
      poster9: {
        type: 'texture',
        path: '/game/texture/poster_9.webp',
        priority: 'low',
      },
      poster10: {
        type: 'texture',
        path: '/game/texture/poster_10.webp',
        priority: 'low',
      },
      poster11: {
        type: 'texture',
        path: '/game/texture/poster_11.webp',
        priority: 'low',
      },
      poster12: {
        type: 'texture',
        path: '/game/texture/poster_12.webp',
        priority: 'low',
      },
      // bmLogo: {
      //   type: 'svg',
      //   path: '/game/svg/bmLogo.svg',
      // },
    });

    new SoundManager();

    this.#onMuteKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'm') SoundManager.getInstance().toggleMute();
    };
    window.addEventListener('keydown', this.#onMuteKey);

    // Maps any keyboard key to a Konami abstract step (arrow keys + WASD/ZQSD fallback)
    const konamiKeyToStep = (key: string): string | null => {
      if (key === 'ArrowUp' || key === 'w' || key === 'z') return 'up';
      if (key === 'ArrowDown' || key === 's') return 'down';
      if (key === 'ArrowLeft' || key === 'a' || key === 'q') return 'left';
      if (key === 'ArrowRight' || key === 'd') return 'right';
      if (key === 'b' || key === 'Alt' || key === 'AltGraph') return 'b';
      if (key === 'a' || key === ' ' || key === 'Enter') return 'a';
      return null;
    };
    const KONAMI = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];
    this.#onKonamiKey = (e: KeyboardEvent) => {
      const step = konamiKeyToStep(e.key);
      if (!step) return;
      const expected = KONAMI[this.#konamiIndex]!;
      if (step === expected) {
        this.#konamiIndex++;
        if (this.#konamiIndex === KONAMI.length) {
          this.#konamiIndex = 0;
          Environment.getInstance()?.toggleNight();
        }
      } else {
        this.#konamiIndex = (step === KONAMI[0]) ? 1 : 0;
      }
    };
    window.addEventListener('keydown', this.#onKonamiKey);

    // Initialize keyboard fallback based on runtime config
    const config = useRuntimeConfig();
    const gamepadManager = GamepadManager.getInstance();
    if (config.public.keyboardFallbackEnabled) {
      gamepadManager.enableKeyboards();
    } else {
      gamepadManager.disableKeyboards();
    }

    this.#actor = createActor(
      stageMachine.provide({
        actions: {
          hideLoadingOverlay: () => {
            this.#loadingOverlay.hide();
          },
          navigateToLoadingErrorPage: () => {
            navigateTo('/loading-error');
          },
          setupLoadingScreen: () => this.setupLoadingScreen(),
          setupScreens: () => this.setupScreens(),
        },
        actors: {
          loadResources: fromPromise(() => this.loadResources()),
          waitForLowPriorityResources: fromPromise(() => this.waitForLowPriorityResources()),
        },
      }),
      {
        input: {},
      },
    );

    this.#actor.start();

    this.#time = new Time();
    this.#onTickCore = () => {
      this.#camera.update();
      this.#loadingOverlay.update();
      this.#renderer.update();
    };
    this.#time.addEventListener('tick', this.#onTickCore);
  }

  /**
   * Start loading the resources,
   * and transition to the next state when the high priority resources are loaded.
   */
  private async loadResources() {
    return new Promise<void>((resolve) => {
      this.#resources.addEventListener('ready', () => resolve());
      this.#resources.load();
    });
  }

  /**
   * Wait for the low priority resources to be loaded,
   * and transition to the next state.
   */
  private async waitForLowPriorityResources() {
    await Promise.all([
      new Promise<void>((resolve) => {
        if (this.#resources.isDone) resolve();
        this.#resources.addEventListener('done', () => resolve());

        // setTimeout(() => resolve(), 4_000);
      }),
      SoundManager.getInstance().waitForLoad(),
    ]);
  }

  private setupLoadingScreen() {
    this.#environment = new Environment(this.#scene, this.#levelInfo);

    const loadingScreen = new LoadingScreen(this.#actor, this.#camera.camera);

    this.#onTickLoadingScreen = () => {
      loadingScreen.update();
    };
    this.#time.addEventListener('tick', this.#onTickLoadingScreen);
  }

  private setupScreens() {
    if (!this.#environment) {
      throw new Error('Environment must be initialized before setting up the screens.');
    }

    const startScreen = new StartScreen(this.#actor, this.#camera.camera);
    const levelScreen = new LevelScreen(this.#actor, this.#scene, this.#camera, this.#levelInfo);
    const menuScreen = new MenuScreen(this.#actor, this.#camera.camera);
    const characterSelectScreen = new CharacterSelectScreen(this.#actor, this.#camera.camera);
    const tutorialScreen = new TutorialScreen(this.#actor, this.#camera.camera);
    const leaderboardScreen = new LeaderboardScreen(this.#actor, this.#camera.camera);
    const pauseScreen = new PauseScreen(this.#actor, this.#camera.camera);
    const scoreScreen = new ScoreScreen(this.#actor, this.#camera.camera);
    const savingScoreScreen = new SavingScoreScreen(this.#actor, this.#camera.camera);

    this.#screens = [startScreen, levelScreen, menuScreen, characterSelectScreen, tutorialScreen, leaderboardScreen, pauseScreen, scoreScreen, savingScoreScreen];

    /**
     * Must be called after the meshes have been created,
     * as it traverses the scene to update the materials.
     * If called before, it won't find any meshes to update.
     */
    this.#environment.updateMeshesMaterial();

    // Centralized audio lifecycle
    const MENU_PHASE_STATES = ['Menu', 'Character Select', 'Tutorial', 'Score', 'Saving score', 'Leaderboard'];

    let previousState = this.#actor.getSnapshot();

    this.#audioSubscription = this.#actor.subscribe((state) => {
      const sm = SoundManager.getInstance();

      if (MENU_PHASE_STATES.some((s) => state.matches(s))) {
        if (previousState.matches('Pause')) {
          this.#renderer.setBloomEnabled(true);
          this.#camera.camera.layers.set(0);
          this.#scene.background = this.#defaultBgColor;
        }
        sm.setPhase('menu');
      } else if (state.matches('Level')) {
        if (!Debug.getInstance().active) {
          if (previousState.matches('Pause')) {
            this.#renderer.setBloomEnabled(true);
            this.#camera.camera.layers.set(0);
            this.#scene.background = this.#defaultBgColor;
            sm.resumePlayback();
          } else {
            sm.setPhase('game');
          }
        }
      } else if (state.matches('Pause')) {
        sm.pausePlayback();
        this.#renderer.setBloomEnabled(false);
        this.#camera.camera.layers.disableAll();
        this.#camera.camera.layers.enable(OVERLAY_LAYER);
        this.#scene.background = this.#pauseBgColor;
      } else {
        sm.setPhase('silent');
      }

      previousState = state;
    });

    if (Debug.getInstance().active) {
      const sub = this.#actor.subscribe((state) => {
        if (state.matches('Start')) {
          this.#actor.send({ type: 'debugStart' });
          sub.unsubscribe();
        }
      });
    }

    const gamepadManager = GamepadManager.getInstance();

    const KONAMI_GP = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];

    // Returns the abstract Konami step for an input source this frame, checking
    // both d-pad buttons and left-stick edges (for controllers that use axes for d-pad).
    const getGpStep = (source: ReturnType<typeof gamepadManager.getInputSource>, prevMov: { x: number; z: number }): string | null => {
      if (!source) return null;
      if (source.isButtonJustPressed('dpadUp')) return 'up';
      if (source.isButtonJustPressed('dpadDown')) return 'down';
      if (source.isButtonJustPressed('dpadLeft')) return 'left';
      if (source.isButtonJustPressed('dpadRight')) return 'right';
      if (source.isButtonJustPressed('b')) return 'b';
      if (source.isButtonJustPressed('a')) return 'a';
      // Left-stick edge: only fire on the frame the stick crosses the threshold
      const wasNeutral = Math.abs(prevMov.x) < 0.5 && Math.abs(prevMov.z) < 0.5;
      if (wasNeutral) {
        const mov = source.getMovement();
        if (mov.z < -0.5) return 'up';
        if (mov.z > 0.5) return 'down';
        if (mov.x < -0.5) return 'left';
        if (mov.x > 0.5) return 'right';
      }
      return null;
    };

    this.#onTickScreens = () => {
      gamepadManager.update();

      const sources = [gamepadManager.getInputSource(1), gamepadManager.getInputSource(2)];
      for (let i = 0; i < sources.length; i++) {
        const step = getGpStep(sources[i]!, this.#konamiPrevMovement[i]!);
        const mov = sources[i]?.getMovement() ?? { x: 0, z: 0 };
        this.#konamiPrevMovement[i] = mov;
        if (!step) continue;
        const expected = KONAMI_GP[this.#konamiGamepadIndex]!;
        if (step === expected) {
          this.#konamiGamepadIndex++;
          if (this.#konamiGamepadIndex === KONAMI_GP.length) {
            this.#konamiGamepadIndex = 0;
            Environment.getInstance()?.toggleNight();
          }
        } else {
          this.#konamiGamepadIndex = (step === KONAMI_GP[0]) ? 1 : 0;
        }
        break; // one input per frame is enough
      }

      startScreen.update();
      levelScreen.update();
      menuScreen.update();
      characterSelectScreen.update();
      tutorialScreen.update();
      leaderboardScreen.update();
      pauseScreen.update();
      scoreScreen.update();
      savingScoreScreen.update();
      gamepadManager.updateKeyboards();
    };
    this.#time.addEventListener('tick', this.#onTickScreens);
  }

  public dispose() {
    this.#time.removeEventListener('tick', this.#onTickCore);
    this.#time.removeEventListener('tick', this.#onTickLoadingScreen);
    this.#time.removeEventListener('tick', this.#onTickScreens);
    this.#time.dispose();
    this.#sizes.removeEventListener('resize', this.#onResize);
    this.#sizes.dispose();
    window.removeEventListener('keydown', this.#onMuteKey);
    window.removeEventListener('keydown', this.#onKonamiKey);

    this.#audioSubscription?.unsubscribe();
    this.#actor.stop();

    for (const screen of this.#screens) screen.dispose();
    this.#screens.length = 0;

    this.#loadingOverlay.dispose();
    this.#renderer.dispose();
    GamepadManager.getInstance().cleanup();
    SoundManager.getInstance().dispose();
    Physics.getInstance()?.destroy();
  }
}
