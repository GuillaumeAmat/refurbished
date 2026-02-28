import type { PerspectiveCamera } from 'three';
import type { Actor, AnyActorLogic, Subscription } from 'xstate';

import { HUDRegionManager } from '../hud/HUDRegionManager';
import { ScoreOverlayHUD } from '../hud/ScoreOverlayHUD';
import { ScoreManager } from '../state/ScoreManager';
import { INPUT_TRANSITION_LOCKOUT_MS } from '../util/input/constants';
import { GamepadManager, type PlayerId } from '../util/input/GamepadManager';
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
  #charIndices: Record<PlayerId, number> = { 1: 0, 2: 0 };
  #movementDebounceTime = 0;
  static readonly MOVEMENT_DEBOUNCE_MS = 150;

  constructor(stageActor: Actor<AnyActorLogic>, camera: PerspectiveCamera) {
    this.#stageActor = stageActor;
    this.#gamepadManager = GamepadManager.getInstance();

    this.#hudManager = new HUDRegionManager(camera);
    this.#scoreOverlay = new ScoreOverlayHUD();
    this.#hudManager.add('center', this.#scoreOverlay);
    this.#hudManager.hide();

    this.#scoreOverlay.onSave((player1, player2) => {
      const scoreManager = ScoreManager.getInstance();
      const p1 = player1 || 'Anonymous';
      const p2 = player2 || 'Anonymous';
      scoreManager.setPlayerName(1, p1);
      scoreManager.setPlayerName(2, p2);
      this.#stageActor.send({ type: 'save', player1: p1, player2: p2 });
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
    this.#charIndices = { 1: 0, 2: 0 };
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

      // Up/Down to switch between save/skip (shared, debounced)
      if (canMove && Math.abs(movement.z) > 0.5) {
        this.#movementDebounceTime = now;
        const current = this.#scoreOverlay.getSelectedOption();
        this.#scoreOverlay.setSelectedOption(current === 'save' ? 'skip' : 'save');
      }

      // Left/Right to cycle through characters (per-player, debounced)
      if (canMove && Math.abs(movement.x) > 0.5) {
        this.#movementDebounceTime = now;
        const name = this.#scoreOverlay.getPlayerName(playerId);
        const charIndex = this.#charIndices[playerId];
        const chars = name.split('');
        const currentChar = chars[charIndex] || 'A';
        const currentIdx = ALLOWED_CHARS.indexOf(currentChar);

        let newIdx: number;
        if (movement.x > 0.5) {
          newIdx = (currentIdx + 1) % ALLOWED_CHARS.length;
        } else {
          newIdx = (currentIdx - 1 + ALLOWED_CHARS.length) % ALLOWED_CHARS.length;
        }

        chars[charIndex] = ALLOWED_CHARS[newIdx]!;
        this.#scoreOverlay.setPlayerName(playerId, chars.join(''));
      }

      // Primary button to confirm character / select option
      if (input.isButtonJustPressed('a')) {
        const option = this.#scoreOverlay.getSelectedOption();
        if (option === 'save') {
          const name = this.#scoreOverlay.getPlayerName(playerId);
          if (name.length < MAX_NAME_LENGTH) {
            this.#charIndices[playerId]++;
            if (this.#charIndices[playerId] >= name.length) {
              this.#scoreOverlay.setPlayerName(playerId, name + 'A');
            }
          } else {
            this.#scoreOverlay.triggerSave();
          }
        } else {
          this.#scoreOverlay.triggerSkip();
        }
      }

      // Secondary button to delete character
      if (input.isButtonJustPressed('b')) {
        const name = this.#scoreOverlay.getPlayerName(playerId);
        if (name.length > 0 && this.#charIndices[playerId] > 0) {
          this.#charIndices[playerId]--;
          this.#scoreOverlay.setPlayerName(playerId, name.slice(0, -1));
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
