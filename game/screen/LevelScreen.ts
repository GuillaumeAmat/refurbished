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
import { GamepadManager } from '../util/input/GamepadManager';
import { Sizes } from '../util/Sizes';
import type { Camera } from '../world/Camera';
import { Level } from '../world/Level';

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
      if (state.matches('Level')) {
        this.show();
      } else {
        this.hide();
      }
    });

    this.#onGamepadDisconnected = () => {
      if (!this.#group.visible) return;

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
    this.#scene.add(this.#group);

    this.#hudManager = new HUDRegionManager(this.#camera.camera);
    this.#hudManager.add('topRight', new ControllersHUD(this.#gamepadManager));
    this.#hudManager.add('bottomLeft', new PointsHUD());
    this.#hudManager.add('bottomRight', new TimeHUD());

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

  private show() {
    this.#group.visible = true;
    this.#hudManager.show();
    this.#scoreManager.reset();
    this.#sessionManager.reset();
    this.#sessionManager.start();
    this.initLevel();
  }

  private hide() {
    this.#group.visible = false;
    this.#hudManager.hide();
    this.#sessionManager.stop();
  }

  public update() {
    if (!this.#group.visible) return;
    if (!this.#levelInitialized) return;

    this.#gamepadManager.update();
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
