import { debug as rootDebug, shortId } from "../debug.ts";
import { ExpiringRegistry } from "./expiring_registry.ts";

const debug = rootDebug.extend("connections");

export interface SubscriptionHandle {
  unsubscribe(): void;
}

interface ConnectionRecord {
  readonly connectionId: string;
  readonly reconnectToken: string;
  send?: (message: string | ArrayBuffer) => void;
  timer?: number;
  readonly windows: Set<string>;
  generation: number;
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
  readonly detachConnection?: (connectionId: string) => void;
  readonly sendFailure?: (connectionId: string) => void;
}

export interface ConnectionAttachment {
  readonly connectionId: string;
  readonly reconnectToken: string;
  readonly resumed: boolean;
  readonly generation: number;
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
  readonly #detachConnection: (connectionId: string) => void;
  readonly #sendFailure: (connectionId: string) => void;

  constructor(options: ConnectionRegistryOptions = {}) {
    this.#graceMs = options.graceMs ?? 10_000;
    this.#createId = options.createId ?? (() => crypto.randomUUID());
    this.#setTimeout = options.setTimeout ??
      ((callback, delay) => setTimeout(callback, delay));
    this.#clearTimeout = options.clearTimeout ?? clearTimeout;
    this.#destroyWindow = options.destroyWindow ?? (() => {});
    this.#detachConnection = options.detachConnection ?? (() => {});
    this.#sendFailure = options.sendFailure ?? (() => {});
    debug("initialized graceMs=%d", this.#graceMs);
  }

  get subscriptionCount(): number {
    return this.#subscriptions.size;
  }

  attach(
    send: (message: string | ArrayBuffer) => void,
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
      known.generation++;
      debug(
        "attached resumed connection=%s windows=%d",
        shortId(known.connectionId),
        known.windows.size,
      );
      return {
        connectionId: known.connectionId,
        reconnectToken: known.reconnectToken,
        resumed: true,
        generation: known.generation,
      };
    }

    const connectionId = this.#createId();
    const token = this.#createId();
    const record: ConnectionRecord = {
      connectionId,
      reconnectToken: token,
      send,
      windows: new Set(),
      generation: 0,
    };
    this.#connections.set(connectionId, record);
    this.#tokens.set(token, connectionId);
    debug("attached new connection=%s", shortId(connectionId));
    return {
      connectionId,
      reconnectToken: token,
      resumed: false,
      generation: record.generation,
    };
  }

