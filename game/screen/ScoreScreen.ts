import { Group, type Mesh, MeshStandardMaterial, type Scene } from 'three';
import type { Actor, AnyActorLogic, Subscription } from 'xstate';

import { createTextMesh } from '../lib/createTextMesh';
import { Resources } from '../util/Resources';

export class ScoreScreen {
  #stageActor: Actor<AnyActorLogic>;
  #scene: Scene;
  #resources: Resources;
  #subscription: Subscription;

  #group: Group;
  #titleMesh: Mesh | null = null;
  #scoreMesh: Mesh | null = null;
  #promptMesh: Mesh | null = null;
  #nameInputMesh: Mesh | null = null;
  #saveMesh: Mesh | null = null;
  #skipMesh: Mesh | null = null;
  #material: MeshStandardMaterial;

  constructor(stageActor: Actor<AnyActorLogic>, scene: Scene) {
    this.#stageActor = stageActor;
    this.#scene = scene;
    this.#resources = Resources.getInstance();

    this.#group = new Group();
    this.#group.position.set(0, 30, 0);
    this.#scene.add(this.#group);

    this.#subscription = this.#stageActor.subscribe((state) => {
      if (state.matches('Score')) {
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

    this.#titleMesh = createTextMesh('Game Over', font, {
      extrusionDepth: 0.1,
      size: 1.5,
      material: this.#material,
    });
    this.#titleMesh.position.set(0, 4, 0);
    this.#group.add(this.#titleMesh);

    this.#scoreMesh = createTextMesh('Your Score: 1000', font, {
      extrusionDepth: 0.08,
      size: 1.2,
      material: this.#material,
    });
    this.#scoreMesh.position.set(0, 2.5, 0);
    this.#group.add(this.#scoreMesh);

    this.#promptMesh = createTextMesh('Enter your name:', font, {
      extrusionDepth: 0.05,
      size: 0.8,
      material: this.#material,
    });
    this.#promptMesh.position.set(0, 1, 0);
    this.#group.add(this.#promptMesh);

    this.#nameInputMesh = createTextMesh('Player_', font, {
      extrusionDepth: 0.05,
      size: 0.8,
      material: this.#material,
    });
    this.#nameInputMesh.position.set(0, 0, 0);
    this.#group.add(this.#nameInputMesh);

    this.#saveMesh = createTextMesh('> Save Score', font, {
      extrusionDepth: 0.05,
      size: 0.8,
      material: this.#material,
    });
    this.#saveMesh.position.set(-1, -1.5, 0);
    this.#group.add(this.#saveMesh);

    this.#skipMesh = createTextMesh('  Skip', font, {
      extrusionDepth: 0.05,
      size: 0.8,
      material: this.#material,
    });
    this.#skipMesh.position.set(2, -1.5, 0);
    this.#group.add(this.#skipMesh);
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

  public dispose() {
    this.#subscription.unsubscribe();
  }
}
