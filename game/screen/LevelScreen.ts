import { Group, type Scene } from 'three';
import type { Actor, AnyActorLogic, Subscription } from 'xstate';

import { useRuntimeConfig } from '#app';

import { ControllersHUD } from '../hud/ControllersHUD';
import { HUDRegionManager } from '../hud/HUDRegionManager';
import { PointsHUD } from '../hud/PointsHUD';
import { TimeHUD } from '../hud/TimeHUD';
import type { LevelInfo } from '../levels';
import { ScoreManager } from '../state/ScoreManager';
import { SessionManager } from '../state/SessionManager';
import { GamepadManager, type PlayerId } from '../util/input/GamepadManager';
import { Sizes } from '../util/Sizes';
import type { Camera } from '../world/Camera';
import { Level } from '../world/Level';

// States where level background remains visible
const LEVEL_BACKGROUND_STATES = ['Level', 'Score', 'Saving score', 'Pause'];
// States where player interaction is enabled
const INTERACTIVE_STATES = ['Level'];

export class LevelScreen {
  #stageActor: Actor<AnyActorLogic>;
  #scene: Scene;
  #camera: Camera;
  #levelInfo: LevelInfo;
  #gamepadManager: GamepadManager;
  #subscription: Subscription;
  #sizes: Sizes;

  #group: Group;
  #level: Level | null = null;
  #hudManager: HUDRegionManager;
  #levelInitialized = false;
  #sessionManager: SessionManager;
  #scoreManager: ScoreManager;
  #isInteractive = false;

  // Bound listener references for cleanup
  #onGamepadDisconnected: () => void;
  #onControllersReadyChange: EventListener;
  #onResize: () => void;
  #onSessionEnded: () => void;

  constructor(stageActor: Actor<AnyActorLogic>, scene: Scene, camera: Camera, levelInfo: LevelInfo) {
    this.#stageActor = stageActor;
    this.#scene = scene;
    this.#camera = camera;
    this.#gamepadManager = GamepadManager.getInstance();
    this.#levelInfo = levelInfo;

    this.#subscription = this.#stageActor.subscribe((state) => {
      const isBackgroundVisible = LEVEL_BACKGROUND_STATES.some((s) => state.matches(s));
      const isInteractive = INTERACTIVE_STATES.some((s) => state.matches(s));

      if (isBackgroundVisible) {
        this.show(isInteractive);
      } else {
        this.hide();
      }
    });

    this.#onGamepadDisconnected = () => {
      if (!this.#group.visible) return;
      if (!this.#isInteractive) return;

      const config = useRuntimeConfig();
      if (!config.public.keyboardFallbackEnabled) {
        this.#stageActor.send({ type: 'controllerDisconnected' });
      }
    };

    this.#onControllersReadyChange = ((event: CustomEvent) => {
      const { ready } = event.detail;
      const currentState = this.#stageActor.getSnapshot();

      if (ready && currentState.matches('Pause')) {
        this.#stageActor.send({ type: 'resume' });
      }
    }) as EventListener;

    this.#gamepadManager.addEventListener('gamepadDisconnected', this.#onGamepadDisconnected);
    this.#gamepadManager.addEventListener('controllersReadyChange', this.#onControllersReadyChange);

    this.#group = new Group();
    this.#group.visible = false;
    this.#scene.add(this.#group);

    this.#hudManager = new HUDRegionManager(this.#camera.camera);
    this.#hudManager.add('topRight', new ControllersHUD(this.#gamepadManager));
    this.#hudManager.add('bottomLeft', new PointsHUD());
    this.#hudManager.add('bottomRight', new TimeHUD());
    this.#hudManager.hide();

    this.#sizes = Sizes.getInstance();
    this.#onResize = () => this.#hudManager.updatePositions();
    this.#sizes.addEventListener('resize', this.#onResize);

    this.#sessionManager = SessionManager.getInstance();
    this.#scoreManager = ScoreManager.getInstance();
    this.#onSessionEnded = () => {
      if (!this.#group.visible) return;
      this.#stageActor.send({ type: 'end', score: this.#scoreManager.getScore() });
    };
    this.#sessionManager.addEventListener('sessionEnded', this.#onSessionEnded);
  }

  private async initLevel() {
    if (this.#levelInitialized) return;

    this.#level = new Level(this.#group, this.#scene, this.#levelInfo);
    await this.#level.init();

    this.#levelInitialized = true;
  }

  private show(interactive: boolean) {
    const wasHidden = !this.#group.visible;

    this.#group.visible = true;
    this.#isInteractive = interactive;
    this.#level?.setInteractive(interactive);

    // Show game HUD only in interactive mode
    if (interactive) {
      this.#hudManager.show();
    } else {
      this.#hudManager.hide();
    }

    // Only reset/start session when freshly entering from hidden state
    if (wasHidden) {
      this.#scoreManager.reset();
      this.#sessionManager.reset();
      this.#sessionManager.start();
      this.initLevel();
    }
  }

  private hide() {
    this.#group.visible = false;
    this.#isInteractive = false;
    this.#hudManager.hide();
    this.#sessionManager.stop();
  }

  #checkPauseInput() {
    for (const playerId of [1, 2] as PlayerId[]) {
      const input = this.#gamepadManager.getInputSource(playerId);
      if (!input?.connected) continue;

      if (input.isButtonJustPressed('start')) {
        this.#stageActor.send({ type: 'pause' });
        return;
      }
    }
  }

  public update() {
    if (!this.#group.visible) return;
    if (!this.#levelInitialized) return;

    if (this.#isInteractive) {
      this.#checkPauseInput();
    }

    this.#level?.update();
    this.#hudManager.update();
  }

  public dispose() {
    this.#subscription.unsubscribe();
    this.#gamepadManager.removeEventListener('gamepadDisconnected', this.#onGamepadDisconnected);
    this.#gamepadManager.removeEventListener('controllersReadyChange', this.#onControllersReadyChange);
    this.#sizes.removeEventListener('resize', this.#onResize);
    this.#sessionManager.removeEventListener('sessionEnded', this.#onSessionEnded);
  }
}
