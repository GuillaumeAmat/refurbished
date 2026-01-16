import { EventDispatcher } from 'three';

type ResizeEvent = {
  type: 'resize';
};

type SizesEvents = {
  resize: ResizeEvent;
};

export class Sizes extends EventDispatcher<SizesEvents> {
  static #instance: Sizes;

  #width = 800;
  #height = 600;
  #pixelRatio = 1;

  public get width() {
    return this.#width;
  }

  public get height() {
    return this.#height;
  }

  public get pixelRatio() {
    return this.#pixelRatio;
  }

  constructor() {
    super();

    Sizes.#instance = this;

    if (!window) {
      throw new Error('"Sizes" can only be instanciated in a browser environment.');
    }

    this.updateSizesFromWindow();

    window.addEventListener('resize', () => {
      this.updateSizesFromWindow();
      this.dispatchEvent({ type: 'resize' });
    });
  }

  static getInstance() {
    return Sizes.#instance;
  }

  private updateSizesFromWindow() {
    this.#width = window.innerWidth;
    this.#height = window.innerHeight;

    // Above 2 is not necessary, so we use max the pixel ratio to 2.
    this.#pixelRatio = Math.min(window.devicePixelRatio, 2);
  }
}
