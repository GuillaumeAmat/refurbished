import type { PerspectiveCamera } from 'three';
import type { Actor, AnyActorLogic, Subscription } from 'xstate';

import { HUDRegionManager } from '../hud/HUDRegionManager';
import { WaitingOverlayHUD } from '../hud/WaitingOverlayHUD';
import { GamepadManager, type PlayerId } from '../util/input/GamepadManager';
import { Sizes } from '../util/Sizes';

export class WaitingScreen {
  #stageActor: Actor<AnyActorLogic>;
  #subscription: Subscription;
  #gamepadManager: GamepadManager;

  #hudManager: HUDRegionManager;
  #overlay: WaitingOverlayHUD;
  #sizes: Sizes;
  #onResize: () => void;

  #visible = false;

  // Bound listener references for cleanup
  #onControllersReadyChange: () => void;
  #onGamepadAssigned: () => void;
  #onGamepadReconnected: () => void;
  #onGamepadDisconnected: () => void;

  constructor(stageActor: Actor<AnyActorLogic>, camera: PerspectiveCamera) {
    this.#stageActor = stageActor;
    this.#gamepadManager = GamepadManager.getInstance();

    this.#hudManager = new HUDRegionManager(camera);
    this.#overlay = new WaitingOverlayHUD();
    this.#hudManager.add('center', this.#overlay);
    this.#hudManager.hide();

    this.#subscription = this.#stageActor.subscribe((state) => {
      if (state.matches('WaitingForControllers')) {
        this.show();
      } else {
        this.hide();
      }
    });

    this.#onControllersReadyChange = () => {
      this.updateStatus();
      if (this.#gamepadManager.areControllersReady()) {
        this.#stageActor.send({ type: 'controllersReady' });
      }
    };
    this.#onGamepadAssigned = () => this.updateStatus();
    this.#onGamepadReconnected = () => this.updateStatus();
    this.#onGamepadDisconnected = () => this.updateStatus();

    this.#gamepadManager.addEventListener('controllersReadyChange', this.#onControllersReadyChange);
    this.#gamepadManager.addEventListener('gamepadAssigned', this.#onGamepadAssigned);
    this.#gamepadManager.addEventListener('gamepadReconnected', this.#onGamepadReconnected);
    this.#gamepadManager.addEventListener('gamepadDisconnected', this.#onGamepadDisconnected);

    this.#sizes = Sizes.getInstance();
    this.#onResize = () => this.#hudManager.updatePositions();
    this.#sizes.addEventListener('resize', this.#onResize);
  }

  private updateStatus() {
    const status = this.#gamepadManager.getConnectionStatus();
    this.#overlay.updateStatus(status.player1, status.player2);
  }

  private show() {
    this.#visible = true;
    this.#hudManager.show();
    this.updateStatus();

    if (this.#gamepadManager.areControllersReady()) {
      this.#stageActor.send({ type: 'controllersReady' });
    }
  }

  private hide() {
    this.#visible = false;
    this.#hudManager.hide();
  }

  #handleInput() {
    for (const playerId of [1, 2] as PlayerId[]) {
      const input = this.#gamepadManager.getInputSource(playerId);
      if (!input?.connected) continue;

      if (input.isButtonJustPressed('b') || input.isButtonJustPressed('start')) {
        this.#stageActor.send({ type: 'back' });
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
    this.#gamepadManager.removeEventListener('controllersReadyChange', this.#onControllersReadyChange);
    this.#gamepadManager.removeEventListener('gamepadAssigned', this.#onGamepadAssigned);
    this.#gamepadManager.removeEventListener('gamepadReconnected', this.#onGamepadReconnected);
    this.#gamepadManager.removeEventListener('gamepadDisconnected', this.#onGamepadDisconnected);
    this.#sizes.removeEventListener('resize', this.#onResize);
    this.#hudManager.dispose();
  }
}
