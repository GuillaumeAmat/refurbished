import type { PerspectiveCamera } from 'three';
import type { Actor, AnyActorLogic, Subscription } from 'xstate';

import { CharacterSelectOverlayHUD } from '../hud/CharacterSelectOverlayHUD';
import { HUDRegionManager } from '../hud/HUDRegionManager';
import { INPUT_TRANSITION_LOCKOUT_MS } from '../util/input/constants';
import { GamepadManager, type PlayerId } from '../util/input/GamepadManager';
import { Sizes } from '../util/Sizes';

export class CharacterSelectScreen {
  #stageActor: Actor<AnyActorLogic>;
  #subscription: Subscription;
  #gamepadManager: GamepadManager;

  #hudManager: HUDRegionManager;
  #overlay: CharacterSelectOverlayHUD;
  #sizes: Sizes;
  #camera: PerspectiveCamera;
  #onResize: () => void;

  #visible = false;
  #movementDebounceTime = 0;
  static readonly MOVEMENT_DEBOUNCE_MS = 200;

  constructor(stageActor: Actor<AnyActorLogic>, camera: PerspectiveCamera) {
    this.#stageActor = stageActor;
    this.#camera = camera;
    this.#gamepadManager = GamepadManager.getInstance();

    this.#hudManager = new HUDRegionManager(camera);

    const { visibleWidth, visibleHeight } = this.#computeFrustumBounds();
    this.#overlay = new CharacterSelectOverlayHUD({ visibleWidth, visibleHeight });
    this.#hudManager.add('center', this.#overlay);
    this.#hudManager.hide();

    this.#subscription = this.#stageActor.subscribe((state) => {
      if (state.matches('Character Select')) {
        this.show();
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

  private show() {
    this.#visible = true;
    this.#movementDebounceTime = 0;
    this.#gamepadManager.lockAllInputFor(INPUT_TRANSITION_LOCKOUT_MS);
    this.#hudManager.show();
  }

  private hide() {
    this.#visible = false;
    this.#hudManager.hide();
  }

  #handleInput() {
    const now = Date.now();
    const canMove = now - this.#movementDebounceTime >= CharacterSelectScreen.MOVEMENT_DEBOUNCE_MS;
    let anyBBackToMenu = false;

    for (const playerId of [1, 2] as PlayerId[]) {
      const input = this.#gamepadManager.getInputSource(playerId);
      if (!input?.connected) continue;

      const playerState = this.#overlay.getPlayerState(playerId);

      const bPressed = input.isButtonJustPressed('b') || input.isButtonJustPressed('start');

      if (playerState.ready) {
        // B/Esc cancels ready (overrides global back-to-menu)
        if (bPressed) {
          this.#overlay.setPlayerReady(playerId, false);
        }
        continue;
      }

      // Movement: left/right (go to center first if changing from a side)
      if (canMove) {
        const movement = input.getMovement();
        if (movement.x < -0.5) {
          this.#movementDebounceTime = now;
          if (playerState.choice === 'right') {
            this.#overlay.clearPlayerChoice(playerId);
          } else if (playerState.choice === null) {
            this.#overlay.setPlayerChoice(playerId, 'left');
          }
        } else if (movement.x > 0.5) {
          this.#movementDebounceTime = now;
          if (playerState.choice === 'left') {
            this.#overlay.clearPlayerChoice(playerId);
          } else if (playerState.choice === null) {
            this.#overlay.setPlayerChoice(playerId, 'right');
          }
        }
      }

      // B/Esc → back to menu (only if not ready, checked above via continue)
      if (bPressed) {
        anyBBackToMenu = true;
      }

      // A → confirm if choice made
      if (input.isButtonJustPressed('a') && playerState.choice !== null) {
        this.#overlay.setPlayerReady(playerId, true);
      }
    }

    if (anyBBackToMenu) {
      this.#stageActor.send({ type: 'back' });
      return;
    }

    // Both ready → proceed
    if (this.#overlay.areBothReady()) {
      this.#stageActor.send({ type: 'play' });
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
