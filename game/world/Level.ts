import { Group, type Scene } from 'three';

import type { LevelInfo } from '../levels';
import { Debug } from '../util/Debug';
import { Physics } from '../util/Physics';
import { InteractionSystem } from './InteractionSystem';
import { LevelBuilder } from './LevelBuilder';
import { Floor } from './object/Floor';
import type { LevelObject } from './object/LevelObject';
import { OuterFloor } from './object/OuterFloor';
import { Player } from './Player';

export class Level {
  #screenGroup: Group;
  #scene: Scene;
  #group: Group;
  #levelInfo: LevelInfo;

  #floor!: Floor;
  #outerFloor!: OuterFloor;
  #levelBuilder!: LevelBuilder;
  #player1: Player | null = null;
  #player2: Player | null = null;
  #interactionSystem!: InteractionSystem;
  #physics: Physics;

  #debug: Debug;
  #debugProperties = {
    DisplayHelper: true,
  };

  constructor(screenGroup: Group, scene: Scene, levelInfo: LevelInfo) {
    this.#screenGroup = screenGroup;
    this.#scene = scene;
    this.#debug = Debug.getInstance();
    this.#physics = Physics.getInstance();
    this.#levelInfo = levelInfo;

    this.#group = new Group();
    this.#screenGroup.add(this.#group);
  }

  public async init(): Promise<void> {
    await this.#physics.init(this.#scene);

    this.#outerFloor = new OuterFloor(this.#levelInfo);
    this.#outerFloor.create(this.#group);

    this.#floor = new Floor(this.#levelInfo);
    this.#floor.create(this.#group);

    this.#levelBuilder = new LevelBuilder(this.#levelInfo.data);
    this.#levelBuilder.buildFromMatrix(this.#group);

    this.#player1 = new Player(this.#group, this.#scene, 1, this.#levelInfo.spawnPositions[0]!);
    this.#player2 = new Player(this.#group, this.#scene, 2, this.#levelInfo.spawnPositions[1]!);

    this.#interactionSystem = new InteractionSystem();
    this.#interactionSystem.registerPlayer(this.#player1);
    this.#interactionSystem.registerPlayer(this.#player2);
    this.#interactionSystem.setInteractables(this.#levelBuilder.getInteractables());

    this.setupHelpers();
  }

  private async setupHelpers() {
    if (this.#debug.active) {
      const folderName = 'Level';
      const guiFolder = this.#debug.gui.addFolder(folderName);

      this.#debugProperties = {
        ...this.#debugProperties,
        ...this.#debug.configFromLocaleStorage?.folders?.[folderName]?.controllers,
      };

      if (this.#group) {
        const { BoxHelper } = await import('three');
        const helper = new BoxHelper(this.#group, 0xffff00);
        helper.visible = this.#debugProperties.DisplayHelper;
        this.#scene.add(helper);

        guiFolder.add(this.#debugProperties, 'DisplayHelper').onChange((value: boolean) => {
          helper.visible = value;
          this.#debug.save();
        });
      }
    }
  }

  public getInteractables(): LevelObject[] {
    return this.#levelBuilder.getInteractables();
  }

  public dispose(): void {
    this.#floor.dispose();
    this.#outerFloor.dispose();
    this.#levelBuilder.dispose();
    this.#group.removeFromParent();
  }

  public update() {
    this.#physics.update();
    this.#player1?.update();
    this.#player2?.update();
    this.#interactionSystem.update();
  }
}
