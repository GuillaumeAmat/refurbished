import type { PerspectiveCamera } from 'three';
import type { Actor, AnyActorLogic, Subscription } from 'xstate';

import { HUDRegionManager } from '../hud/HUDRegionManager';
import { LeaderboardOverlayHUD } from '../hud/LeaderboardOverlayHUD';
import { GamepadManager, type PlayerId } from '../util/input/GamepadManager';
import { Sizes } from '../util/Sizes';

export class LeaderboardScreen {
  #stageActor: Actor<AnyActorLogic>;
  #subscription: Subscription;
  #gamepadManager: GamepadManager;

  #hudManager: HUDRegionManager;
  #overlay: LeaderboardOverlayHUD;
  #sizes: Sizes;
  #onResize: () => void;

  #visible = false;
  #shownAt = 0;
  static readonly INPUT_COOLDOWN_MS = 200;

  constructor(stageActor: Actor<AnyActorLogic>, camera: PerspectiveCamera) {
    this.#stageActor = stageActor;
    this.#gamepadManager = GamepadManager.getInstance();

    this.#hudManager = new HUDRegionManager(camera);
    this.#overlay = new LeaderboardOverlayHUD();
    this.#hudManager.add('center', this.#overlay);
    this.#hudManager.hide();

    this.#subscription = this.#stageActor.subscribe((state) => {
      if (state.matches('Leaderboard')) {
        this.show();
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
    this.#shownAt = Date.now();
    this.#hudManager.show();
  }

  private hide() {
    this.#visible = false;
    this.#hudManager.hide();
  }

  #handleInput() {
    if (Date.now() - this.#shownAt < LeaderboardScreen.INPUT_COOLDOWN_MS) return;
    for (const playerId of [1, 2] as PlayerId[]) {
      const input = this.#gamepadManager.getInputSource(playerId);
      if (!input?.connected) continue;

      if (input.isButtonJustPressed('a') || input.isButtonJustPressed('start')) {
        this.#stageActor.send({ type: 'menu' });
        return;
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
