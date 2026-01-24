import { Group, type Scene } from 'three';
import type { Actor, AnyActorLogic } from 'xstate';

import { useRuntimeConfig } from '#app';

import { ControllersHUD } from '../hud/ControllersHUD';
import type { LevelInfo } from '../levels';
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

  #group: Group;
  #level: Level | null = null;
  #hud: ControllersHUD;
  #levelInitialized = false;

  constructor(stageActor: Actor<AnyActorLogic>, scene: Scene, camera: Camera, levelInfo: LevelInfo) {
    this.#stageActor = stageActor;
    this.#scene = scene;
    this.#camera = camera;
    this.#gamepadManager = GamepadManager.getInstance();
    this.#levelInfo = levelInfo;

    this.#stageActor.subscribe((state) => {
      if (state.matches('Level')) {
        this.show();
      } else {
        this.hide();
      }
    });

    this.#gamepadManager.addEventListener('gamepadDisconnected', () => {
      if (!this.#group.visible) return;

      const config = useRuntimeConfig();
      if (!config.public.keyboardFallbackEnabled) {
        this.#stageActor.send({ type: 'controllerDisconnected' });
      }
    });

    this.#gamepadManager.addEventListener('controllersReadyChange', ((event: CustomEvent) => {
      const { ready } = event.detail;
      const currentState = this.#stageActor.getSnapshot();

      if (ready && currentState.matches('Pause')) {
        this.#stageActor.send({ type: 'resume' });
      }
    }) as EventListener);

    this.#group = new Group();
    this.#scene.add(this.#group);

    this.#hud = new ControllersHUD(this.#camera.camera, this.#gamepadManager);

    const sizes = Sizes.getInstance();
    sizes.addEventListener('resize', () => {
      this.#hud.updatePosition();
    });
  }

  private async initLevel() {
    if (this.#levelInitialized) return;

    this.#level = new Level(this.#group, this.#scene, this.#levelInfo);
    await this.#level.init();

    this.#levelInitialized = true;
  }

  private show() {
    this.#group.visible = true;
    this.#hud.show();
    this.initLevel();
  }

  private hide() {
    this.#group.visible = false;
    this.#hud.hide();
  }

  public update() {
    if (!this.#group.visible) return;
    if (!this.#levelInitialized) return;

    this.#gamepadManager.update();
    this.#level?.update();
    this.#hud.update();
  }
}
