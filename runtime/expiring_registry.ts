import { debug as rootDebug } from "../debug.ts";

const debug = rootDebug.extend("expiring-registry");

export interface ExpiringRegistryOptions {
  readonly ttlMs: number;
  readonly max?: number;
  readonly onExpire?: (key: string) => void;
  readonly setTimer?: (callback: () => void, delay: number) => number;
  readonly clearTimer?: (id: number) => void;
}

interface RegistryEntry<T> {
  readonly value: T;
  readonly timer: number;
}

/**
 * The single implementation of "keyed entries with a TTL timer plus
 * cleanup" used across runtime/. Route-level and connection-level
 * consumers parameterize policy (ttl, admission cap, expiry callback)
 * and delegate mechanism to this class.
 */
export class ExpiringRegistry<T> {
  readonly #entries = new Map<string, RegistryEntry<T>>();
  readonly #ttlMs: number;
  readonly #max?: number;
  readonly #onExpire?: (key: string) => void;
  readonly #setTimer: (callback: () => void, delay: number) => number;
  readonly #clearTimer: (id: number) => void;

  constructor(options: ExpiringRegistryOptions) {
    this.#ttlMs = options.ttlMs;
    this.#max = options.max;
    this.#onExpire = options.onExpire;
    this.#setTimer = options.setTimer ??
      ((callback, delay) => setTimeout(callback, delay));
    this.#clearTimer = options.clearTimer ?? clearTimeout;
  }

  get size(): number {
    return this.#entries.size;
  }

  /** Bounded admission. Rejects an existing key or a full registry. */
  add(key: string, value: T): boolean {
    if (
      this.#entries.has(key) ||
      (this.#max !== undefined && this.#entries.size >= this.#max)
    ) return false;
    this.#entries.set(key, { value, timer: this.#schedule(key) });
    return true;
  }

  /**
   * Replace-or-insert. Unlike `add`, this does not enforce `max` — `add`
   * is the bounded admission path.
   */
  set(key: string, value: T): void {
    this.delete(key);
    this.#entries.set(key, { value, timer: this.#schedule(key) });
  }

  take(key: string): T | undefined {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    this.#entries.delete(key);
    this.#clearTimer(entry.timer);
    return entry.value;
  }

  delete(key: string): boolean {
    const entry = this.#entries.get(key);
    if (!entry) return false;
    this.#entries.delete(key);
    this.#clearTimer(entry.timer);
    return true;
  }

  clear(): void {
    for (const key of [...this.#entries.keys()]) this.delete(key);
  }

  #schedule(key: string): number {
    return this.#setTimer(() => {
      const entry = this.#entries.get(key);
      this.#entries.delete(key);
      if (entry) this.#clearTimer(entry.timer);
      debug("expired key=%s size=%d", key, this.#entries.size);
      this.#onExpire?.(key);
    }, this.#ttlMs);
  }
}
