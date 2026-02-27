import type { PerspectiveCamera } from 'three';
import type { Actor, AnyActorLogic, Subscription } from 'xstate';

import { HUDRegionManager } from '../hud/HUDRegionManager';
import { ScoreOverlayHUD } from '../hud/ScoreOverlayHUD';
import { GamepadManager, type PlayerId } from '../util/input/GamepadManager';
import { INPUT_TRANSITION_LOCKOUT_MS } from '../util/input/constants';
import { Sizes } from '../util/Sizes';

const ALLOWED_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';
const MAX_NAME_LENGTH = 12;

export class ScoreScreen {
  #stageActor: Actor<AnyActorLogic>;
  #subscription: Subscription;
  #gamepadManager: GamepadManager;

  #hudManager: HUDRegionManager;
  #scoreOverlay: ScoreOverlayHUD;
  #sizes: Sizes;
  #onResize: () => void;

  #visible = false;
  #charIndex = 0;
  #movementDebounceTime = 0;
  static readonly MOVEMENT_DEBOUNCE_MS = 150;

  constructor(stageActor: Actor<AnyActorLogic>, camera: PerspectiveCamera) {
    this.#stageActor = stageActor;
    this.#gamepadManager = GamepadManager.getInstance();

    this.#hudManager = new HUDRegionManager(camera);
    this.#scoreOverlay = new ScoreOverlayHUD();
    this.#hudManager.add('center', this.#scoreOverlay);
    this.#hudManager.hide();

    this.#scoreOverlay.onSave((name) => {
      this.#stageActor.send({ type: 'save', name: name || 'Anonymous' });
    });

    this.#scoreOverlay.onSkip(() => {
      this.#stageActor.send({ type: 'next' });
    });

    this.#subscription = this.#stageActor.subscribe((state) => {
      if (state.matches('Score')) {
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
    this.#gamepadManager.lockAllInputFor(INPUT_TRANSITION_LOCKOUT_MS);
    this.#hudManager.show();
    this.#scoreOverlay.reset();
    this.#charIndex = 0;
  }

  private hide() {
    this.#visible = false;
    this.#hudManager.hide();
  }

  #handleInput() {
    const now = Date.now();
    const canMove = now - this.#movementDebounceTime >= ScoreScreen.MOVEMENT_DEBOUNCE_MS;

    for (const playerId of [1, 2] as PlayerId[]) {
      const input = this.#gamepadManager.getInputSource(playerId);
      if (!input?.connected) continue;

      const movement = input.getMovement();

      // Up/Down to switch between save/skip (debounced for analog input)
      if (canMove && Math.abs(movement.z) > 0.5) {
        this.#movementDebounceTime = now;
        const current = this.#scoreOverlay.getSelectedOption();
        this.#scoreOverlay.setSelectedOption(current === 'save' ? 'skip' : 'save');
      }

      // Left/Right to cycle through characters (debounced for analog input)
      if (canMove && Math.abs(movement.x) > 0.5) {
        this.#movementDebounceTime = now;
        const name = this.#scoreOverlay.getPlayerName();
        const chars = name.split('');
        const currentChar = chars[this.#charIndex] || 'A';
        const currentIdx = ALLOWED_CHARS.indexOf(currentChar);

        let newIdx: number;
        if (movement.x > 0.5) {
          // Right - next char
          newIdx = (currentIdx + 1) % ALLOWED_CHARS.length;
        } else {
          // Left - prev char
          newIdx = (currentIdx - 1 + ALLOWED_CHARS.length) % ALLOWED_CHARS.length;
        }

        chars[this.#charIndex] = ALLOWED_CHARS[newIdx]!;
        this.#scoreOverlay.setPlayerName(chars.join(''));
      }

      // Primary button to confirm character / select option
      if (input.isButtonJustPressed('a')) {
        const option = this.#scoreOverlay.getSelectedOption();
        if (option === 'save') {
          const name = this.#scoreOverlay.getPlayerName();
          if (name.length < MAX_NAME_LENGTH) {
            // Add cursor and move to next char
            this.#charIndex++;
            if (this.#charIndex >= name.length) {
              this.#scoreOverlay.setPlayerName(name + 'A');
            }
          } else {
            // Max length reached, trigger save
            this.#scoreOverlay.triggerSave();
          }
        } else {
          this.#scoreOverlay.triggerSkip();
        }
      }

      // Secondary button to delete character or go back
      if (input.isButtonJustPressed('b')) {
        const name = this.#scoreOverlay.getPlayerName();
        if (name.length > 0 && this.#charIndex > 0) {
          this.#charIndex--;
          this.#scoreOverlay.setPlayerName(name.slice(0, -1));
        }
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
