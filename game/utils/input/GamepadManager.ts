import { GamepadController } from './GamepadController';
import type { InputSource } from './InputSource';
import { KeyboardController } from './KeyboardController';
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
  #keyboardPlayer1: KeyboardController | null = null;
  #keyboardPlayer2: KeyboardController | null = null;

  private constructor() {
    super();
    this.#setupEventListeners();
    this.#scanConnectedGamepads();

    // Start rAF loop - required for Firefox to fire gamepadconnected on pre-plugged gamepads
    this.#startPolling();
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
    if (!this.#assignments.has(1)) return 1;
    if (!this.#assignments.has(2)) return 2;
    return null;
  }

  #getDisconnectedSlot(): PlayerId | null {
    const slot1 = this.#assignments.get(1);
    if (slot1 && !slot1.controller.connected) return 1;
    const slot2 = this.#assignments.get(2);
    if (slot2 && !slot2.controller.connected) return 2;
    return null;
  }

  #checkControllersReady(): void {
    const ready = this.areControllersReady();
    this.dispatchEvent(new CustomEvent('controllersReadyChange', { detail: { ready } }));
  }

  areControllersReady(): boolean {
    // Always ready when keyboards enabled
    if (this.#keyboardPlayer1 && this.#keyboardPlayer2) {
      return true;
    }

    // Otherwise require 2 connected gamepads
    const p1 = this.getInputSource(1);
    const p2 = this.getInputSource(2);
    return (p1?.connected ?? false) && (p2?.connected ?? false);
  }

  getInputSource(playerId: PlayerId): InputSource | null {
    const assignment = this.#assignments.get(playerId);
    const gamepad = assignment?.controller;

    // Priority: gamepad → keyboard → null
    if (gamepad?.connected) return gamepad;

    if (playerId === 1) return this.#keyboardPlayer1;
    if (playerId === 2) return this.#keyboardPlayer2;

    return null;
  }

  enableKeyboards(): void {
    if (!this.#keyboardPlayer1) {
      this.#keyboardPlayer1 = new KeyboardController('player1');
    }
    if (!this.#keyboardPlayer2) {
      this.#keyboardPlayer2 = new KeyboardController('player2');
    }
    this.#checkControllersReady();
  }

  disableKeyboards(): void {
    this.#keyboardPlayer1?.cleanup();
    this.#keyboardPlayer2?.cleanup();
    this.#keyboardPlayer1 = null;
    this.#keyboardPlayer2 = null;
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
    this.#keyboardPlayer1?.cleanup();
    this.#keyboardPlayer2?.cleanup();
    this.#assignments.clear();
  }
}
