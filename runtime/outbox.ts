import type { EventTemplate, NostrEvent, NostrFilter } from "@napplet/core";
import { finalize, type Observable } from "npm:rxjs@7.8.2";
import type { IdentitySnapshot } from "./accounts.ts";
import type { RelayOwner } from "./relay_adapter.ts";

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
    const seen = new Set<string>();
    const relays = this.#relays();
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
        this.#close(subscriptionKey);
        listener({ type: "outbox.closed", subId: request.subId });
      },
    };
  }

  async publish(
    id: string,
    template: EventTemplate,
  ): Promise<OutboxPublishResult> {
    const identity = this.#options.identity();
    if (identity.status !== "active" || !identity.pubkey) {
      return { id, ok: false, error: "signer unavailable", outcomes: [] };
    }
    let event: NostrEvent;
    try {
      event = await this.#options.signEvent(template);
    } catch {
      return { id, ok: false, error: "event signing failed", outcomes: [] };
    }
    const outcomes = await Promise.all(
      this.#relays().map(async (relay) => {
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
    if (outcomes.length > 0 && outcomes.every((outcome) => outcome.accepted)) {
      return { id, ok: true, event, outcomes };
    }
    return {
      id,
      ok: false,
      error: "required relay rejected publish",
      outcomes,
    };
  }

  destroy(): void {
    for (const subscriptionKey of [...this.#subscriptions.keys()]) {
      this.#close(subscriptionKey);
    }
  }

  #relays(): readonly string[] {
    const pubkey = this.#options.identity().pubkey;
    return [
      ...new Set([
        ...this.#options.presetRelays,
        ...(pubkey ? this.#options.nip65Relays(pubkey) : []),
      ]),
    ];
  }

  #close(subscriptionKey: string): void {
    const subscription = this.#subscriptions.get(subscriptionKey);
    this.#subscriptions.delete(subscriptionKey);
    subscription?.unsubscribe();
  }
}
