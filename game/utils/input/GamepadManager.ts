import { InputController } from '../InputController';
import { GamepadController } from './GamepadController';
import type { InputSource } from './InputSource';
import {
  type ControllerProfile,
  LogitechProfile,
  PS4Profile,
  XboxProfile,
} from './profiles';

export type PlayerId = 1 | 2;

interface PlayerAssignment {
  playerId: PlayerId;
  gamepadId: string;
  controller: GamepadController;
}

export class GamepadManager extends EventTarget {
  static #instance: GamepadManager | null = null;

  #profiles: ControllerProfile[] = [LogitechProfile, XboxProfile, PS4Profile];
  #assignments = new Map<PlayerId, PlayerAssignment>();
  #keyboardFallback: InputController | null = null;
  #knownGamepadIds = new Map<string, PlayerId>();

  private constructor() {
    super();
    this.#setupEventListeners();
    this.#scanConnectedGamepads();

    // Poll for gamepads - browser requires button press before gamepad is visible
    this.#pollInterval = window.setInterval(() => this.#scanConnectedGamepads(), 500);

    // Enable keyboard as fallback for player 1
    this.enableKeyboardFallback();
  }

  #pollInterval: number | null = null;

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

  #scanConnectedGamepads(): void {
    const gamepads = navigator.getGamepads();
    for (const gamepad of gamepads) {
      if (gamepad) {
        const gamepadId = this.#generateGamepadId(gamepad);
        // Skip if already assigned
        const existingPlayerId = this.#knownGamepadIds.get(gamepadId);
        if (existingPlayerId !== undefined) {
          const assignment = this.#assignments.get(existingPlayerId);
          if (assignment?.controller.connected) continue;
        }
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

  #generateGamepadId(gamepad: Gamepad): string {
    return gamepad.id;
  }

  #assignGamepad(gamepad: Gamepad): void {
    const gamepadId = this.#generateGamepadId(gamepad);
    const profile = this.#detectProfile(gamepad);
    const previousPlayerId = this.#knownGamepadIds.get(gamepadId);

    if (previousPlayerId !== undefined) {
      const existing = this.#assignments.get(previousPlayerId);
      if (existing) {
        existing.controller.setConnected(true);
        existing.controller.updateIndex(gamepad.index);
        this.dispatchEvent(
          new CustomEvent('gamepadReconnected', {
            detail: { playerId: previousPlayerId, gamepad },
          }),
        );
      } else {
        const controller = new GamepadController(gamepad.index, profile);
        this.#assignments.set(previousPlayerId, {
          playerId: previousPlayerId,
          gamepadId,
          controller,
        });
        this.dispatchEvent(
          new CustomEvent('gamepadReconnected', {
            detail: { playerId: previousPlayerId, gamepad },
          }),
        );
      }
    } else {
      const availableSlot = this.#getFirstAvailableSlot();
      if (availableSlot) {
        const controller = new GamepadController(gamepad.index, profile);
        this.#assignments.set(availableSlot, {
          playerId: availableSlot,
          gamepadId,
          controller,
        });
        this.#knownGamepadIds.set(gamepadId, availableSlot);
        this.dispatchEvent(
          new CustomEvent('gamepadAssigned', {
            detail: { playerId: availableSlot, gamepad },
          }),
        );
      }
    }

    this.#checkControllersReady();
  }

  #onGamepadConnected(event: GamepadEvent): void {
    this.#assignGamepad(event.gamepad);
  }

  #onGamepadDisconnected(event: GamepadEvent): void {
    const gamepad = event.gamepad;
    const gamepadId = this.#generateGamepadId(gamepad);

    for (const [playerId, assignment] of this.#assignments) {
      if (assignment.gamepadId === gamepadId) {
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
    if (this.#pollInterval) {
      clearInterval(this.#pollInterval);
      this.#pollInterval = null;
    }
    this.#assignments.forEach((a) => a.controller.cleanup());
    this.#keyboardFallback?.cleanup();
    this.#assignments.clear();
  }
}
