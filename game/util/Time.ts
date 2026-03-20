import { EventDispatcher } from 'three';

type TickEvent = {
  type: 'tick';
};

type TimeEvents = {
  tick: TickEvent;
};

export class Time extends EventDispatcher<TimeEvents> {
  static #instance: Time;

  static readonly #CALIBRATION_FRAMES = 10;
  static readonly #STANDARD_HZ = [30, 60, 75, 90, 120, 144, 165, 240];

  #minFrameTime: number = 1000 / 60;
  #calibrationTimestamps: DOMHighResTimeStamp[] = [];

  #start!: number;
  #current!: number;
  #elapsed!: number;
  #delta!: number;
  #animationFrameId: number | null = null;

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

  public get detectedHz(): number {
    return Math.round(1000 / this.#minFrameTime);
  }

  constructor() {
    super();

    // Dispose previous instance if it exists (HMR support)
    if (Time.#instance) {
      Time.#instance.dispose();
    }

    Time.#instance = this;

    if (!window) {
      throw new Error('"Time" can only be instanciated in a browser environment.');
    }

    this.#start = performance.now();
    this.#current = this.#start;
    this.#elapsed = 0;
    this.#delta = 1000 / 60;

    this.#animationFrameId = window.requestAnimationFrame((ts) => {
      this.#tick(ts);
    });
  }

  static getInstance() {
    return Time.#instance;
  }

  #tick(timestamp: DOMHighResTimeStamp) {
    // Collect CALIBRATION_FRAMES + 1 timestamps (first serves as reference, not a sample)
    if (this.#calibrationTimestamps.length <= Time.#CALIBRATION_FRAMES) {
      this.#calibrationTimestamps.push(timestamp);

      if (this.#calibrationTimestamps.length === Time.#CALIBRATION_FRAMES + 1) {
        const intervals = this.#calibrationTimestamps
          .slice(1)
          .map((t, i) => t - this.#calibrationTimestamps[i]);
        const sorted = [...intervals].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const measuredHz = 1000 / median;
        const snapped = Time.#STANDARD_HZ.reduce((best, hz) =>
          Math.abs(hz - measuredHz) < Math.abs(best - measuredHz) ? hz : best
        );
        this.#minFrameTime = 1000 / snapped;
        console.log('[Time] Detected refresh rate:', this.detectedHz, 'Hz');
      }
    }

    const delta = timestamp - this.#current;

    if (delta >= this.#minFrameTime) {
      this.#delta = delta;
      this.#current = timestamp;
      this.#elapsed = this.#current - this.#start;
      this.dispatchEvent({ type: 'tick' });
    }

    this.#animationFrameId = window.requestAnimationFrame((ts) => {
      this.#tick(ts);
    });
  }

  public dispose() {
    if (this.#animationFrameId !== null) {
      window.cancelAnimationFrame(this.#animationFrameId);
      this.#animationFrameId = null;
    }
  }
}
