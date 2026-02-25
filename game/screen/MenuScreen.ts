import type { PerspectiveCamera } from 'three';
import type { Actor, AnyActorLogic, Subscription } from 'xstate';

import { HUDRegionManager } from '../hud/HUDRegionManager';
import { MenuOverlayHUD } from '../hud/MenuOverlayHUD';
import { GamepadManager, type PlayerId } from '../util/input/GamepadManager';
import { Sizes } from '../util/Sizes';

export class MenuScreen {
  #stageActor: Actor<AnyActorLogic>;
  #subscription: Subscription;
  #gamepadManager: GamepadManager;

  #hudManager: HUDRegionManager;
  #overlay: MenuOverlayHUD;
  #sizes: Sizes;
  #onResize: () => void;

  #visible = false;
  #shownAt = 0;
  #movementDebounceTime = 0;
  static readonly MOVEMENT_DEBOUNCE_MS = 200;
  static readonly INPUT_COOLDOWN_MS = 200;

  constructor(stageActor: Actor<AnyActorLogic>, camera: PerspectiveCamera) {
    this.#stageActor = stageActor;
    this.#gamepadManager = GamepadManager.getInstance();

    this.#hudManager = new HUDRegionManager(camera);
    this.#overlay = new MenuOverlayHUD();
    this.#hudManager.add('center', this.#overlay);
    this.#hudManager.hide();

    this.#subscription = this.#stageActor.subscribe((state) => {
      if (state.matches('Menu')) {
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
    const now = Date.now();
    if (now - this.#shownAt < MenuScreen.INPUT_COOLDOWN_MS) return;
    const canMove = now - this.#movementDebounceTime >= MenuScreen.MOVEMENT_DEBOUNCE_MS;

    for (const playerId of [1, 2] as PlayerId[]) {
      const input = this.#gamepadManager.getInputSource(playerId);
      if (!input?.connected) continue;

      if (canMove) {
        const movement = input.getMovement();
        if (Math.abs(movement.x) > 0.5 || Math.abs(movement.z) > 0.5) {
          this.#movementDebounceTime = now;
          const next = this.#overlay.getSelectedOption() === 'play' ? 'leaderboard' : 'play';
          this.#overlay.setSelectedOption(next);
        }
      }

      if (input.isButtonJustPressed('a')) {
        const selected = this.#overlay.getSelectedOption();
        this.#stageActor.send({ type: selected });
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
