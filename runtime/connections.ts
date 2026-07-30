export interface SubscriptionHandle {
  unsubscribe(): void;
}

interface ConnectionRecord {
  readonly connectionId: string;
  readonly reconnectToken: string;
  send?: (message: string) => void;
  timer?: number;
  readonly windows: Set<string>;
}

interface WindowRecord {
  readonly connectionId: string;
  readonly source?: object;
}

export interface ConnectionRegistryOptions {
  readonly graceMs?: number;
  readonly createId?: () => string;
  readonly setTimeout?: (callback: () => void, delay: number) => number;
  readonly clearTimeout?: (id: number) => void;
  readonly destroyWindow?: (windowId: string) => void;
}

export interface ConnectionAttachment {
  readonly connectionId: string;
  readonly reconnectToken: string;
  readonly resumed: boolean;
}

export class ConnectionRegistry {
  readonly #connections = new Map<string, ConnectionRecord>();
  readonly #tokens = new Map<string, string>();
  readonly #windows = new Map<string, WindowRecord>();
  readonly #subscriptions = new Map<string, SubscriptionHandle>();
  readonly #graceMs: number;
  readonly #createId: () => string;
  readonly #setTimeout: (callback: () => void, delay: number) => number;
  readonly #clearTimeout: (id: number) => void;
  readonly #destroyWindow: (windowId: string) => void;

  constructor(options: ConnectionRegistryOptions = {}) {
    this.#graceMs = options.graceMs ?? 10_000;
    this.#createId = options.createId ?? (() => crypto.randomUUID());
    this.#setTimeout = options.setTimeout ??
      ((callback, delay) => setTimeout(callback, delay));
    this.#clearTimeout = options.clearTimeout ?? clearTimeout;
    this.#destroyWindow = options.destroyWindow ?? (() => {});
  }

  get subscriptionCount(): number {
    return this.#subscriptions.size;
  }

  attach(
    send: (message: string) => void,
    reconnectToken?: string,
  ): ConnectionAttachment {
    const knownId = reconnectToken
      ? this.#tokens.get(reconnectToken)
      : undefined;
    const known = knownId ? this.#connections.get(knownId) : undefined;
    if (known) {
      if (known.timer !== undefined) this.#clearTimeout(known.timer);
      known.timer = undefined;
      known.send = send;
      return {
        connectionId: known.connectionId,
        reconnectToken: known.reconnectToken,
        resumed: true,
      };
    }

    const connectionId = this.#createId();
    const token = this.#createId();
    const record: ConnectionRecord = {
      connectionId,
      reconnectToken: token,
      send,
      windows: new Set(),
    };
    this.#connections.set(connectionId, record);
    this.#tokens.set(token, connectionId);
    return { connectionId, reconnectToken: token, resumed: false };
  }

  detach(connectionId: string): void {
    const connection = this.#connections.get(connectionId);
    if (!connection || connection.timer !== undefined) return;
    connection.send = undefined;
    connection.timer = this.#setTimeout(
      () => this.#expire(connectionId),
      this.#graceMs,
    );
  }

  send(connectionId: string, message: string): boolean {
    const send = this.#connections.get(connectionId)?.send;
    if (!send) return false;
    send(message);
    return true;
  }

  createWindow(connectionId: string): { readonly windowId: string } {
    if (!this.#connections.has(connectionId)) {
      throw new Error("unknown connection");
    }
    const windowId = this.#createId();
    this.register(connectionId, windowId);
    return { windowId };
  }

  register(connectionId: string, windowId: string, source?: object): void {
    const existing = this.#windows.get(windowId);
    if (existing && existing.connectionId !== connectionId) {
      throw new Error("window namespace already owned");
    }
    this.#windows.set(windowId, { connectionId, source });
    this.#connections.get(connectionId)?.windows.add(windowId);
  }

  ownsWindow(connectionId: string, windowId: string): boolean {
    return this.#windows.get(windowId)?.connectionId === connectionId;
  }

  owns(connectionId: string, windowId: string, source: object): boolean {
    const entry = this.#windows.get(windowId);
    return entry?.connectionId === connectionId && entry.source === source;
  }

  trackSubscription(
    connectionId: string,
    windowId: string,
    subId: string,
    handle: SubscriptionHandle,
  ): void {
    if (!this.ownsWindow(connectionId, windowId)) {
      throw new Error("foreign window namespace");
    }
    const key = this.#subscriptionKey(connectionId, windowId, subId);
    const previous = this.#subscriptions.get(key);
    this.#subscriptions.set(key, handle);
    previous?.unsubscribe();
  }

  closeSubscription(
    connectionId: string,
    windowId: string,
    subId: string,
  ): void {
    const key = this.#subscriptionKey(connectionId, windowId, subId);
    const subscription = this.#subscriptions.get(key);
    this.#subscriptions.delete(key);
    subscription?.unsubscribe();
  }

  remove(windowId: string): void {
    const window = this.#windows.get(windowId);
    if (!window) return;
    this.#windows.delete(windowId);
    this.#connections.get(window.connectionId)?.windows.delete(windowId);
    const prefix = `${window.connectionId}:${windowId}:`;
    for (const [key, subscription] of this.#subscriptions) {
      if (!key.startsWith(prefix)) continue;
      this.#subscriptions.delete(key);
      subscription.unsubscribe();
    }
    this.#destroyWindow(windowId);
  }

  #expire(connectionId: string): void {
    const connection = this.#connections.get(connectionId);
    if (!connection || connection.send) return;
    for (const windowId of [...connection.windows]) this.remove(windowId);
    this.#connections.delete(connectionId);
    this.#tokens.delete(connection.reconnectToken);
  }

  #subscriptionKey(
    connectionId: string,
    windowId: string,
    subId: string,
  ): string {
    return `${connectionId}:${windowId}:${subId}`;
  }
}

export interface PendingCorrelationsOptions {
  readonly timeoutMs: number;
  readonly setTimeout?: (callback: () => void, delay: number) => number;
  readonly clearTimeout?: (id: number) => void;
  readonly onTimeout: (id: string) => void;
}

export class PendingCorrelations {
  readonly #timers = new Map<string, number>();
  readonly #options: PendingCorrelationsOptions;

  constructor(options: PendingCorrelationsOptions) {
    this.#options = options;
  }

  register(id: string): void {
    this.resolve(id);
    const schedule = this.#options.setTimeout ??
      ((callback, delay) => setTimeout(callback, delay));
    const timer = schedule(() => {
      this.#timers.delete(id);
      this.#options.onTimeout(id);
    }, this.#options.timeoutMs);
    this.#timers.set(id, timer);
  }

  resolve(id: string): void {
    const timer = this.#timers.get(id);
    if (timer === undefined) return;
    (this.#options.clearTimeout ?? clearTimeout)(timer);
    this.#timers.delete(id);
  }
}
