import type { InputSource, InputVector } from './InputSource';
import type { ControllerProfile } from './profiles';

export class GamepadController implements InputSource {
  #gamepadIndex: number;
  #profile: ControllerProfile;
  #buttonUpCallback: ((button: string) => void) | null = null;
  #previousButtonStates: boolean[] = [];
  #buttonHoldStart: Map<string, number> = new Map();
  #connected = true;

  constructor(gamepadIndex: number, profile: ControllerProfile) {
    this.#gamepadIndex = gamepadIndex;
    this.#profile = profile;
  }

  get connected(): boolean {
    return this.#connected && navigator.getGamepads()[this.#gamepadIndex] !== null;
  }

  setConnected(value: boolean): void {
    this.#connected = value;
  }

  updateIndex(newIndex: number): void {
    this.#gamepadIndex = newIndex;
  }

  getGamepadIndex(): number {
    return this.#gamepadIndex;
  }

  getMovement(): InputVector {
    const gamepad = navigator.getGamepads()[this.#gamepadIndex];
    if (!gamepad) return { x: 0, z: 0 };

    let x = gamepad.axes[this.#profile.leftStickX] ?? 0;
    let z = gamepad.axes[this.#profile.leftStickY] ?? 0;

    if (Math.abs(x) < this.#profile.deadzone) x = 0;
    if (Math.abs(z) < this.#profile.deadzone) z = 0;

    return { x, z };
  }

  isButtonPressed(button: string): boolean {
    const gamepad = navigator.getGamepads()[this.#gamepadIndex];
    if (!gamepad) return false;

    const buttons = this.#profile.buttons as Record<string, number>;
    const buttonIndex = buttons[button];
    if (buttonIndex === undefined) return false;

    return gamepad.buttons[buttonIndex]?.pressed ?? false;
  }

  getButtonHoldDuration(button: string): number {
    if (!this.isButtonPressed(button)) {
      this.#buttonHoldStart.delete(button);
      return 0;
    }

    const now = performance.now();
    if (!this.#buttonHoldStart.has(button)) {
      this.#buttonHoldStart.set(button, now);
    }

    return now - this.#buttonHoldStart.get(button)!;
  }

  pollButtons(): void {
    const gamepad = navigator.getGamepads()[this.#gamepadIndex];
    if (!gamepad) return;

    for (const [name, index] of Object.entries(this.#profile.buttons)) {
      const wasPressed = this.#previousButtonStates[index] ?? false;
      const isPressed = gamepad.buttons[index]?.pressed ?? false;

      if (wasPressed && !isPressed && this.#buttonUpCallback) {
        this.#buttonUpCallback(name);
      }

      this.#previousButtonStates[index] = isPressed;
    }
  }

  onButtonUp(callback: (button: string) => void): void {
    this.#buttonUpCallback = callback;
  }

  cleanup(): void {
    this.#buttonUpCallback = null;
    this.#previousButtonStates = [];
    this.#buttonHoldStart.clear();
  }
}
