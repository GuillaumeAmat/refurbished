import type { PerspectiveCamera } from 'three';
import type { Actor, AnyActorLogic, Subscription } from 'xstate';

import { HUDRegionManager } from '../hud/HUDRegionManager';
import { TutorialOverlayHUD } from '../hud/TutorialOverlayHUD';
import { GamepadManager, type PlayerId } from '../util/input/GamepadManager';
import { INPUT_TRANSITION_LOCKOUT_MS } from '../util/input/constants';
import { Sizes } from '../util/Sizes';
import { SoundManager } from '../util/SoundManager';

export class TutorialScreen {
  #stageActor: Actor<AnyActorLogic>;
  #subscription: Subscription;
  #gamepadManager: GamepadManager;

  #hudManager: HUDRegionManager;
  #overlay: TutorialOverlayHUD;
  #sizes: Sizes;
  #onResize: () => void;

  #visible = false;
  #starting = false;
  #startDelay: ReturnType<typeof setTimeout> | null = null;
  #movementDebounceTime = 0;
  static readonly MOVEMENT_DEBOUNCE_MS = 200;
  static readonly LEVEL_START_DELAY_MS = 1000;

  constructor(stageActor: Actor<AnyActorLogic>, camera: PerspectiveCamera) {
    this.#stageActor = stageActor;
    this.#gamepadManager = GamepadManager.getInstance();

    this.#hudManager = new HUDRegionManager(camera);
    this.#overlay = new TutorialOverlayHUD();
    this.#hudManager.add('center', this.#overlay);
    this.#hudManager.hide();

    this.#subscription = this.#stageActor.subscribe((state) => {
      if (state.matches('Tutorial')) {
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
    this.#movementDebounceTime = 0;
    this.#gamepadManager.lockAllInputFor(INPUT_TRANSITION_LOCKOUT_MS);
    this.#hudManager.show();
  }

  private hide() {
    this.#visible = false;
    this.#starting = false;
    if (this.#startDelay !== null) {
      clearTimeout(this.#startDelay);
      this.#startDelay = null;
    }
    this.#hudManager.hide();
  }

  #handleInput() {
    const now = Date.now();
    if (this.#starting) return;
    const canMove = now - this.#movementDebounceTime >= TutorialScreen.MOVEMENT_DEBOUNCE_MS;

    for (const playerId of [1, 2] as PlayerId[]) {
      const input = this.#gamepadManager.getInputSource(playerId);
      if (!input?.connected) continue;

      if (canMove) {
        const movement = input.getMovement();
        if (Math.abs(movement.z) > 0.5) {
          this.#movementDebounceTime = now;
          const next = this.#overlay.getSelectedOption() === 'start' ? 'menu' : 'start';
          this.#overlay.setSelectedOption(next);
        }
      }

      if (input.isButtonJustPressed('b') || input.isButtonJustPressed('start')) {
        this.#stageActor.send({ type: 'back' });
        return;
      }

      if (input.isButtonJustPressed('a')) {
        const selected = this.#overlay.getSelectedOption();
        if (selected === 'menu') {
          this.#stageActor.send({ type: 'back' });
          return;
        }
        this.#starting = true;
        const sm = SoundManager.getInstance();
        sm.stopTrack('menuTrack');
        sm.playSound('selectSound');
        this.#startDelay = setTimeout(() => {
          this.#stageActor.send({ type: 'play' });
        }, TutorialScreen.LEVEL_START_DELAY_MS);
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
    if (this.#startDelay !== null) {
      clearTimeout(this.#startDelay);
      this.#startDelay = null;
    }
    this.#subscription.unsubscribe();
    this.#sizes.removeEventListener('resize', this.#onResize);
    this.#hudManager.dispose();
  }
}
