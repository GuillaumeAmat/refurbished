import { Group, type Scene } from 'three';
import type { Actor, AnyActorLogic } from 'xstate';

import { useRuntimeConfig } from '#app';

import type { Camera } from '../Camera';
import { ControllersHUD } from '../hud/ControllersHUD';
import { GamepadManager } from '../utils/input/GamepadManager';
import { Physics } from '../utils/Physics';
import { Sizes } from '../utils/Sizes';
import { Level } from '../world/Level';
import { Player } from '../world/Player';

export class LevelScreen {
  #stageActor: Actor<AnyActorLogic>;
  #scene: Scene;
  #camera: Camera;
  #physics: Physics;
  #gamepadManager: GamepadManager;

  #group: Group;
  #player1: Player | null = null;
  #player2: Player | null = null;
  #level: Level | null = null;
  #hud: ControllersHUD;
  #physicsInitialized = false;

  constructor(stageActor: Actor<AnyActorLogic>, scene: Scene, camera: Camera) {
    this.#stageActor = stageActor;
    this.#scene = scene;
    this.#camera = camera;
    this.#physics = Physics.getInstance();
    this.#gamepadManager = GamepadManager.getInstance();

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

    this.#player1 = new Player(this.#group, this.#scene, 1);
    this.#player2 = new Player(this.#group, this.#scene, 2);

    this.#level = new Level(this.#group, this.#scene);
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
