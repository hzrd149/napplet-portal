import type {
  EventTemplate,
  NappletMessage,
  NostrEvent,
  NostrFilter,
} from "@napplet/core";
import type {
  RelayEoseMessage,
  RelayEventMessage,
  RelaySubscribeMessage,
} from "@napplet/nap/relay";
import {
  concat,
  finalize,
  from,
  map,
  type Observable,
  tap,
} from "npm:rxjs@7.8.2";
import { debug as rootDebug, shortId } from "../debug.ts";
import type { RelayCache } from "./relay_cache.ts";

const debug = rootDebug.extend("relay");

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
  publish?(relay: string, event: NostrEvent): Promise<boolean>;
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
  readonly #cache?: RelayCache;
  readonly #subscriptions = new Map<string, { unsubscribe(): void }>();

  constructor(options: {
    pool: RelayPoolPort;
    store: RelayStorePort;
    cache?: RelayCache;
  }) {
    this.#pool = options.pool;
    this.#store = options.store;
    this.#cache = options.cache;
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
    debug(
      "subscribe started connection=%s window=%s sub=%s relay=%s filters=%d",
      shortId(owner.connectionId),
      shortId(owner.windowId),
      message.subId,
      message.relay,
      message.filters.length,
    );
    const seen = new Set<string>();
    let eose = false;
    let closed = false;
    const pending = { unsubscribe() {} };
    this.#subscriptions.set(key, pending);

    const memory$ = from(this.#store.query(message.filters)).pipe(
      map((event): RawRelayItem => ({ type: "EVENT", event, from: "" })),
    );
    const live$ = this.#pool.req([message.relay], message.filters).pipe(
      tap((item) => {
        if (item.type === "EVENT") this.#store.add(item.event, item.from);
      }),
    );

    const relays$ = this.#cache
      ? this.#cache.readThrough(message.filters, live$)
      : live$;
    // Memory is synchronous; bounded local relay and upstream follow in order.
    const stream = concat(memory$, relays$).pipe(
      finalize(() => this.#subscriptions.delete(key)),
    ).subscribe((item) => {
      if (!this.#subscriptions.has(key)) return;
      if (item.type === "EOSE") {
        if (eose) return;
        eose = true;
        debug(
          "eose connection=%s window=%s sub=%s",
          shortId(owner.connectionId),
          shortId(owner.windowId),
          message.subId,
        );
        listener({ type: "relay.eose", subId: message.subId });
        return;
      }
      if (seen.has(item.event.id)) return;
      seen.add(item.event.id);
      debug(
        "event connection=%s window=%s sub=%s event=%s from=%s",
        shortId(owner.connectionId),
        shortId(owner.windowId),
        message.subId,
        shortId(item.event.id),
        item.from || "cache",
      );
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
        debug(
          "subscription close requested connection=%s window=%s sub=%s",
          shortId(owner.connectionId),
          shortId(owner.windowId),
          message.subId,
        );
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
    debug(
      "closed subscription connection=%s window=%s sub=%s found=%s count=%d",
      shortId(owner.connectionId),
      shortId(owner.windowId),
      subId,
      Boolean(subscription),
      this.#subscriptions.size,
    );
  }

  async publishSigned(
    id: string,
    event: NostrEvent,
    relays: readonly string[],
  ): Promise<RelayPublishResult> {
    if (!event.id || !event.sig || !this.#pool.publish) {
      debug(
        "publish signed rejected id=%s hasEventId=%s hasSig=%s canPublish=%s",
        shortId(id),
        Boolean(event.id),
        Boolean(event.sig),
        Boolean(this.#pool.publish),
      );
      return { id, ok: false, error: "invalid signed event", outcomes: [] };
    }
    debug(
      "publish signed started id=%s event=%s relays=%d",
      shortId(id),
      shortId(event.id),
      relays.length,
    );
    return await this.#publish(id, event, relays);
  }

  async publishEncrypted(
    id: string,
    template: EventTemplate,
    recipient: string,
    relays: readonly string[],
    authority: {
      encrypt(recipient: string, plaintext: string): Promise<string>;
      signEvent(template: EventTemplate): Promise<NostrEvent>;
    },
  ): Promise<RelayPublishResult> {
    try {
      debug(
        "publish encrypted started id=%s recipient=%s relays=%d",
        shortId(id),
        shortId(recipient),
        relays.length,
      );
      const content = await authority.encrypt(recipient, template.content);
      const event = await authority.signEvent({ ...template, content });
      return await this.#publish(id, event, relays);
    } catch {
      debug("publish encrypted failed id=%s", shortId(id));
      return {
        id,
        ok: false,
        error: "encryption or signing failed",
        outcomes: [],
      };
    }
  }

  async #publish(
    id: string,
    event: NostrEvent,
    relays: readonly string[],
  ): Promise<RelayPublishResult> {
    if (!this.#pool.publish) {
      debug("publish unavailable id=%s", shortId(id));
      return {
        id,
        ok: false,
        error: "relay publishing unavailable",
        outcomes: [],
      };
    }
    const outcomes = await Promise.all(
      [...new Set(relays)].map(async (relay) => {
        try {
          return { relay, accepted: await this.#pool.publish!(relay, event) };
        } catch {
          return { relay, accepted: false };
        }
      }),
    );
    debug(
      "publish complete id=%s event=%s accepted=%d total=%d",
      shortId(id),
      shortId(event.id),
      outcomes.filter((outcome) => outcome.accepted).length,
      outcomes.length,
    );
    return outcomes.length > 0 && outcomes.every((outcome) => outcome.accepted)
      ? { id, ok: true, event, outcomes }
      : { id, ok: false, error: "required relay rejected publish", outcomes };
  }

  destroy(): void {
    debug("destroy started subscriptions=%d", this.#subscriptions.size);
    for (const [key, subscription] of this.#subscriptions) {
      this.#subscriptions.delete(key);
      subscription.unsubscribe();
    }
    debug("destroy complete");
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
    debug(
      "tracer subscribe sub=%s listeners=%d",
      message.subId,
      listeners.size,
    );
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
        debug(
          "tracer close sub=%s listeners=%d",
          message.subId,
          listeners.size,
        );
      },
    };
  }

  emitLive(event: NostrEvent): void {
    debug(
      "tracer emit live event=%s subs=%d",
      shortId(event.id),
      this.#listeners.size,
    );
    for (const [subId, listeners] of this.#listeners) {
      for (const listener of listeners) {
        listener({ type: "relay.event", subId, result: { event } });
      }
    }
  }
}

export type RelayPublishReply = NappletMessage;

export interface RelayPublishOutcome {
  readonly relay: string;
  readonly accepted: boolean;
}

export type RelayPublishResult =
  | {
    readonly id: string;
    readonly ok: true;
    readonly event: NostrEvent;
    readonly outcomes: readonly RelayPublishOutcome[];
  }
  | {
    readonly id: string;
    readonly ok: false;
    readonly error: string;
    readonly outcomes: readonly RelayPublishOutcome[];
  };