  detach(connectionId: string, generation?: number): void {
    const connection = this.#connections.get(connectionId);
    if (
      !connection || connection.timer !== undefined ||
      (generation !== undefined && generation !== connection.generation)
    ) {
      debug(
        "detach ignored connection=%s known=%s",
        shortId(connectionId),
        Boolean(connection),
      );
      return;
    }
    connection.send = undefined;
    this.#detachConnection(connectionId);
    connection.timer = this.#setTimeout(
      () => this.#expire(connectionId),
      this.#graceMs,
    );
    debug(
      "detached connection=%s graceMs=%d",
      shortId(connectionId),
      this.#graceMs,
    );
  }

  send(connectionId: string, message: string | ArrayBuffer): boolean {
    const send = this.#connections.get(connectionId)?.send;
    const bytes = typeof message === "string"
      ? message.length
      : message.byteLength;
    if (!send) {
      debug(
        "send skipped disconnected connection=%s bytes=%d",
        shortId(connectionId),
        bytes,
      );
      return false;
    }
    try {
      send(message);
    } catch {
      this.#sendFailure(connectionId);
      return false;
    }
    debug(
      "sent connection=%s bytes=%d",
      shortId(connectionId),
      bytes,
    );
    return true;
  }

  isCurrentAttachment(connectionId: string, generation: number): boolean {
    const connection = this.#connections.get(connectionId);
    return connection?.send !== undefined &&
      connection.generation === generation;
  }

  createWindow(
    connectionId: string,
    requestedWindowId?: string,
  ): { readonly windowId: string } {
    if (!this.#connections.has(connectionId)) {
      throw new Error("unknown connection");
    }
    if (requestedWindowId && this.#windows.has(requestedWindowId)) {
      throw new Error("window namespace already owned");
    }
    const windowId = requestedWindowId ?? this.#createId();
    this.register(connectionId, windowId);
    debug(
      "created window connection=%s window=%s",
      shortId(connectionId),
      shortId(windowId),
    );
    return { windowId };
  }

  register(connectionId: string, windowId: string, source?: object): void {
    const existing = this.#windows.get(windowId);
    if (existing && existing.connectionId !== connectionId) {
      throw new Error("window namespace already owned");
    }
    this.#windows.set(windowId, { connectionId, source });
    this.#connections.get(connectionId)?.windows.add(windowId);
    debug(
      "registered window connection=%s window=%s source=%s",
      shortId(connectionId),
      shortId(windowId),
      Boolean(source),
    );
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
    debug(
      "tracked subscription connection=%s window=%s sub=%s replaced=%s count=%d",
      shortId(connectionId),
      shortId(windowId),
      subId,
      Boolean(previous),
      this.#subscriptions.size,
    );
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
    debug(
      "closed subscription connection=%s window=%s sub=%s found=%s count=%d",
      shortId(connectionId),
      shortId(windowId),
      subId,
      Boolean(subscription),
      this.#subscriptions.size,
    );
  }

  remove(windowId: string): void {
    const window = this.#windows.get(windowId);
    if (!window) {
      debug("remove window ignored window=%s", shortId(windowId));
      return;
    }
    this.#windows.delete(windowId);
    this.#connections.get(window.connectionId)?.windows.delete(windowId);
    const prefix = `${window.connectionId}:${windowId}:`;
    for (const [key, subscription] of this.#subscriptions) {
      if (!key.startsWith(prefix)) continue;
      this.#subscriptions.delete(key);
      subscription.unsubscribe();
    }
    this.#destroyWindow(windowId);
    debug(
      "removed window connection=%s window=%s subscriptions=%d",
      shortId(window.connectionId),
      shortId(windowId),
      this.#subscriptions.size,
    );
  }

  #expire(connectionId: string): void {
    const connection = this.#connections.get(connectionId);
    if (!connection || connection.send) {
      debug(
        "expire ignored connection=%s known=%s connected=%s",
        shortId(connectionId),
        Boolean(connection),
        Boolean(connection?.send),
      );
      return;
    }
    debug(
      "expiring connection=%s windows=%d",
      shortId(connectionId),
      connection.windows.size,
    );
    for (const windowId of [...connection.windows]) this.remove(windowId);
    this.#connections.delete(connectionId);
    this.#tokens.delete(connection.reconnectToken);
    debug("expired connection=%s", shortId(connectionId));
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
  readonly #registry: ExpiringRegistry<undefined>;
  readonly #timeoutMs: number;

  constructor(options: PendingCorrelationsOptions) {
    this.#timeoutMs = options.timeoutMs;
    this.#registry = new ExpiringRegistry<undefined>({
      ttlMs: options.timeoutMs,
      setTimer: options.setTimeout,
      clearTimer: options.clearTimeout,
      onExpire: options.onTimeout,
    });
  }

  get pendingCount(): number {
    return this.#registry.size;
  }

  register(id: string): void {
    // set() replaces any existing pending entry for this id; the shared
    // registry's replace path does not itself emit a "resolved" debug
    // line, unlike the previous inline implementation.
    this.#registry.set(id, undefined);
    debug(
      "registered pending correlation id=%s timeoutMs=%d count=%d",
      shortId(id),
      this.#timeoutMs,
      this.#registry.size,
    );
  }

  resolve(id: string): void {
    if (!this.#registry.delete(id)) return;
    debug(
      "resolved pending correlation id=%s count=%d",
      shortId(id),
      this.#registry.size,
    );
  }

  destroy(): void {
    this.#registry.clear();
    debug("destroyed pending correlations");
  }
}
