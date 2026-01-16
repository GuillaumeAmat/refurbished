import { Group, type Mesh, MeshStandardMaterial, type Scene } from 'three';
import type { Actor, AnyActorLogic } from 'xstate';

import { createTextMesh } from '../lib/createTextMesh';
import { Resources } from '../util/Resources';

export class LeaderboardScreen {
  #stageActor: Actor<AnyActorLogic>;
  #scene: Scene;
  #resources: Resources;

  #group: Group;
  #titleMesh: Mesh | null = null;
  #scoresMesh: Mesh | null = null;
  #backMesh: Mesh | null = null;
  #material: MeshStandardMaterial;

  constructor(stageActor: Actor<AnyActorLogic>, scene: Scene) {
    this.#stageActor = stageActor;
    this.#scene = scene;
    this.#resources = Resources.getInstance();

    this.#group = new Group();
    this.#group.position.set(0, 30, 0);
    this.#scene.add(this.#group);

    this.#stageActor.subscribe((state) => {
      if (state.matches('Leaderboard')) {
        this.show();
      } else {
        this.hide();
      }
    });

    this.#material = new MeshStandardMaterial({
      color: '#FBD954',
      metalness: 0.3,
      roughness: 0.4,
    });

    this.createText();
  }

  private createText() {
    const font = this.#resources.getFontAsset('interFont');

    if (!font) {
      return;
    }

    this.#titleMesh = createTextMesh('Leaderboard', font, {
      extrusionDepth: 0.1,
      size: 1.5,
      material: this.#material,
    });
    this.#titleMesh.position.set(0, 4, 0);
    this.#group.add(this.#titleMesh);

    this.#scoresMesh = createTextMesh(
      '1. Player1 - 1000\n2. Player2 - 800\n3. Player3 - 600\n4. Player4 - 400\n5. Player5 - 200',
      font,
      {
        extrusionDepth: 0.05,
        size: 0.8,
        material: this.#material,
      },
    );
    this.#scoresMesh.position.set(0, 1, 0);
    this.#group.add(this.#scoresMesh);

    this.#backMesh = createTextMesh('> Back to Menu', font, {
      extrusionDepth: 0.05,
      size: 0.8,
      material: this.#material,
    });
    this.#backMesh.position.set(0, -3, 0);
    this.#group.add(this.#backMesh);
  }

  private show() {
    this.#group.visible = true;
  }

  private hide() {
    this.#group.visible = false;
  }

  public update() {
    if (!this.#group.visible) return;
  }
}
