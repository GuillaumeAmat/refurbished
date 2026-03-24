import { Group, type Scene } from 'three';
import type { Actor, AnyActorLogic, Subscription } from 'xstate';

import { useRuntimeConfig } from '#app';

import { SESSION_GRACE_MS } from '../constants';
import { HUDRegionManager } from '../hud/HUDRegionManager';
import { OrderQueueHUD } from '../hud/OrderQueueHUD';
import { PointsHUD } from '../hud/PointsHUD';
import { TimeHUD } from '../hud/TimeHUD';
import type { LevelInfo } from '../levels';
import { ComboManager } from '../state/ComboManager';
import { OrderManager } from '../state/OrderManager';
import { ScoreManager } from '../state/ScoreManager';
import { SessionManager } from '../state/SessionManager';
import { Debug } from '../util/Debug';
import { GamepadManager, type PlayerId } from '../util/input/GamepadManager';
import { Sizes } from '../util/Sizes';
import type { Camera } from '../world/Camera';
import { Level } from '../world/Level';

// States where level background remains visible
const LEVEL_BACKGROUND_STATES = ['Level', 'Pause'];
// States where player interaction is enabled
const INTERACTIVE_STATES = ['Level'];

export class LevelScreen {
  #stageActor: Actor<AnyActorLogic>;
  #scene: Scene;
  #camera: Camera;
  #levelInfo: LevelInfo;
  #gamepadManager: GamepadManager;
  #subscription: Subscription;
  #sizes: Sizes;

  #group: Group;
  #level: Level | null = null;
  #hudManager: HUDRegionManager;
  #levelInitialized = false;
  #spawnDist: number;
  #sessionManager: SessionManager;
  #scoreManager: ScoreManager;
  #orderManager: OrderManager;
  #comboManager: ComboManager;
  #isInteractive = false;
  #frozen = false;
  #freezeTimeout: ReturnType<typeof setTimeout> | null = null;
  #timeHUD: TimeHUD;
  #sessionStarted = false;
  #graceTimeout: ReturnType<typeof setTimeout> | null = null;
  #graceRemaining = SESSION_GRACE_MS;
  #graceStartedAt = 0;

  // Bound listener references for cleanup
  #onGamepadDisconnected: () => void;
  #onControllersReadyChange: EventListener;
  #onResize: () => void;
  #onSessionEnded: () => void;

