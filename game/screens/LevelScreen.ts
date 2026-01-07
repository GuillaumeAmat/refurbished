import { Group, type Scene } from 'three';
import type { Actor, AnyActorLogic } from 'xstate';

import { GamepadManager } from '../utils/input/GamepadManager';
import { Physics } from '../utils/Physics';
import { Level } from '../world/Level';
import { Player } from '../world/Player';

export class LevelScreen {
  #stageActor: Actor<AnyActorLogic>;
  #scene: Scene;
  #physics: Physics;
  #gamepadManager: GamepadManager;

  #group: Group;
  #player1: Player | null = null;
  #player2: Player | null = null;
  #level: Level | null = null;
  #physicsInitialized = false;

  constructor(stageActor: Actor<AnyActorLogic>, scene: Scene) {
    this.#stageActor = stageActor;
    this.#scene = scene;
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
      if (this.#group.visible) {
        this.#stageActor.send({ type: 'controllerDisconnected' });
      }
    });

    this.#group = new Group();
    this.#scene.add(this.#group);
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
    this.initLevel();
  }

  private hide() {
    this.#group.visible = false;
  }

  public update() {
    if (!this.#group.visible) return;
    if (!this.#physicsInitialized) return;

    this.#gamepadManager.update();
    this.#physics.update();
    this.#player1?.update();
    this.#player2?.update();
    this.#level?.update();
  }
}
