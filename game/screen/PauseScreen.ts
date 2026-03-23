import type { PerspectiveCamera } from 'three';
import type { Actor, AnyActorLogic, Subscription } from 'xstate';

import { HUDRegionManager } from '../hud/HUDRegionManager';
import { PauseOverlayHUD } from '../hud/PauseOverlayHUD';
import { INPUT_TRANSITION_LOCKOUT_MS } from '../util/input/constants';
import { GamepadManager, type PlayerId } from '../util/input/GamepadManager';
import { Sizes } from '../util/Sizes';

export class PauseScreen {
  #stageActor: Actor<AnyActorLogic>;
  #subscription: Subscription;
  #gamepadManager: GamepadManager;

  #hudManager: HUDRegionManager;
  #pauseOverlay: PauseOverlayHUD;
  #sizes: Sizes;
  #camera: PerspectiveCamera;
  #onResize: () => void;

  #visible = false;
  #movementDebounceTime = 0;
  static readonly MOVEMENT_DEBOUNCE_MS = 150;

  constructor(stageActor: Actor<AnyActorLogic>, camera: PerspectiveCamera) {
    this.#stageActor = stageActor;
    this.#camera = camera;
    this.#gamepadManager = GamepadManager.getInstance();

    this.#hudManager = new HUDRegionManager(camera);
    const { visibleWidth, visibleHeight } = this.#computeFrustumBounds();
    this.#pauseOverlay = new PauseOverlayHUD({ visibleWidth, visibleHeight });
    this.#hudManager.add('center', this.#pauseOverlay);
    this.#hudManager.hide();

    this.#pauseOverlay.onResume(() => {
      this.#stageActor.send({ type: 'resume' });
    });

    this.#pauseOverlay.onQuit(() => {
      this.#stageActor.send({ type: 'quit' });
    });

    this.#subscription = this.#stageActor.subscribe((state) => {
      if (state.matches('Pause')) {
        this.show();
      } else {
        this.hide();
      }
    });

    this.#sizes = Sizes.getInstance();
    this.#onResize = () => {
      this.#hudManager.updatePositions();
      const bounds = this.#computeFrustumBounds();
      this.#pauseOverlay.updateBounds(bounds.visibleWidth, bounds.visibleHeight);
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
    this.#gamepadManager.lockAllInputFor(INPUT_TRANSITION_LOCKOUT_MS);
    this.#hudManager.show();
    this.#pauseOverlay.reset();
  }

  private hide() {
    this.#visible = false;
    this.#hudManager.hide();
  }

  #handleInput() {
    const now = Date.now();

    for (const playerId of [1, 2] as PlayerId[]) {
      const input = this.#gamepadManager.getInputSource(playerId);
      if (!input?.connected) continue;

      const movement = input.getMovement();

      // Left/Right to switch between resume/quit (debounced for analog input)
      if (Math.abs(movement.x) > 0.5 && now - this.#movementDebounceTime >= PauseScreen.MOVEMENT_DEBOUNCE_MS) {
        this.#movementDebounceTime = now;
        const current = this.#pauseOverlay.getSelectedOption();
        this.#pauseOverlay.setSelectedOption(current === 'resume' ? 'quit' : 'resume');
      }

      // Primary button to confirm
      if (input.isButtonJustPressed('a')) {
        const option = this.#pauseOverlay.getSelectedOption();
        if (option === 'resume') {
          this.#pauseOverlay.triggerResume();
        } else {
          this.#pauseOverlay.triggerQuit();
        }
      }

      // B or Start to quick-resume
      if (input.isButtonJustPressed('b') || input.isButtonJustPressed('start')) {
        this.#pauseOverlay.triggerResume();
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
