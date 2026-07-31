import type { EventTemplate, NostrEvent, NostrFilter } from "@napplet/core";
import { finalize, type Observable } from "npm:rxjs@7.8.2";
import { debug as rootDebug, shortId } from "../debug.ts";
import type { IdentitySnapshot } from "./accounts.ts";
import type { RelayOwner } from "./relay_adapter.ts";
import type { RelayPolicy } from "./relay_policy.ts";

const debug = rootDebug.extend("outbox");

export type OutboxRawItem =
  | {
    readonly type: "EVENT";
    readonly event: NostrEvent;
    readonly from: string;
  }
  | { readonly type: "EOSE" };

export interface OutboxPoolPort {
  req(
    relays: readonly string[],
    filters: readonly NostrFilter[],
  ): Observable<OutboxRawItem>;
  publish(relay: string, event: NostrEvent): Promise<boolean>;
}

export interface OutboxSubscribeRequest {
  readonly type: "outbox.subscribe";
  readonly subId: string;
  readonly filters: readonly NostrFilter[];
}

export type OutboxStreamMessage =
  | {
    readonly type: "outbox.event";
    readonly subId: string;
    readonly result: {
      readonly event: NostrEvent;
      readonly sidecar?: { readonly relayHints: readonly string[] };
    };
  }
  | { readonly type: "outbox.closed"; readonly subId: string };

export interface PublishOutcome {
  readonly relay: string;
  readonly accepted: boolean;
}

export type OutboxPublishResult =
  | {
    readonly id: string;
    readonly ok: true;
    readonly event: NostrEvent;
    readonly outcomes: readonly PublishOutcome[];
  }
  | {
    readonly id: string;
    readonly ok: false;
    readonly error: string;
    readonly outcomes: readonly PublishOutcome[];
  };

export interface OutboxAdapterOptions {
  readonly presetRelays: readonly string[];
  readonly identity: () => IdentitySnapshot;
  readonly nip65Relays: (pubkey: string) => readonly string[];
  readonly signEvent: (template: EventTemplate) => Promise<NostrEvent>;
  readonly pool: OutboxPoolPort;
  readonly relayPolicy?: RelayPolicy;
}

function key(owner: RelayOwner, subId: string): string {
  return `${owner.connectionId}:${owner.windowId}:${subId}`;
}

export class OutboxAdapter {
  readonly #options: OutboxAdapterOptions;
  readonly #subscriptions = new Map<string, { unsubscribe(): void }>();

  constructor(options: OutboxAdapterOptions) {
    this.#options = options;
  }

  subscribe(
    owner: RelayOwner,
    request: OutboxSubscribeRequest,
    listener: (message: OutboxStreamMessage) => void,
  ): { close(): void } {
    const subscriptionKey = key(owner, request.subId);
    this.#close(subscriptionKey);
    debug(
      "subscribe started connection=%s window=%s sub=%s filters=%d",
      shortId(owner.connectionId),
      shortId(owner.windowId),
      request.subId,
      request.filters.length,
    );
    const seen = new Set<string>();
    const relays = this.#relays();
    debug(
      "subscribe relays connection=%s window=%s sub=%s relays=%d",
      shortId(owner.connectionId),
      shortId(owner.windowId),
      request.subId,
      relays.length,
    );
    const pending = { unsubscribe() {} };
    this.#subscriptions.set(subscriptionKey, pending);
    const stream = this.#options.pool.req(relays, request.filters).pipe(
      finalize(() => this.#subscriptions.delete(subscriptionKey)),
    ).subscribe((item) => {
      if (!this.#subscriptions.has(subscriptionKey) || item.type === "EOSE") {
        return;
      }
      if (seen.has(item.event.id)) return;
      seen.add(item.event.id);
      debug(
        "event connection=%s window=%s sub=%s event=%s from=%s",
        shortId(owner.connectionId),
        shortId(owner.windowId),
        request.subId,
        shortId(item.event.id),
        item.from || "unknown",
      );
      listener({
        type: "outbox.event",
        subId: request.subId,
        result: {
          event: item.event,
          sidecar: item.from ? { relayHints: [item.from] } : undefined,
        },
      });
    });
    if (this.#subscriptions.get(subscriptionKey) === pending) {
      this.#subscriptions.set(subscriptionKey, stream);
    } else {
      stream.unsubscribe();
    }
    let closed = false;
    return {
      close: () => {
        if (closed) return;
        closed = true;
        debug(
          "subscription close requested connection=%s window=%s sub=%s",
          shortId(owner.connectionId),
          shortId(owner.windowId),
          request.subId,
        );
        this.#close(subscriptionKey);
        listener({ type: "outbox.closed", subId: request.subId });
      },
    };
  }

