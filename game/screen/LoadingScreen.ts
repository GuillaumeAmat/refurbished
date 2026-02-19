import type { PerspectiveCamera } from 'three';
import type { Actor, AnyActorLogic, Subscription } from 'xstate';

import { HUDRegionManager } from '../hud/HUDRegionManager';
import { LoadingOverlayHUD } from '../hud/LoadingOverlayHUD';
import { Sizes } from '../util/Sizes';

export class LoadingScreen {
  #stageActor: Actor<AnyActorLogic>;
  #subscription: Subscription;

  #hudManager: HUDRegionManager;
  #overlay: LoadingOverlayHUD;
  #sizes: Sizes;
  #onResize: () => void;

  #visible = false;

  constructor(stageActor: Actor<AnyActorLogic>, camera: PerspectiveCamera) {
    this.#stageActor = stageActor;

    this.#hudManager = new HUDRegionManager(camera);
    this.#overlay = new LoadingOverlayHUD();
    this.#hudManager.add('center', this.#overlay);
    this.#hudManager.hide();

    this.#subscription = this.#stageActor.subscribe((state) => {
      if (state.matches('Loading')) {
        this.show();
      } else {
        this.hide();
      }
    });

    this.#sizes = Sizes.getInstance();
    this.#onResize = () => this.#hudManager.updatePositions();
    this.#sizes.addEventListener('resize', this.#onResize);
  }

  public show() {
    this.#visible = true;
    this.#hudManager.show();
  }

  public hide() {
    this.#visible = false;
    this.#hudManager.hide();
  }

  public update() {
    if (!this.#visible) return;

    this.#hudManager.update();
  }

  public dispose() {
    this.#subscription.unsubscribe();
    this.#sizes.removeEventListener('resize', this.#onResize);
    this.#hudManager.dispose();
  }
}
