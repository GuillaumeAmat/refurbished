import type { InputSource, InputVector } from './input/InputSource';

export class InputController implements InputSource {
  #buttonUpCallback: ((button: string) => void) | null = null;
  #boundKeyUpHandler: (event: KeyboardEvent) => void;
  #boundKeyDownHandler: (event: KeyboardEvent) => void;

  #keysPressed = new Set<string>();

  readonly connected = true;

  constructor() {
    if (!window) {
      throw new Error('"InputController" can only be instanciated in a browser environment.');
    }

    this.#boundKeyUpHandler = this.#handleKeyUp.bind(this);
    this.#boundKeyDownHandler = this.#handleKeyDown.bind(this);

    window.addEventListener('keyup', this.#boundKeyUpHandler);
    window.addEventListener('keydown', this.#boundKeyDownHandler);
  }

  public onButtonUp(callback: (button: string) => void) {
    this.#buttonUpCallback = callback;
  }

  public isButtonPressed(button: string): boolean {
    return this.#keysPressed.has(button);
  }

  public getMovement(): InputVector {
    let x = 0;
    let z = 0;

    if (
      this.#keysPressed.has('ArrowLeft') ||
      this.#keysPressed.has('KeyA') ||
      this.#keysPressed.has('KeyQ')
    ) {
      x = -1;
    } else if (this.#keysPressed.has('ArrowRight') || this.#keysPressed.has('KeyD')) {
      x = 1;
    }

    if (
      this.#keysPressed.has('ArrowUp') ||
      this.#keysPressed.has('KeyW') ||
      this.#keysPressed.has('KeyZ')
    ) {
      z = -1;
    } else if (this.#keysPressed.has('ArrowDown') || this.#keysPressed.has('KeyS')) {
      z = 1;
    }

    return { x, z };
  }

  public cleanup() {
    window.removeEventListener('keyup', this.#boundKeyUpHandler);
    window.removeEventListener('keydown', this.#boundKeyDownHandler);
    this.#buttonUpCallback = null;
    this.#keysPressed.clear();
  }

  #handleKeyUp(event: KeyboardEvent) {
    this.#keysPressed.delete(event.code);

    if (this.#buttonUpCallback) {
      this.#buttonUpCallback(event.code);
    }
  }

  #handleKeyDown(event: KeyboardEvent) {
    this.#keysPressed.add(event.code);
  }
}
