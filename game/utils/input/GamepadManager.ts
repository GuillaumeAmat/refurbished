import { InputController } from '../InputController';
import { GamepadController } from './GamepadController';
import type { InputSource } from './InputSource';
import { type ControllerProfile, LogitechProfile, PS4Profile, XboxProfile } from './profiles';

export type PlayerId = 1 | 2;

interface PlayerAssignment {
  playerId: PlayerId;
  controller: GamepadController;
}

export class GamepadManager extends EventTarget {
  static #instance: GamepadManager | null = null;

  #profiles: ControllerProfile[] = [LogitechProfile, XboxProfile, PS4Profile];
  #assignments = new Map<PlayerId, PlayerAssignment>();
  #keyboardFallback: InputController | null = null;

  private constructor() {
    super();
    this.#setupEventListeners();
    this.#scanConnectedGamepads();

    // Start rAF loop - required for Firefox to fire gamepadconnected on pre-plugged gamepads
    this.#startPolling();

    // Enable keyboard as fallback for player 1
    this.enableKeyboardFallback();
  }

  #rafId: number | null = null;

  static getInstance(): GamepadManager {
    if (!GamepadManager.#instance) {
      GamepadManager.#instance = new GamepadManager();
    }
    return GamepadManager.#instance;
  }

  #setupEventListeners(): void {
    window.addEventListener('gamepadconnected', (e) => this.#onGamepadConnected(e));
    window.addEventListener('gamepaddisconnected', (e) => this.#onGamepadDisconnected(e));
  }

  #startPolling(): void {
    const poll = () => {
      this.#scanConnectedGamepads();
      this.#rafId = requestAnimationFrame(poll);
    };
    poll();
  }

  #scanConnectedGamepads(): void {
    const gamepads = navigator.getGamepads();
    for (const gamepad of gamepads) {
      if (gamepad) {
        // Skip if this gamepad index is already assigned
        const alreadyAssigned = Array.from(this.#assignments.values()).some(
          (assignment) => assignment.controller.getGamepadIndex() === gamepad.index,
        );
        if (alreadyAssigned) continue;

        this.#assignGamepad(gamepad);
      }
    }
  }

  #detectProfile(gamepad: Gamepad): ControllerProfile {
    for (const profile of this.#profiles) {
      if (profile.matchPatterns.some((p) => p.test(gamepad.id))) {
        return profile;
      }
    }
    return LogitechProfile;
  }

  #assignGamepad(gamepad: Gamepad): void {
    const profile = this.#detectProfile(gamepad);
    let availableSlot = this.#getFirstAvailableSlot();

    // If no slot available, try to replace a disconnected controller
    if (!availableSlot) {
      availableSlot = this.#getDisconnectedSlot();
    }

    if (availableSlot) {
      const controller = new GamepadController(gamepad.index, profile);
      this.#assignments.set(availableSlot, {
        playerId: availableSlot,
        controller,
      });
      this.dispatchEvent(
        new CustomEvent('gamepadAssigned', {
          detail: { playerId: availableSlot, gamepad },
        }),
      );
    }

    this.#checkControllersReady();
  }

  #onGamepadConnected(event: GamepadEvent): void {
    this.#assignGamepad(event.gamepad);
  }

  #onGamepadDisconnected(event: GamepadEvent): void {
    const gamepad = event.gamepad;

    for (const [playerId, assignment] of this.#assignments) {
      if (assignment.controller.getGamepadIndex() === gamepad.index) {
        assignment.controller.setConnected(false);
        this.dispatchEvent(
          new CustomEvent('gamepadDisconnected', {
            detail: { playerId, gamepad },
          }),
        );
        break;
      }
    }

    this.#checkControllersReady();
  }

  #getFirstAvailableSlot(): PlayerId | null {
    // If keyboard fallback is enabled, reserve slot 1 for keyboard, assign gamepads to slot 2 first
    if (this.#keyboardFallback) {
      if (!this.#assignments.has(2)) return 2;
      if (!this.#assignments.has(1)) return 1;
    } else {
      if (!this.#assignments.has(1)) return 1;
      if (!this.#assignments.has(2)) return 2;
    }
    return null;
  }

  #getDisconnectedSlot(): PlayerId | null {
    // Prefer slot 2 first if keyboard fallback is enabled
    if (this.#keyboardFallback) {
      const slot2 = this.#assignments.get(2);
      if (slot2 && !slot2.controller.connected) return 2;
      const slot1 = this.#assignments.get(1);
      if (slot1 && !slot1.controller.connected) return 1;
    } else {
      const slot1 = this.#assignments.get(1);
      if (slot1 && !slot1.controller.connected) return 1;
      const slot2 = this.#assignments.get(2);
      if (slot2 && !slot2.controller.connected) return 2;
    }
    return null;
  }

  #checkControllersReady(): void {
    const ready = this.areControllersReady();
    this.dispatchEvent(new CustomEvent('controllersReadyChange', { detail: { ready } }));
  }

  areControllersReady(): boolean {
    const p1 = this.getInputSource(1);
    const p2 = this.getInputSource(2);
    return (p1?.connected ?? false) && (p2?.connected ?? false);
  }

  getInputSource(playerId: PlayerId): InputSource | null {
    const assignment = this.#assignments.get(playerId);

    // Player 1 uses keyboard if no gamepad assigned or gamepad disconnected
    if (playerId === 1 && this.#keyboardFallback) {
      if (!assignment || !assignment.controller.connected) {
        return this.#keyboardFallback;
      }
    }

    return assignment?.controller ?? null;
  }

  enableKeyboardFallback(): void {
    if (!this.#keyboardFallback) {
      this.#keyboardFallback = new InputController();
    }
    this.#checkControllersReady();
  }

  disableKeyboardFallback(): void {
    this.#keyboardFallback?.cleanup();
    this.#keyboardFallback = null;
    this.#checkControllersReady();
  }

  getConnectionStatus(): { player1: boolean; player2: boolean } {
    return {
      player1: this.getInputSource(1)?.connected ?? false,
      player2: this.getInputSource(2)?.connected ?? false,
    };
  }

  update(): void {
    for (const assignment of this.#assignments.values()) {
      if (assignment.controller.connected) {
        assignment.controller.pollButtons();
      }
    }
  }

  cleanup(): void {
    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
    this.#assignments.forEach((a) => a.controller.cleanup());
    this.#keyboardFallback?.cleanup();
    this.#assignments.clear();
  }
}
