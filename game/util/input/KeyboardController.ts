import type { InputSource, InputVector } from './InputSource';

export class KeyboardController implements InputSource {
  #buttonUpCallback: ((button: string) => void) | null = null;
  #boundKeyUpHandler: (event: KeyboardEvent) => void;
  #boundKeyDownHandler: (event: KeyboardEvent) => void;

  #keysPressed = new Set<string>();
  #keySet?: 'player1' | 'player2';

  readonly connected = true;

  constructor(keySet?: 'player1' | 'player2') {
    if (!window) {
      throw new Error('"KeyboardController" can only be instanciated in a browser environment.');
    }

    this.#keySet = keySet;
    this.#boundKeyUpHandler = this.#handleKeyUp.bind(this);
    this.#boundKeyDownHandler = this.#handleKeyDown.bind(this);

    window.addEventListener('keyup', this.#boundKeyUpHandler);
    window.addEventListener('keydown', this.#boundKeyDownHandler);
  }

  public onButtonUp(callback: (button: string) => void) {
    this.#buttonUpCallback = callback;
  }

  public isButtonPressed(button: string): boolean {
    if (button === 'b') {
      if (this.#keySet === 'player1') {
        return this.#keysPressed.has('AltLeft');
      } else if (this.#keySet === 'player2') {
        return this.#keysPressed.has('AltRight');
      }
      // No keySet: accept both (backward compat)
      return this.#keysPressed.has('AltLeft') || this.#keysPressed.has('AltRight');
    }

    if (button === 'a') {
      if (this.#keySet === 'player1') {
        return this.#keysPressed.has('Space');
      } else if (this.#keySet === 'player2') {
        return this.#keysPressed.has('Enter');
      }
      return this.#keysPressed.has('Space') || this.#keysPressed.has('Enter');
    }

    return this.#keysPressed.has(button);
  }

  public getMovement(): InputVector {
    let x = 0;
    let z = 0;

    // Player 1: WASD/ZQSD keys only
    if (this.#keySet === 'player1') {
      if (this.#keysPressed.has('KeyA') || this.#keysPressed.has('KeyQ')) {
        x = -1;
      } else if (this.#keysPressed.has('KeyD')) {
        x = 1;
      }

      if (this.#keysPressed.has('KeyW') || this.#keysPressed.has('KeyZ')) {
        z = -1;
      } else if (this.#keysPressed.has('KeyS')) {
        z = 1;
      }
    }
    // Player 2: Arrow keys only
    else if (this.#keySet === 'player2') {
      if (this.#keysPressed.has('ArrowLeft')) {
        x = -1;
      } else if (this.#keysPressed.has('ArrowRight')) {
        x = 1;
      }

      if (this.#keysPressed.has('ArrowUp')) {
        z = -1;
      } else if (this.#keysPressed.has('ArrowDown')) {
        z = 1;
      }
    }
    // No keySet: all keys (backward compatibility)
    else {
      if (this.#keysPressed.has('ArrowLeft') || this.#keysPressed.has('KeyA') || this.#keysPressed.has('KeyQ')) {
        x = -1;
      } else if (this.#keysPressed.has('ArrowRight') || this.#keysPressed.has('KeyD')) {
        x = 1;
      }

      if (this.#keysPressed.has('ArrowUp') || this.#keysPressed.has('KeyW') || this.#keysPressed.has('KeyZ')) {
        z = -1;
      } else if (this.#keysPressed.has('ArrowDown') || this.#keysPressed.has('KeyS')) {
        z = 1;
      }
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
    if (event.code === 'AltLeft') {
      event.preventDefault();
    }

    this.#keysPressed.delete(event.code);

    if (this.#buttonUpCallback) {
      const button = this.#mapKeyToAbstractButton(event.code);
      if (button) {
        this.#buttonUpCallback(button);
      }
    }
  }

  #mapKeyToAbstractButton(code: string): string | null {
    // Interact = 'a'
    if (this.#keySet === 'player1' && code === 'Space') return 'a';
    if (this.#keySet === 'player2' && code === 'Enter') return 'a';
    // Dash = 'b'
    if (this.#keySet === 'player1' && code === 'AltLeft') return 'b';
    if (this.#keySet === 'player2' && code === 'AltRight') return 'b';
    // No keySet: backward compat
    if (!this.#keySet) {
      if (code === 'Space' || code === 'Enter') return 'a';
      if (code === 'AltLeft' || code === 'AltRight') return 'b';
    }
    return null;
  }

  #handleKeyDown(event: KeyboardEvent) {
    this.#keysPressed.add(event.code);
  }
}
