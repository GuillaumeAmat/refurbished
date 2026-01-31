import { Group, type Mesh, MeshStandardMaterial, type Scene } from 'three';
import type { Actor, AnyActorLogic, Subscription } from 'xstate';

import { createTextMesh } from '../lib/createTextMesh';
// import { MOODS } from '../constants';
import { Resources } from '../util/Resources';

export class LoadingScreen {
  #stageActor: Actor<AnyActorLogic>;
  #scene: Scene;
  #resources: Resources;
  #subscription: Subscription;

  #group: Group;
  #mesh: Mesh | null = null;
  #material: MeshStandardMaterial;

  public get mesh() {
    return this.#mesh;
  }

  constructor(stageActor: Actor<AnyActorLogic>, scene: Scene) {
    this.#stageActor = stageActor;
    this.#scene = scene;
    this.#resources = Resources.getInstance();

    this.#group = new Group();
    this.#group.position.set(0, 30, 0);

    this.#scene.add(this.#group);

    this.#subscription = this.#stageActor.subscribe((state) => {
      if (state.matches('Loading')) {
        this.show();
      } else {
        this.hide();
      }
    });

    this.#material = new MeshStandardMaterial({
      color: '#FBD954',
      // color: MOODS['mindaro-94'].value,
      metalness: 0.3,
      roughness: 0.4,
    });

    this.createText();
  }

  private createText() {
    const font = this.#resources.getFontAsset('interFont');

    // FIXME Temporary workaround for font loading issue
    if (!font) {
      return;
    }

    this.#mesh = createTextMesh('Loading...', font, {
      extrusionDepth: 0.05,
      size: 1.2,
      material: this.#material,
    });
    this.#mesh.position.set(0, 0, 0);
    this.#group.add(this.#mesh);
  }

  public show() {
    this.#group.visible = true;
  }

  public hide() {
    this.#group.visible = false;
  }

  public update() {
    if (!this.#group.visible) return;
  }

  public dispose() {
    this.#subscription.unsubscribe();
  }
}
