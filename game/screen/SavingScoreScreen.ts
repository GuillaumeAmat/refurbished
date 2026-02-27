import type { PerspectiveCamera } from 'three';
import type { Actor, AnyActorLogic, Subscription } from 'xstate';

import { HUDRegionManager } from '../hud/HUDRegionManager';
import { SavingScoreOverlayHUD } from '../hud/SavingScoreOverlayHUD';
import { GamepadManager, type PlayerId } from '../util/input/GamepadManager';
import { INPUT_TRANSITION_LOCKOUT_MS } from '../util/input/constants';
import { Sizes } from '../util/Sizes';

export class SavingScoreScreen {
  #stageActor: Actor<AnyActorLogic>;
  #subscription: Subscription;
  #gamepadManager: GamepadManager;

  #hudManager: HUDRegionManager;
  #savingOverlay: SavingScoreOverlayHUD;
  #sizes: Sizes;
  #onResize: () => void;

  #visible = false;
  #canContinue = false;

  constructor(stageActor: Actor<AnyActorLogic>, camera: PerspectiveCamera) {
    this.#stageActor = stageActor;
    this.#gamepadManager = GamepadManager.getInstance();

    this.#hudManager = new HUDRegionManager(camera);
    this.#savingOverlay = new SavingScoreOverlayHUD();
    this.#hudManager.add('center', this.#savingOverlay);
    this.#hudManager.hide();

    this.#savingOverlay.onContinue(() => {
      this.#stageActor.send({ type: 'next' });
    });

    this.#subscription = this.#stageActor.subscribe((state) => {
      if (state.matches('Saving score')) {
        this.show();
        // Simulate save completion (in real impl, this would be async)
        setTimeout(() => {
          this.#savingOverlay.showSaved();
          this.#canContinue = true;
        }, 500);
      } else {
        this.hide();
      }
    });

    this.#sizes = Sizes.getInstance();
    this.#onResize = () => this.#hudManager.updatePositions();
    this.#sizes.addEventListener('resize', this.#onResize);
  }

  private show() {
    this.#visible = true;
    this.#canContinue = false;
    this.#gamepadManager.lockAllInputFor(INPUT_TRANSITION_LOCKOUT_MS);
    this.#hudManager.show();
    this.#savingOverlay.reset();
  }

  private hide() {
    this.#visible = false;
    this.#canContinue = false;
    this.#hudManager.hide();
  }

  #handleInput() {
    if (!this.#canContinue) return;

    for (const playerId of [1, 2] as PlayerId[]) {
      const input = this.#gamepadManager.getInputSource(playerId);
      if (!input?.connected) continue;

      if (input.isButtonJustPressed('a')) {
        this.#savingOverlay.triggerContinue();
      }
    }
  }

  public update() {
    if (!this.#visible) return;

    this.#handleInput();
    this.#hudManager.update();
  }

  public dispose() {
    this.#subscription.unsubscribe();
    this.#sizes.removeEventListener('resize', this.#onResize);
    this.#hudManager.dispose();
  }
}
