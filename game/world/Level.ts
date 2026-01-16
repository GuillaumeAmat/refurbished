import { Group, type Scene } from 'three';

import type { LevelInfo } from '../levels';
import { Debug } from '../util/Debug';
import { LevelBuilder } from './LevelBuilder';
import { Floor } from './object/Floor';
import { OuterFloor } from './object/OuterFloor';

export class Level {
  #screenGroup: Group;
  #scene: Scene;
  #group: Group;
  #levelInfo: LevelInfo;

  #floor: Floor;
  #outerFloor: OuterFloor;
  #levelBuilder: LevelBuilder;

  #debug: Debug;
  #debugProperties = {
    DisplayHelper: true,
  };

  constructor(screenGroup: Group, scene: Scene, levelInfo: LevelInfo) {
    this.#screenGroup = screenGroup;
    this.#scene = scene;
    this.#debug = Debug.getInstance();
    this.#levelInfo = levelInfo;

    this.#group = new Group();
    this.#screenGroup.add(this.#group);

    this.#outerFloor = new OuterFloor(this.#levelInfo);
    this.#outerFloor.create(this.#group);

    this.#floor = new Floor(this.#levelInfo);
    this.#floor.create(this.#group);

    this.#levelBuilder = new LevelBuilder(this.#levelInfo.data);
    this.#levelBuilder.buildFromMatrix(this.#group);

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

  public dispose(): void {
    this.#floor.dispose();
    this.#outerFloor.dispose();
    this.#levelBuilder.dispose();
    this.#group.removeFromParent();
  }

  public update() {}
}
