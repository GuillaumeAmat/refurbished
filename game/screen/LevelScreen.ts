import { Group, type Scene } from 'three';
import type { Actor, AnyActorLogic } from 'xstate';

import { useRuntimeConfig } from '#app';

import { ControllersHUD } from '../hud/ControllersHUD';
import type { LevelInfo } from '../levels';
import { GamepadManager } from '../util/input/GamepadManager';
import { Physics } from '../util/Physics';
import { Sizes } from '../util/Sizes';
import type { Camera } from '../world/Camera';
import { Level } from '../world/Level';
import { Player } from '../world/Player';

export class LevelScreen {
  #stageActor: Actor<AnyActorLogic>;
  #scene: Scene;
  #camera: Camera;
  #levelInfo: LevelInfo;
  #physics: Physics;
  #gamepadManager: GamepadManager;

  #group: Group;
  #player1: Player | null = null;
  #player2: Player | null = null;
  #level: Level | null = null;
  #hud: ControllersHUD;
  #physicsInitialized = false;

  constructor(stageActor: Actor<AnyActorLogic>, scene: Scene, camera: Camera, levelInfo: LevelInfo) {
    this.#stageActor = stageActor;
    this.#scene = scene;
    this.#camera = camera;
    this.#physics = Physics.getInstance();
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

  #levelInitialized = false;

  private async initLevel() {
    if (this.#levelInitialized) return;
    this.#levelInitialized = true;

    await this.#physics.init(this.#scene);
    this.#physicsInitialized = true;

    this.#player1 = new Player(this.#group, this.#scene, 1, this.#levelInfo.spawnPositions[0]!);
    this.#player2 = new Player(this.#group, this.#scene, 2, this.#levelInfo.spawnPositions[1]!);

    this.#level = new Level(this.#group, this.#scene, this.#levelInfo);
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
    if (!this.#physicsInitialized) return;

    this.#gamepadManager.update();
    this.#physics.update();
    this.#player1?.update();
    this.#player2?.update();
    this.#level?.update();
    this.#hud.update();
  }
}
