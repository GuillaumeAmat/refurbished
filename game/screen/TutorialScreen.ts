import { Group, type Mesh, MeshStandardMaterial, type Scene } from 'three';
import type { Actor, AnyActorLogic, Subscription } from 'xstate';

import { createTextMesh } from '../lib/createTextMesh';
import { Resources } from '../util/Resources';

export class TutorialScreen {
  #stageActor: Actor<AnyActorLogic>;
  #scene: Scene;
  #resources: Resources;
  #subscription: Subscription;

  #group: Group;
  #titleMesh: Mesh | null = null;
  #commandsMesh: Mesh | null = null;
  #backMesh: Mesh | null = null;
  #playMesh: Mesh | null = null;
  #material: MeshStandardMaterial;

  constructor(stageActor: Actor<AnyActorLogic>, scene: Scene) {
    this.#stageActor = stageActor;
    this.#scene = scene;
    this.#resources = Resources.getInstance();

    this.#group = new Group();
    this.#group.position.set(0, 30, 0);
    this.#scene.add(this.#group);

    this.#subscription = this.#stageActor.subscribe((state) => {
      if (state.matches('Tutorial')) {
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

    this.#titleMesh = createTextMesh('Tutorial', font, {
      extrusionDepth: 0.1,
      size: 1.5,
      material: this.#material,
    });
    this.#titleMesh.position.set(0, 4, 0);
    this.#group.add(this.#titleMesh);

    this.#commandsMesh = createTextMesh(
      'Use gamepad to control vehicle\nCooperative 2-player game\nAvoid obstacles, collect points',
      font,
      {
        extrusionDepth: 0.05,
        size: 0.7,
        material: this.#material,
      },
    );
    this.#commandsMesh.position.set(0, 1, 0);
    this.#group.add(this.#commandsMesh);

    this.#backMesh = createTextMesh('Back', font, {
      extrusionDepth: 0.05,
      size: 0.8,
      material: this.#material,
    });
    this.#backMesh.position.set(-2, -2, 0);
    this.#group.add(this.#backMesh);

    this.#playMesh = createTextMesh('> Start Game', font, {
      extrusionDepth: 0.05,
      size: 0.8,
      material: this.#material,
    });
    this.#playMesh.position.set(1, -2, 0);
    this.#group.add(this.#playMesh);
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
