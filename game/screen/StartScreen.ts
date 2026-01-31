import { Group, type Mesh, MeshStandardMaterial, type Scene } from 'three';
import type { Actor, AnyActorLogic, Subscription } from 'xstate';

import { createTextMesh } from '../lib/createTextMesh';
import { KeyboardController } from '../util/input/KeyboardController';
import { Resources } from '../util/Resources';

export class StartScreen {
  #stageActor: Actor<AnyActorLogic>;
  #scene: Scene;
  #resources: Resources;
  #inputController: KeyboardController;
  #subscription: Subscription;

  #group: Group;
  #titleMesh: Mesh | null = null;
  #promptMesh: Mesh | null = null;
  #material: MeshStandardMaterial;

  constructor(stageActor: Actor<AnyActorLogic>, scene: Scene) {
    this.#stageActor = stageActor;
    this.#scene = scene;
    this.#resources = Resources.getInstance();
    this.#inputController = new KeyboardController();

    this.#group = new Group();
    this.#group.position.set(0, 30, 0);
    this.#scene.add(this.#group);

    this.#subscription = this.#stageActor.subscribe((state) => {
      if (state.matches('Start')) {
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

    this.#titleMesh = createTextMesh('Refurbished!', font, {
      extrusionDepth: 0.1,
      size: 2,
      material: this.#material,
    });
    this.#titleMesh.position.set(0, 2, 0);
    this.#group.add(this.#titleMesh);

    this.#promptMesh = createTextMesh('Press any button to start', font, {
      extrusionDepth: 0.05,
      size: 0.8,
      material: this.#material,
    });
    this.#promptMesh.position.set(0, -1, 0);
    this.#group.add(this.#promptMesh);
  }

  private show() {
    this.#inputController.onButtonUp(() => this.onButtonUp());
    this.#group.visible = true;
  }

  private hide() {
    this.#inputController.cleanup();
    this.#group.visible = false;
  }

  private onButtonUp() {
    this.#stageActor.send({ type: 'start' });
  }

  public update() {
    if (!this.#group.visible) return;
  }

  public dispose() {
    this.#subscription.unsubscribe();
  }
}
