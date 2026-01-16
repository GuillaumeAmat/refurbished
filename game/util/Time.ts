import { EventDispatcher } from 'three';

type TickEvent = {
  type: 'tick';
};

type TimeEvents = {
  tick: TickEvent;
};

export class Time extends EventDispatcher<TimeEvents> {
  static #instance: Time;

  #start!: number;
  #current!: number;
  #elapsed!: number;
  #delta!: number;

  public get start() {
    return this.#start;
  }

  public get current() {
    return this.#current;
  }

  public get elapsed() {
    return this.#elapsed;
  }

  public get delta() {
    return this.#delta;
  }

  constructor() {
    super();

    Time.#instance = this;

    if (!window) {
      throw new Error('"Time" can only be instanciated in a browser environment.');
    }

    this.#start = Date.now();
    this.#current = this.start;
    this.#elapsed = 0;
    this.#delta = 16;

    window.requestAnimationFrame(() => {
      this.tick();
    });
  }

  static getInstance() {
    return Time.#instance;
  }

  private tick() {
    const currentTime = Date.now();

    this.#delta = currentTime - this.#current;
    this.#current = currentTime;
    this.#elapsed = this.#current - this.start;

    this.dispatchEvent({ type: 'tick' });

    window.requestAnimationFrame(() => {
      this.tick();
    });
  }
}
