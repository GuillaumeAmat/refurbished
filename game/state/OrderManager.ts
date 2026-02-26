import {
  ORDER_BASE_POINTS,
  ORDER_DURATION_MS,
  ORDER_EXPIRE_PENALTY,
  ORDER_FIRST_DELAY_MS,
  ORDER_GREEN_THRESHOLD,
  ORDER_GREEN_TIP,
  ORDER_MAX_ACTIVE,
  ORDER_MIN_ACTIVE,
  ORDER_RED_TIP,
  ORDER_SPAWN_MAX_MS,
  ORDER_SPAWN_MIN_MS,
  ORDER_YELLOW_THRESHOLD,
  ORDER_YELLOW_TIP,
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

function tipForZone(zone: OrderZone): number {
  if (zone === 'green') return ORDER_GREEN_TIP;
  if (zone === 'yellow') return ORDER_YELLOW_TIP;
  return ORDER_RED_TIP;
}

function randomSpawnInterval(): number {
  return ORDER_SPAWN_MIN_MS + Math.random() * (ORDER_SPAWN_MAX_MS - ORDER_SPAWN_MIN_MS);
}

export class OrderManager extends EventTarget {
  static #instance: OrderManager | null = null;

  #orders: Order[] = [];
  #nextId = 0;
  #running = false;
  #onTick: (() => void) | null = null;
  #spawnTimer = 0;
  #nextSpawnInterval = 0;
  #firstSpawnDone = false;

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
    this.#nextSpawnInterval = ORDER_FIRST_DELAY_MS;
    this.#firstSpawnDone = false;

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
    this.#firstSpawnDone = false;
  }

  public getOrders(): readonly Order[] {
    return this.#orders;
  }

  public completeNextOrder(): OrderResult | null {
    if (this.#orders.length === 0) return null;

    const order = this.#orders.shift()!;
    const tip = tipForZone(order.zone);
    this.#comboManager.increment();
    const multiplier = this.#comboManager.getMultiplier();
    const totalPoints = (ORDER_BASE_POINTS + tip) * multiplier;

    this.#scoreManager.addPoints(totalPoints);

    const result: OrderResult = {
      basePoints: ORDER_BASE_POINTS,
      tip,
      comboMultiplier: multiplier,
      totalPoints,
    };

    this.dispatchEvent(new CustomEvent('orderCompleted', { detail: result }));
    return result;
  }

  #tick(delta: number): void {
    // Update existing orders
    for (let i = this.#orders.length - 1; i >= 0; i--) {
      const order = this.#orders[i];
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

    // Spawn logic
    this.#spawnTimer += delta;

    // Ensure minimum active orders
    if (this.#orders.length < ORDER_MIN_ACTIVE && this.#firstSpawnDone) {
      this.#spawnOrder();
      this.#spawnTimer = 0;
      this.#nextSpawnInterval = randomSpawnInterval();
    }

    // Regular spawn interval
    if (this.#spawnTimer >= this.#nextSpawnInterval && this.#orders.length < ORDER_MAX_ACTIVE) {
      this.#spawnOrder();
      this.#firstSpawnDone = true;
      this.#spawnTimer = 0;
      this.#nextSpawnInterval = randomSpawnInterval();
    }
  }

  #spawnOrder(): void {
    const order: Order = {
      id: this.#nextId++,
      elapsed: 0,
      duration: ORDER_DURATION_MS,
      zone: 'green',
    };
    this.#orders.push(order);
    this.dispatchEvent(new CustomEvent('orderAdded', { detail: order }));
  }
}
