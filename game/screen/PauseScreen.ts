import { Group, type Mesh, MeshStandardMaterial, type Scene } from 'three';
import type { Actor, AnyActorLogic } from 'xstate';

import { createTextMesh } from '../lib/createTextMesh';
import { Resources } from '../util/Resources';

export class PauseScreen {
  #stageActor: Actor<AnyActorLogic>;
  #scene: Scene;
  #resources: Resources;

  #group: Group;
  #titleMesh: Mesh | null = null;
  #commandsMesh: Mesh | null = null;
  #resumeMesh: Mesh | null = null;
  #quitMesh: Mesh | null = null;
  #material: MeshStandardMaterial;

  constructor(stageActor: Actor<AnyActorLogic>, scene: Scene) {
    this.#stageActor = stageActor;
    this.#scene = scene;
    this.#resources = Resources.getInstance();

    this.#group = new Group();
    this.#scene.add(this.#group);

    this.#stageActor.subscribe((state) => {
      if (state.matches('Pause')) {
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

    this.#titleMesh = createTextMesh('Paused', font, {
      extrusionDepth: 0.1,
      size: 1.5,
      material: this.#material,
    });
    this.#titleMesh.position.set(0, 4, 0);
    this.#group.add(this.#titleMesh);

    this.#commandsMesh = createTextMesh('Controls:\nGamepad - Move vehicle\nPause button - Resume/Pause', font, {
      extrusionDepth: 0.05,
      size: 0.7,
      material: this.#material,
    });
    this.#commandsMesh.position.set(0, 1.5, 0);
    this.#group.add(this.#commandsMesh);

    this.#resumeMesh = createTextMesh('> Resume', font, {
      extrusionDepth: 0.05,
      size: 0.8,
      material: this.#material,
    });
    this.#resumeMesh.position.set(-1, -1, 0);
    this.#group.add(this.#resumeMesh);

    this.#quitMesh = createTextMesh('  Quit to Menu', font, {
      extrusionDepth: 0.05,
      size: 0.8,
      material: this.#material,
    });
    this.#quitMesh.position.set(-1, -2.5, 0);
    this.#group.add(this.#quitMesh);
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
