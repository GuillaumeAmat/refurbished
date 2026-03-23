import type { PerspectiveCamera } from 'three';
import type { Actor, AnyActorLogic, Subscription } from 'xstate';

import { HUDRegionManager } from '../hud/HUDRegionManager';
import { ScoreOverlayHUD } from '../hud/ScoreOverlayHUD';
import type { CharacterMap } from '../Stage.machine';
import { ScoreManager } from '../state/ScoreManager';
import { INPUT_TRANSITION_LOCKOUT_MS } from '../util/input/constants';
import { GamepadManager, type PlayerId } from '../util/input/GamepadManager';
import { Sizes } from '../util/Sizes';

const ALLOWED_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const PSEUDO_LENGTH = 3;

interface PlayerInputState {
  sideIndex: 0 | 1;
  letters: string[];
  cursorPos: number;
  ready: boolean;
}

export class ScoreScreen {
  #stageActor: Actor<AnyActorLogic>;
  #subscription: Subscription;
  #gamepadManager: GamepadManager;

  #hudManager: HUDRegionManager;
  #overlay: ScoreOverlayHUD;
  #sizes: Sizes;
  #camera: PerspectiveCamera;
  #onResize: () => void;

  #visible = false;
  #saving = false;
  #movementDebounceTime = 0;
  static readonly MOVEMENT_DEBOUNCE_MS = 150;

