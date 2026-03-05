import { Vector3 } from 'three';

export const REPAIR_HIT_COUNT = 7;
export const HIT_CYCLE_DURATION = 400; // ms per hit
export const REPAIR_TOTAL_DURATION = REPAIR_HIT_COUNT * HIT_CYCLE_DURATION; // 2800ms

// Phase boundaries within one cycle (normalized 0-1)
const PHASE_RAISE_END = 0.35;
const PHASE_STRIKE_END = 0.55;
const PHASE_IMPACT_END = 0.70;

// Hand offsets from rest position (body-local space) — large amplitude for cartoon feel
const RAISE_OFFSET = new Vector3(0, 1.3, -0.2);
const STRIKE_OFFSET = new Vector3(0, 1.35, 0.35);
const RECOVER_OFFSET = new Vector3(0, 0.1, 0);

// Hand X-axis rotation for wrist flick
const RAISE_ROTATION_X = -0.9;
const STRIKE_ROTATION_X = 0.7;
const RECOVER_ROTATION_X = 0.0;

// Body tilt (rotation.x) — leads the hand motion slightly
const BODY_PHASE_ADVANCE = 0.08; // body is 8% ahead in the cycle
const BODY_RAISE_TILT = -0.15;   // lean back when raising
const BODY_STRIKE_TILT = 0.25;   // lean forward when striking
const BODY_RECOVER_TILT = 0.0;

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function easeInQuad(t: number): number {
  return t * t;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class RepairAnimation {
  #active = false;
  #cycleTimer = 0;
  #hitFired = false;

  // Output: target offset and rotation for the right hand
  #targetOffset = new Vector3();
  #targetRotationX = 0;
  #bodyTiltX = 0;

  #onHitCallback: (() => void) | null = null;

  get active(): boolean {
    return this.#active;
  }

  get targetOffset(): Vector3 {
    return this.#targetOffset;
  }

  get targetRotationX(): number {
    return this.#targetRotationX;
  }

  get bodyTiltX(): number {
    return this.#bodyTiltX;
  }

  onHit(callback: () => void): void {
    this.#onHitCallback = callback;
  }

  start(): void {
    this.#active = true;
    this.#cycleTimer = 0;
    this.#hitFired = false;
  }

  stop(): void {
    this.#active = false;
    this.#cycleTimer = 0;
    this.#hitFired = false;
    this.#targetOffset.set(0, 0, 0);
    this.#targetRotationX = 0;
    this.#bodyTiltX = 0;
  }

  update(deltaMs: number): void {
    if (!this.#active) return;

    this.#cycleTimer += deltaMs;
    const t = Math.min(this.#cycleTimer / HIT_CYCLE_DURATION, 1);

    if (t < PHASE_RAISE_END) {
      // RAISE: smoothstep up
      const p = smoothstep(t / PHASE_RAISE_END);
      this.#targetOffset.lerpVectors(RECOVER_OFFSET, RAISE_OFFSET, p);
      this.#targetRotationX = lerp(RECOVER_ROTATION_X, RAISE_ROTATION_X, p);
    } else if (t < PHASE_STRIKE_END) {
      // STRIKE: fast ease-in down
      const p = easeInQuad((t - PHASE_RAISE_END) / (PHASE_STRIKE_END - PHASE_RAISE_END));
      this.#targetOffset.lerpVectors(RAISE_OFFSET, STRIKE_OFFSET, p);
      this.#targetRotationX = lerp(RAISE_ROTATION_X, STRIKE_ROTATION_X, p);
    } else if (t < PHASE_IMPACT_END) {
      // IMPACT: hold + fire hit once
      if (!this.#hitFired) {
        this.#hitFired = true;
        this.#onHitCallback?.();
      }
      const p = smoothstep((t - PHASE_STRIKE_END) / (PHASE_IMPACT_END - PHASE_STRIKE_END));
      this.#targetOffset.lerpVectors(STRIKE_OFFSET, RECOVER_OFFSET, p * 0.3);
      this.#targetRotationX = lerp(STRIKE_ROTATION_X, RECOVER_ROTATION_X, p * 0.3);
    } else {
      // RECOVER: bounce back preparing for next cycle
      const p = smoothstep((t - PHASE_IMPACT_END) / (1 - PHASE_IMPACT_END));
      this.#targetOffset.lerpVectors(STRIKE_OFFSET, RECOVER_OFFSET, 0.3 + 0.7 * p);
      this.#targetRotationX = lerp(STRIKE_ROTATION_X, RECOVER_ROTATION_X, 0.3 + 0.7 * p);
    }

    // Body tilt: same phases but advanced in time (body leads the motion)
    const tBody = Math.min((this.#cycleTimer + HIT_CYCLE_DURATION * BODY_PHASE_ADVANCE) / HIT_CYCLE_DURATION, 1);
    const tb = tBody > 1 ? tBody - 1 : tBody; // wrap around
    if (tb < PHASE_RAISE_END) {
      const p = smoothstep(tb / PHASE_RAISE_END);
      this.#bodyTiltX = lerp(BODY_RECOVER_TILT, BODY_RAISE_TILT, p);
    } else if (tb < PHASE_STRIKE_END) {
      const p = easeInQuad((tb - PHASE_RAISE_END) / (PHASE_STRIKE_END - PHASE_RAISE_END));
      this.#bodyTiltX = lerp(BODY_RAISE_TILT, BODY_STRIKE_TILT, p);
    } else if (tb < PHASE_IMPACT_END) {
      const p = smoothstep((tb - PHASE_STRIKE_END) / (PHASE_IMPACT_END - PHASE_STRIKE_END));
      this.#bodyTiltX = lerp(BODY_STRIKE_TILT, BODY_RECOVER_TILT, p * 0.3);
    } else {
      const p = smoothstep((tb - PHASE_IMPACT_END) / (1 - PHASE_IMPACT_END));
      this.#bodyTiltX = lerp(BODY_STRIKE_TILT, BODY_RECOVER_TILT, 0.3 + 0.7 * p);
    }

    // Cycle complete — reset for next hit
    if (this.#cycleTimer >= HIT_CYCLE_DURATION) {
      this.#cycleTimer -= HIT_CYCLE_DURATION;
      this.#hitFired = false;
    }
  }
}
