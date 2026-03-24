import {
  ORDER_BASE_POINTS,
  ORDER_DURATION_MS,
  ORDER_EXPIRE_PENALTY,
  ORDER_GREEN_THRESHOLD,
  ORDER_INITIAL_BURST,
  ORDER_MAX_ACTIVE,
  ORDER_MIN_ACTIVE,
  ORDER_SPAWN_INTERVAL_MS,
  ORDER_YELLOW_THRESHOLD,
} from '../constants';
import { Time } from '../util/Time';
import { ComboManager } from './ComboManager';
import { ScoreManager } from './ScoreManager';

export type OrderZone = 'green' | 'yellow' | 'red';

export interface Order {
  id: number;
  elapsed: number;
  duration: number;
  zone: OrderZone;
}

export interface OrderResult {
  basePoints: number;
  tip: number;
  comboMultiplier: number;
  totalPoints: number;
}

function computeZone(elapsed: number, duration: number): OrderZone {
  const ratio = elapsed / duration;
  if (ratio <= ORDER_GREEN_THRESHOLD) return 'green';
  if (ratio <= ORDER_YELLOW_THRESHOLD) return 'yellow';
  return 'red';
}

export class OrderManager extends EventTarget {
  static #instance: OrderManager | null = null;

  #orders: Order[] = [];
  #nextId = 0;
  #running = false;
  #onTick: (() => void) | null = null;
  #spawnTimer = 0;
  #firstOrderDelivered = false;

  #comboManager: ComboManager;
  #scoreManager: ScoreManager;

  private constructor() {
    super();
    this.#comboManager = ComboManager.getInstance();
    this.#scoreManager = ScoreManager.getInstance();
  }

  public static getInstance(): OrderManager {
    if (!OrderManager.#instance) {
      OrderManager.#instance = new OrderManager();
    }
    return OrderManager.#instance;
  }

  public start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#spawnTimer = 0;

    // Spawn first order immediately (frozen until delivered)
    if (!this.#firstOrderDelivered && this.#orders.length === 0) {
      this.#spawnOrder();
    }

    const time = Time.getInstance();
    this.#onTick = () => {
      const delta = time.delta;
      this.#tick(delta);
    };
    time.addEventListener('tick', this.#onTick);
  }

  public stop(): void {
    if (!this.#running) return;
    this.#running = false;

    if (this.#onTick) {
      Time.getInstance().removeEventListener('tick', this.#onTick);
      this.#onTick = null;
    }
  }

  public reset(): void {
    this.stop();
    this.#orders = [];
    this.#nextId = 0;
    this.#spawnTimer = 0;
    this.#firstOrderDelivered = false;
  }

  public isFirstOrderDelivered(): boolean {
    return this.#firstOrderDelivered;
  }

  public getOrders(): readonly Order[] {
    return this.#orders;
  }

  public completeNextOrder(): OrderResult | null {
    if (this.#orders.length === 0) return null;

    const order = this.#orders.shift()!;
    const isFirstDelivery = !this.#firstOrderDelivered;

    // Linear scoring: 20 + floor(remainingSeconds / 2)
    const remainingMs = isFirstDelivery
      ? order.duration // First order always gives max points
      : Math.max(0, order.duration - order.elapsed);
    const timeBonus = Math.floor(remainingMs / 1000 / 2);

    this.#comboManager.increment();
    const multiplier = this.#comboManager.getMultiplier();
    const totalPoints = (ORDER_BASE_POINTS + timeBonus) * multiplier;

    this.#scoreManager.addPoints(totalPoints);

    const result: OrderResult = {
      basePoints: ORDER_BASE_POINTS,
      tip: timeBonus,
      comboMultiplier: multiplier,
      totalPoints,
    };

    this.dispatchEvent(new CustomEvent('orderCompleted', { detail: result }));

    // Phase transition: first delivery triggers burst spawn
    if (isFirstDelivery) {
      this.#firstOrderDelivered = true;
      this.#spawnTimer = 0;
      for (let i = 0; i < ORDER_INITIAL_BURST; i++) {
        this.#spawnOrder(0, ORDER_DURATION_MS + (i * ORDER_DURATION_MS) / 3);
      }
    }

    return result;
  }

  #tick(delta: number): void {
    // Phase 1: first order is frozen, no spawning, no expiry
    if (!this.#firstOrderDelivered) {
      return;
    }

    // Phase 2: normal ticking
    for (let i = this.#orders.length - 1; i >= 0; i--) {
      const order = this.#orders[i]!;
      order.elapsed += delta;
      order.zone = computeZone(order.elapsed, order.duration);

      if (order.elapsed >= order.duration) {
        this.#orders.splice(i, 1);
        this.#scoreManager.addPoints(ORDER_EXPIRE_PENALTY);
        this.#comboManager.resetCombo();
        this.dispatchEvent(new CustomEvent('orderExpired', { detail: { id: order.id } }));
      } else {
        this.dispatchEvent(new CustomEvent('orderUpdated', { detail: order }));
      }
    }

    // Ensure minimum active orders
    if (this.#orders.length < ORDER_MIN_ACTIVE) {
      this.#spawnOrder();
      this.#spawnTimer = 0;
    }

    // Fixed-interval spawning (capped at max active)
    this.#spawnTimer += delta;
    if (this.#spawnTimer >= ORDER_SPAWN_INTERVAL_MS) {
      if (this.#orders.length < ORDER_MAX_ACTIVE) {
        this.#spawnOrder();
      }
      this.#spawnTimer -= ORDER_SPAWN_INTERVAL_MS;
    }
  }

  #spawnOrder(initialElapsed = 0, duration = ORDER_DURATION_MS): void {
    const order: Order = {
      id: this.#nextId++,
      elapsed: initialElapsed,
      duration,
      zone: computeZone(initialElapsed, duration),
    };
    this.#orders.push(order);
    this.dispatchEvent(new CustomEvent('orderAdded', { detail: order }));
  }
}