  async publish(
    id: string,
    template: EventTemplate,
    authority?: IdentitySnapshot,
  ): Promise<OutboxPublishResult> {
    const identity = this.#options.identity();
    if (identity.status !== "active" || !identity.pubkey) {
      debug(
        "publish rejected signer unavailable id=%s status=%s",
        shortId(id),
        identity.status,
      );
      return { id, ok: false, error: "signer unavailable", outcomes: [] };
    }
    if (authority && !sameAuthority(identity, authority)) {
      return { id, ok: false, error: "not authorized", outcomes: [] };
    }
    let event: NostrEvent;
    try {
      debug(
        "publish signing started id=%s pubkey=%s",
        shortId(id),
        shortId(identity.pubkey),
      );
      event = await this.#options.signEvent(template);
    } catch {
      debug("publish signing failed id=%s", shortId(id));
      return { id, ok: false, error: "event signing failed", outcomes: [] };
    }
    if (
      !sameAuthority(this.#options.identity(), identity) ||
      event.pubkey !== identity.pubkey
    ) return { id, ok: false, error: "not authorized", outcomes: [] };
    const relays = this.#relays(identity.pubkey);
    const outcomes = await Promise.all(
      relays.map(async (relay) => {
        if (!sameAuthority(this.#options.identity(), identity)) {
          return { relay, accepted: false };
        }
        try {
          return {
            relay,
            accepted: await this.#options.pool.publish(relay, event),
          };
        } catch {
          return { relay, accepted: false };
        }
      }),
    );
    if (!sameAuthority(this.#options.identity(), identity)) {
      return { id, ok: false, error: "not authorized", outcomes };
    }
    if (outcomes.length > 0 && outcomes.every((outcome) => outcome.accepted)) {
      debug(
        "publish accepted id=%s event=%s relays=%d",
        shortId(id),
        shortId(event.id),
        outcomes.length,
      );
      return { id, ok: true, event, outcomes };
    }
    debug(
      "publish rejected id=%s event=%s accepted=%d total=%d",
      shortId(id),
      shortId(event.id),
      outcomes.filter((outcome) => outcome.accepted).length,
      outcomes.length,
    );
    return {
      id,
      ok: false,
      error: "required relay rejected publish",
      outcomes,
    };
  }

  destroy(): void {
    debug("destroy started subscriptions=%d", this.#subscriptions.size);
    for (const subscriptionKey of [...this.#subscriptions.keys()]) {
      this.#close(subscriptionKey);
    }
    debug("destroy complete");
  }

  #relays(pinnedPubkey?: string): readonly string[] {
    const pubkey = pinnedPubkey ?? this.#options.identity().pubkey;
    const nip65 = pubkey ? this.#options.nip65Relays(pubkey) : [];
    return this.#options.relayPolicy
      ? this.#options.relayPolicy.write({ inboxes: [], outboxes: nip65 })
      : [...new Set([...this.#options.presetRelays, ...nip65])];
  }

  #close(subscriptionKey: string): void {
    const subscription = this.#subscriptions.get(subscriptionKey);
    this.#subscriptions.delete(subscriptionKey);
    subscription?.unsubscribe();
    debug(
      "closed subscription key=%s found=%s count=%d",
      subscriptionKey,
      Boolean(subscription),
      this.#subscriptions.size,
    );
  }
}

function sameAuthority(a: IdentitySnapshot, b: IdentitySnapshot): boolean {
  return a.status === b.status && a.accountId === b.accountId &&
    a.pubkey === b.pubkey && a.generation === b.generation;
}
