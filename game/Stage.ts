import { Scene } from 'three';
import { type Actor, type AnyActorLogic, createActor, fromPromise } from 'xstate';

import { navigateTo } from '#app';

import { Camera } from './Camera';
import { Environment } from './Environment';
import { LoadingOverlay } from './LoadingOverlay';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { LevelScreen } from './screens/LevelScreen';
import { LoadingScreen } from './screens/LoadingScreen';
import { MenuScreen } from './screens/MenuScreen';
import { PauseScreen } from './screens/PauseScreen';
import { SavingScoreScreen } from './screens/SavingScoreScreen';
import { ScoreScreen } from './screens/ScoreScreen';
import { StartScreen } from './screens/StartScreen';
import { TutorialScreen } from './screens/TutorialScreen';
import { WaitingScreen } from './screens/WaitingScreen';
import { stageMachine } from './Stage.machine';
import { Debug } from './utils/Debug';
import { Renderer } from './utils/Renderer';
import { Resources } from './utils/Resources';
import { Sizes } from './utils/Sizes';
import { Time } from './utils/Time';

export class Stage {
  #actor: Actor<AnyActorLogic>;
  #scene: Scene;
  #camera: Camera;
  #resources: Resources;
  #time: Time;
  #environment: Environment | null = null;

  constructor(canvas: HTMLCanvasElement) {
    if (!window) {
      throw new Error('"Stage" can only be instanciated in a browser environment.');
    }

    new Debug();

    this.#scene = new Scene();
    this.#camera = new Camera(this.#scene, canvas);
    const renderer = new Renderer(this.#scene, canvas, this.#camera);
    const loadingOverlay = new LoadingOverlay(this.#scene);

    const sizes = new Sizes();
    sizes.addEventListener('resize', () => {
      window.requestAnimationFrame(() => {
        this.#camera.setSizesAndRatio();

        /**
         * Must be called after the camera has been resized,
         * as it updates the renderer's size and pixel ratio.
         * Also, it would take into account a re-positionning of the camera.
         */
        renderer.setSizesAndRatio();
      });
    });

    this.#resources = new Resources({
      // High priorities, `ready` event will be emitted when loaded
      interFont: {
        type: 'font',
        path: 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
        priority: 'high',
      },

      // Low priorities, `done` event will be emitted when loaded
      menuTrack: {
        type: 'audio',
        path: '/game/audio/track/menu.opus',
        priority: 'low',
      },
      levelTrack: {
        type: 'audio',
        path: '/game/audio/track/level.opus',
        priority: 'low',
      },
      selectEffect: {
        type: 'audio',
        path: '/game/audio/effect/select.opus',
        priority: 'low',
      },
      playerTexture: {
        type: 'texture',
        path: '/game/player.png',
        priority: 'low',
      },
      duckModel: {
        type: 'gltf',
        path: '/game/Duck.gltf',
        priority: 'low',
      },
      benchModel: {
        type: 'gltf',
        path: '/game/bench.glb',
        priority: 'low',
      },
      // bmLogo: {
      //   type: 'svg',
      //   path: '/game/svg/bmLogo.svg',
      // },
    });

    this.#actor = createActor(
      stageMachine.provide({
        actions: {
          hideLoadingOverlay: () => {
            loadingOverlay.hide();
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

    // FIXME Debug only, to remove later
    this.#actor.subscribe((state) => {
      console.log({
        state: state.value,
        error: state.error,
        context: state.context,
      });
    });

    this.#actor.start();

    this.#time = new Time();
    this.#time.addEventListener('tick', () => {
      this.#camera.update();
      loadingOverlay.update();
      renderer.update();
    });
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
    return new Promise<void>((resolve) => {
      if (this.#resources.isDone) resolve();
      this.#resources.addEventListener('done', () => resolve());

      // setTimeout(() => resolve(), 4_000);
    });
  }

  private setupLoadingScreen() {
    this.#environment = new Environment(this.#scene);

    const loadingScreen = new LoadingScreen(this.#actor, this.#scene);

    this.#time.addEventListener('tick', () => {
      loadingScreen.update();
    });
  }

  private setupScreens() {
    if (!this.#environment) {
      throw new Error('Environment must be initialized before setting up the screens.');
    }

    const startScreen = new StartScreen(this.#actor, this.#scene);
    const levelScreen = new LevelScreen(this.#actor, this.#scene, this.#camera);
    const menuScreen = new MenuScreen(this.#actor, this.#scene);
    const tutorialScreen = new TutorialScreen(this.#actor, this.#scene);
    const waitingScreen = new WaitingScreen(this.#actor, this.#scene);
    const leaderboardScreen = new LeaderboardScreen(this.#actor, this.#scene);
    const pauseScreen = new PauseScreen(this.#actor, this.#scene);
    const scoreScreen = new ScoreScreen(this.#actor, this.#scene);
    const savingScoreScreen = new SavingScoreScreen(this.#actor, this.#scene);

    /**
     * Must be called after the meshes have been created,
     * as it traverses the scene to update the materials.
     * If called before, it won't find any meshes to update.
     */
    this.#environment.updateMeshesMaterial();

    this.#time.addEventListener('tick', () => {
      startScreen.update();
      levelScreen.update();
      menuScreen.update();
      tutorialScreen.update();
      waitingScreen.update();
      leaderboardScreen.update();
      pauseScreen.update();
      scoreScreen.update();
      savingScoreScreen.update();
    });
  }
}
