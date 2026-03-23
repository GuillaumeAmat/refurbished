import type { PerspectiveCamera } from 'three';
import type { Actor, AnyActorLogic, Subscription } from 'xstate';

import { HUDRegionManager } from '../hud/HUDRegionManager';
import { TutorialOverlayHUD } from '../hud/TutorialOverlayHUD';
import { INPUT_TRANSITION_LOCKOUT_MS } from '../util/input/constants';
import { GamepadManager, type PlayerId } from '../util/input/GamepadManager';
import { Sizes } from '../util/Sizes';

export class TutorialScreen {
  #stageActor: Actor<AnyActorLogic>;
  #subscription: Subscription;
  #gamepadManager: GamepadManager;

  #hudManager: HUDRegionManager;
  #overlay: TutorialOverlayHUD;
  #sizes: Sizes;
  #camera: PerspectiveCamera;
  #onResize: () => void;

  #visible = false;
  #starting = false;
  #startDelay: ReturnType<typeof setTimeout> | null = null;
  static readonly LEVEL_START_DELAY_MS = 1000;

  constructor(stageActor: Actor<AnyActorLogic>, camera: PerspectiveCamera) {
    this.#stageActor = stageActor;
    this.#camera = camera;
    this.#gamepadManager = GamepadManager.getInstance();

    this.#hudManager = new HUDRegionManager(camera);

    const { visibleWidth, visibleHeight } = this.#computeFrustumBounds();
    this.#overlay = new TutorialOverlayHUD({ visibleWidth, visibleHeight });
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
    if (this.#starting) return;

    for (const playerId of [1, 2] as PlayerId[]) {
      const input = this.#gamepadManager.getInputSource(playerId);
      if (!input?.connected) continue;

      if (input.isButtonJustPressed('b') || input.isButtonJustPressed('start')) {
        this.#stageActor.send({ type: 'back' });
        return;
      }

      if (input.isButtonJustPressed('a')) {
        this.#starting = true;
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
