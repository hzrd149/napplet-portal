import type { NappletMessage, NostrEvent, NostrFilter } from "@napplet/core";
import type {
  RelayEoseMessage,
  RelayEventMessage,
  RelaySubscribeMessage,
} from "@napplet/nap/relay";
import {
  finalize,
  from,
  map,
  merge,
  type Observable,
  tap,
} from "npm:rxjs@7.8.2";

export type RawRelayItem =
  | {
    readonly type: "EVENT";
    readonly event: NostrEvent;
    readonly from: string;
  }
  | { readonly type: "EOSE" };

export interface RelayPoolPort {
  req(
    relays: readonly string[],
    filters: readonly NostrFilter[],
  ): Observable<RawRelayItem>;
}

export interface RelayStorePort {
  query(filters: readonly NostrFilter[]): readonly NostrEvent[];
  add(event: NostrEvent, from?: string): void;
}

export interface RelayOwner {
  readonly connectionId: string;
  readonly windowId: string;
}

export interface RelaySubscribeRequest extends RelaySubscribeMessage {
  readonly relay: string;
}

export type RelayStreamMessage =
  | RelayEventMessage
  | RelayEoseMessage
  | {
    readonly type: "relay.closed";
    readonly subId: string;
    readonly message: "";
  };

export interface RelaySubscription {
  readonly closed: boolean;
  close(): void;
}

function relayKey(owner: RelayOwner, subId: string): string {
  return `${owner.connectionId}:${owner.windowId}:${subId}`;
}

export class BackendRelayAdapter {
  readonly #pool: RelayPoolPort;
  readonly #store: RelayStorePort;
  readonly #subscriptions = new Map<string, { unsubscribe(): void }>();

  constructor(options: { pool: RelayPoolPort; store: RelayStorePort }) {
    this.#pool = options.pool;
    this.#store = options.store;
  }

  get subscriptionCount(): number {
    return this.#subscriptions.size;
  }

  subscribe(
    owner: RelayOwner,
    message: RelaySubscribeRequest,
    listener: (message: RelayStreamMessage) => void,
  ): RelaySubscription {
    const key = relayKey(owner, message.subId);
    this.close(owner, message.subId);
    const seen = new Set<string>();
    let eose = false;
    let closed = false;
    const pending = { unsubscribe() {} };
    this.#subscriptions.set(key, pending);

    const cached$ = from(this.#store.query(message.filters)).pipe(
      map((event): RawRelayItem => ({ type: "EVENT", event, from: "" })),
    );
    const live$ = this.#pool.req([message.relay], message.filters).pipe(
      tap((item) => {
        if (item.type === "EVENT") this.#store.add(item.event, item.from);
      }),
    );

    const stream = merge(cached$, live$).pipe(
      finalize(() => this.#subscriptions.delete(key)),
    ).subscribe((item) => {
      if (!this.#subscriptions.has(key)) return;
      if (item.type === "EOSE") {
        if (eose) return;
        eose = true;
        listener({ type: "relay.eose", subId: message.subId });
        return;
      }
      if (seen.has(item.event.id)) return;
      seen.add(item.event.id);
      listener({
        type: "relay.event",
        subId: message.subId,
        result: item.from
          ? { event: item.event, sidecar: { relayHints: [item.from] } }
          : { event: item.event },
      } as RelayEventMessage);
    });
    if (this.#subscriptions.get(key) === pending) {
      this.#subscriptions.set(key, stream);
    } else {
      stream.unsubscribe();
    }

    return {
      get closed() {
        return closed;
      },
      close: () => {
        if (closed) return;
        closed = true;
        this.close(owner, message.subId);
        listener({ type: "relay.closed", subId: message.subId, message: "" });
      },
    };
  }

  close(owner: RelayOwner, subId: string): void {
    const key = relayKey(owner, subId);
    const subscription = this.#subscriptions.get(key);
    this.#subscriptions.delete(key);
    subscription?.unsubscribe();
  }

  destroy(): void {
    for (const [key, subscription] of this.#subscriptions) {
      this.#subscriptions.delete(key);
      subscription.unsubscribe();
    }
  }
}

type TracerEnvelope = RelayEventMessage | RelayEoseMessage;
type TracerListener = (message: TracerEnvelope) => void;

/** Compatibility adapter retained for the supplied-fixture tracer. */
export class TracerRelayAdapter {
  readonly #stored: NostrEvent;
  readonly #listeners = new Map<string, Set<TracerListener>>();

  constructor(stored: NostrEvent) {
    this.#stored = stored;
  }

  subscribe(
    message: RelaySubscribeMessage,
    listener: TracerListener,
  ): RelaySubscription {
    const listeners = this.#listeners.get(message.subId) ??
      new Set<TracerListener>();
    listeners.add(listener);
    this.#listeners.set(message.subId, listeners);
    listener({
      type: "relay.event",
      subId: message.subId,
      result: { event: this.#stored },
    });
    listener({ type: "relay.eose", subId: message.subId });
    let closed = false;
    return {
      get closed() {
        return closed;
      },
      close: () => {
        closed = true;
        listeners.delete(listener);
      },
    };
  }

  emitLive(event: NostrEvent): void {
    for (const [subId, listeners] of this.#listeners) {
      for (const listener of listeners) {
        listener({ type: "relay.event", subId, result: { event } });
      }
    }
  }
}

export type RelayPublishReply = NappletMessage;