  #playerStates: Record<PlayerId, PlayerInputState> = {
    1: { sideIndex: 0, letters: [], cursorPos: 0, ready: false },
    2: { sideIndex: 1, letters: [], cursorPos: 0, ready: false },
  };

  constructor(stageActor: Actor<AnyActorLogic>, camera: PerspectiveCamera) {
    this.#stageActor = stageActor;
    this.#camera = camera;
    this.#gamepadManager = GamepadManager.getInstance();

    this.#hudManager = new HUDRegionManager(camera);

    const { visibleWidth, visibleHeight } = this.#computeFrustumBounds();
    this.#overlay = new ScoreOverlayHUD({ visibleWidth, visibleHeight });
    this.#hudManager.add('center', this.#overlay);
    this.#hudManager.hide();

    this.#subscription = this.#stageActor.subscribe((state) => {
      if (state.matches('Score')) {
        this.show(state.context.characters as CharacterMap);
      } else {
        this.hide();
      }
    });

    this.#sizes = Sizes.getInstance();
    this.#onResize = () => {
      this.#hudManager.updatePositions();
      const bounds = this.#computeFrustumBounds();
      this.#overlay.updateBounds(bounds.visibleWidth, bounds.visibleHeight);
    };
    this.#sizes.addEventListener('resize', this.#onResize);
  }

  #computeFrustumBounds() {
    const distance = HUDRegionManager.HUD_DISTANCE;
    const vFov = (this.#camera.fov * Math.PI) / 180;
    const visibleHeight = 2 * Math.tan(vFov / 2) * distance;
    const visibleWidth = visibleHeight * this.#camera.aspect;
    return { visibleWidth, visibleHeight };
  }

  private show(characters: CharacterMap) {
    this.#visible = true;
    this.#saving = false;
    this.#movementDebounceTime = 0;
    this.#gamepadManager.lockAllInputFor(INPUT_TRANSITION_LOCKOUT_MS);
    this.#hudManager.show();

    // Map players to sides: pig=left(0), croco=right(1)
    for (const playerId of [1, 2] as PlayerId[]) {
      const sideIndex = characters[playerId] === 'pig' ? 0 : 1;
      this.#playerStates[playerId] = {
        sideIndex: sideIndex as 0 | 1,
        letters: ['A'],
        cursorPos: 0,
        ready: false,
      };
      this.#updatePlayerVisuals(playerId);
    }
  }

  private hide() {
    this.#visible = false;
    this.#hudManager.hide();
  }

  #formatDisplay(letters: string[]): string {
    const display: string[] = [];
    for (let i = 0; i < PSEUDO_LENGTH; i++) {
      display.push(letters[i] ?? '_');
    }
    return display.join('');
  }

  #updatePlayerVisuals(playerId: PlayerId) {
    const state = this.#playerStates[playerId];
    this.#overlay.setPseudoDisplay(state.sideIndex, this.#formatDisplay(state.letters));
    this.#overlay.setCursorPosition(state.sideIndex, state.cursorPos);
    const pseudoComplete = state.letters.length === PSEUDO_LENGTH;
    this.#overlay.setConfirmVisible(state.sideIndex, pseudoComplete);
    this.#overlay.setSideReady(state.sideIndex, state.ready);
  }

  #handleInput() {
    const now = Date.now();
    const canMove = now - this.#movementDebounceTime >= ScoreScreen.MOVEMENT_DEBOUNCE_MS;

    for (const playerId of [1, 2] as PlayerId[]) {
      const input = this.#gamepadManager.getInputSource(playerId);
      if (!input?.connected) continue;

      const ps = this.#playerStates[playerId];

      if (ps.ready) {
        // B cancels ready
        if (input.isButtonJustPressed('b') || input.isButtonJustPressed('start')) {
          ps.ready = false;
          this.#updatePlayerVisuals(playerId);
        }
        continue;
      }

      // Up/down to cycle letter at current cursor position
      if (canMove) {
        const movement = input.getMovement();
        if (Math.abs(movement.z) > 0.5) {
          this.#movementDebounceTime = now;

          // If no letter at cursor yet, start with 'A'
          if (ps.cursorPos >= ps.letters.length) {
            ps.letters.push('A');
          } else {
            const currentChar = ps.letters[ps.cursorPos]!;
            const currentIdx = ALLOWED_CHARS.indexOf(currentChar);
            let newIdx: number;
            if (movement.z < -0.5) {
              // Up = next letter
              newIdx = (currentIdx + 1) % ALLOWED_CHARS.length;
            } else {
              // Down = prev letter
              newIdx = (currentIdx - 1 + ALLOWED_CHARS.length) % ALLOWED_CHARS.length;
            }
            ps.letters[ps.cursorPos] = ALLOWED_CHARS[newIdx]!;
          }
          this.#updatePlayerVisuals(playerId);
        }
      }

      // A: advance cursor or confirm
      if (input.isButtonJustPressed('a')) {
        if (ps.cursorPos < ps.letters.length) {
          if (ps.letters.length === PSEUDO_LENGTH && ps.cursorPos === PSEUDO_LENGTH - 1) {
            // All 3 letters filled, A validates
            ps.ready = true;
            this.#updatePlayerVisuals(playerId);

            // Check if both ready
            if (this.#overlay.areBothReady() && !this.#saving) {
              this.#triggerSave();
            }
          } else {
            // Advance to next slot
            ps.cursorPos++;
            this.#updatePlayerVisuals(playerId);
          }
        }
      }

      // B: undo letters or skip
      if (input.isButtonJustPressed('b') || input.isButtonJustPressed('start')) {
        if (ps.letters.length > 0) {
          // Remove last letter, move cursor back
          ps.letters.pop();
          ps.cursorPos = Math.min(ps.cursorPos, Math.max(0, ps.letters.length - 1));
          if (ps.letters.length === 0) ps.cursorPos = 0;
          this.#updatePlayerVisuals(playerId);
        } else {
          // Empty pseudo → skip to leaderboard
          this.#stageActor.send({ type: 'next' });
          return;
        }
      }
    }
  }

  async #triggerSave() {
    this.#saving = true;
    const scoreManager = ScoreManager.getInstance();

    for (const playerId of [1, 2] as PlayerId[]) {
      const name = this.#playerStates[playerId].letters.join('') || 'Anonymous';
      scoreManager.setPlayerName(playerId, name);
    }

    this.#gamepadManager.lockAllInputFor(10_000);

    const { player1, player2 } = scoreManager.getPlayerNames();
    const token = scoreManager.getSessionToken();

    await scoreManager.flushEvents();

    try {
      await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player1, player2, token }),
      });
    } catch {
      // Fail silently
    }

    this.#stageActor.send({ type: 'next' });
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