  constructor(stageActor: Actor<AnyActorLogic>, scene: Scene, camera: Camera, levelInfo: LevelInfo) {
    this.#stageActor = stageActor;
    this.#scene = scene;
    this.#camera = camera;
    this.#gamepadManager = GamepadManager.getInstance();
    this.#levelInfo = levelInfo;
    this.#spawnDist = levelInfo.spawnPositions[0]!.distanceTo(levelInfo.spawnPositions[1]!);

    this.#subscription = this.#stageActor.subscribe((state) => {
      const isBackgroundVisible = LEVEL_BACKGROUND_STATES.some((s) => state.matches(s));
      const isInteractive = INTERACTIVE_STATES.some((s) => state.matches(s));

      if (isBackgroundVisible) {
        this.show(isInteractive);
      } else {
        this.hide();
      }
    });

    this.#onGamepadDisconnected = () => {
      if (!this.#group.visible) return;
      if (!this.#isInteractive) return;

      const config = useRuntimeConfig();
      if (!config.public.keyboardFallbackEnabled) {
        this.#stageActor.send({ type: 'controllerDisconnected' });
      }
    };

    this.#onControllersReadyChange = ((event: CustomEvent) => {
      const { ready } = event.detail;
      const currentState = this.#stageActor.getSnapshot();

      if (ready && currentState.matches('Pause')) {
        this.#stageActor.send({ type: 'resume' });
      }
    }) as EventListener;

    this.#gamepadManager.addEventListener('gamepadDisconnected', this.#onGamepadDisconnected);
    this.#gamepadManager.addEventListener('controllersReadyChange', this.#onControllersReadyChange);

    this.#group = new Group();
    this.#group.visible = false;
    this.#scene.add(this.#group);

    this.#timeHUD = new TimeHUD();
    this.#hudManager = new HUDRegionManager(this.#camera.camera);
    this.#hudManager.add('topLeft', new OrderQueueHUD());
    this.#hudManager.add('bottomLeft', new PointsHUD());
    this.#hudManager.add('bottomRight', this.#timeHUD);
    this.#hudManager.hide();

    this.#sizes = Sizes.getInstance();
    this.#onResize = () => this.#hudManager.updatePositions();
    this.#sizes.addEventListener('resize', this.#onResize);

    this.#sessionManager = SessionManager.getInstance();
    this.#scoreManager = ScoreManager.getInstance();
    this.#orderManager = OrderManager.getInstance();
    this.#comboManager = ComboManager.getInstance();
    this.#onSessionEnded = () => {
      if (!this.#group.visible) return;
      this.#frozen = true;
      this.#level?.setInteractive(false);
      this.#orderManager.stop();
      this.#sessionManager.stop();
      this.#timeHUD.showTimesUp();

      this.#freezeTimeout = setTimeout(() => {
        this.#freezeTimeout = null;
        this.#stageActor.send({ type: 'end', score: this.#scoreManager.getScore() });
      }, 2000);
    };
    this.#sessionManager.addEventListener('sessionEnded', this.#onSessionEnded);
  }

  private async initLevel() {
    if (this.#levelInitialized) return;

    const config = useRuntimeConfig();

    const { characters } = this.#stageActor.getSnapshot().context;
    this.#level = new Level(this.#group, this.#scene, this.#levelInfo, characters);
    await this.#level.init();
    this.#level.setOnPhoneAssembled(() => this.#startSessionIfNeeded());

    if (config.public.onboardingEnabled) {
      this.#level.startOnboarding();
    }

    this.#levelInitialized = true;
  }

  private show(interactive: boolean) {
    const wasHidden = !this.#group.visible;

    this.#group.visible = true;
    this.#isInteractive = interactive;
    this.#level?.setInteractive(interactive);

    // Show game HUD only in interactive mode
    if (interactive) {
      this.#hudManager.show();
    } else {
      this.#hudManager.hide();
    }

    // Only reset/start session when freshly entering from hidden state
    if (wasHidden) {
      this.#frozen = false;
      this.#sessionStarted = false;
      this.#timeHUD.reset();
      this.#scoreManager.reset();
      void this.#requestSessionToken();
      this.#sessionManager.reset();
      this.#orderManager.reset();
      this.#comboManager.reset();
      this.#sessionManager.setSandbox(Debug.getInstance().active);
      this.#orderManager.start();
      this.#startGraceTimeout();
      this.initLevel();
    } else {
      if (interactive) {
        if (this.#sessionStarted) {
          this.#sessionManager.start();
        } else {
          this.#startGraceTimeout(this.#graceRemaining);
        }
        this.#orderManager.start();
      } else {
        // Pausing: track remaining grace time
        if (this.#graceTimeout) {
          const elapsed = performance.now() - this.#graceStartedAt;
          this.#graceRemaining = Math.max(0, this.#graceRemaining - elapsed);
          this.#clearGraceTimeout();
        }
        this.#sessionManager.stop();
        this.#orderManager.stop();
      }
    }
  }

  async #requestSessionToken(): Promise<void> {
    try {
      const res = await fetch('/api/game/session', { method: 'POST' });
      const { token } = await res.json();
      this.#scoreManager.setSessionToken(token);
    } catch {
      // graceful degradation
    }
  }

  #startSessionIfNeeded(): void {
    if (this.#sessionStarted) return;
    this.#sessionStarted = true;
    this.#clearGraceTimeout();
    this.#sessionManager.start();
  }

  #clearGraceTimeout(): void {
    if (this.#graceTimeout) {
      clearTimeout(this.#graceTimeout);
      this.#graceTimeout = null;
    }
  }

  #startGraceTimeout(ms: number = SESSION_GRACE_MS): void {
    this.#graceRemaining = ms;
    this.#graceStartedAt = performance.now();
    this.#graceTimeout = setTimeout(() => {
      this.#graceTimeout = null;
      this.#startSessionIfNeeded();
    }, ms);
  }

  private hide() {
    this.#group.visible = false;
    this.#isInteractive = false;
    this.#hudManager.hide();
    this.#clearGraceTimeout();
    this.#sessionManager.stop();
    this.#orderManager.stop();
    this.#level?.dispose();
    this.#level = null;
    this.#levelInitialized = false;
  }

  #checkPauseInput() {
    for (const playerId of [1, 2] as PlayerId[]) {
      const input = this.#gamepadManager.getInputSource(playerId);
      if (!input?.connected) continue;

      if (input.isButtonJustPressed('start')) {
        this.#stageActor.send({ type: 'pause' });
        return;
      }
    }
  }

  public update() {
    if (!this.#group.visible || !this.#levelInitialized) {
      this.#camera.setFollowTarget(null, 0);
      return;
    }

    // During freeze, only update HUD (for shake animation)
    if (this.#frozen) {
      this.#hudManager.update();
      return;
    }

    if (this.#isInteractive) {
      this.#checkPauseInput();
    }

    const config = useRuntimeConfig();
    const midpoint = config.public.cameraDynamicsEnabled ? (this.#level?.getPlayerMidpoint() ?? null) : null;
    const dist = config.public.cameraDynamicsEnabled ? (this.#level?.getPlayerDistance() ?? null) : null;
    const zoomFactor = dist !== null ? Math.max(-1, Math.min(1, (this.#spawnDist - dist) / this.#spawnDist)) : 0;
    this.#camera.setFollowTarget(midpoint, zoomFactor);

    this.#level?.update();
    this.#hudManager.update();
  }

  public dispose() {
    this.#clearGraceTimeout();
    if (this.#freezeTimeout) {
      clearTimeout(this.#freezeTimeout);
      this.#freezeTimeout = null;
    }
    this.#subscription.unsubscribe();
    this.#gamepadManager.removeEventListener('gamepadDisconnected', this.#onGamepadDisconnected);
    this.#gamepadManager.removeEventListener('controllersReadyChange', this.#onControllersReadyChange);
    this.#sizes.removeEventListener('resize', this.#onResize);
    this.#sessionManager.removeEventListener('sessionEnded', this.#onSessionEnded);

    // Clean up level if still active (e.g. Stage disposed while in-game)
    this.#level?.dispose();
    this.#level = null;

    this.#hudManager.dispose();
  }
}
