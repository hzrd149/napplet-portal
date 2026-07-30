import { injectNappletNamespacePrelude } from "@kehto/shell";
import type { NostrEvent } from "@napplet/core";
import type { RelaySubscribeMessage } from "@napplet/nap/relay";
import type { BehaviorSubject } from "npm:rxjs@7.8.2";
import { AccountRuntime, type IdentitySnapshot } from "./accounts.ts";
import { resolveVerifiedArtifact } from "./artifacts.ts";
import { ConnectionRegistry } from "./connections.ts";
import type {
  OutboxAdapter,
  OutboxStreamMessage,
  OutboxSubscribeRequest,
} from "./outbox.ts";
import {
  type BackendRelayAdapter,
  type RelayOwner,
  type RelayStreamMessage,
  type RelaySubscribeRequest,
  TracerRelayAdapter,
} from "./relay_adapter.ts";

interface Fixture {
  readonly identity: { readonly aggregateHash: string };
  readonly manifestEvent: NostrEvent;
  readonly artifact: { readonly servers: readonly string[] };
  readonly events: { readonly initial: NostrEvent };
}

export interface RuntimeEvent {
  readonly type: string;
  readonly message?: Record<string, unknown>;
}

class RuntimeEvents {
  readonly #listeners = new Set<(event: RuntimeEvent) => void>();

  subscribe(listener: (event: RuntimeEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  emit(event: RuntimeEvent): void {
    for (const listener of this.#listeners) listener(event);
  }
}

export interface IdentityRuntimeMessage {
  readonly type: "identity.changed";
  readonly identity: IdentitySnapshot;
}

type ServiceMessage =
  | IdentityRuntimeMessage
  | RelayStreamMessage
  | OutboxStreamMessage;

interface RuntimeServiceHubOptions {
  readonly identity$: BehaviorSubject<IdentitySnapshot>;
  readonly relay?: BackendRelayAdapter;
  readonly outbox?: OutboxAdapter;
  readonly cache?: { destroy?(): void };
}

export class RuntimeServiceHub {
  readonly #identity$: BehaviorSubject<IdentitySnapshot>;
  readonly #windows = new Map<string, (message: ServiceMessage) => void>();
  readonly #subscription: { unsubscribe(): void };
  readonly #relay?: BackendRelayAdapter;
  readonly #outbox?: OutboxAdapter;
  readonly #cache?: { destroy?(): void };
  readonly #windowCleanups = new Map<string, Set<() => void>>();

  constructor(options: RuntimeServiceHubOptions) {
    this.#identity$ = options.identity$;
    this.#relay = options.relay;
    this.#outbox = options.outbox;
    this.#cache = options.cache;
    this.#subscription = this.#identity$.subscribe((identity) => {
      const message: IdentityRuntimeMessage = {
        type: "identity.changed",
        identity,
      };
      for (const send of this.#windows.values()) send(message);
    });
  }

  openWindow(
    windowId: string,
    send: (message: ServiceMessage) => void,
    connectionId = "runtime",
  ) {
    this.#closeWindow(windowId);
    this.#windows.set(windowId, send);
    const cleanups = new Set<() => void>();
    this.#windowCleanups.set(windowId, cleanups);
    send({ type: "identity.changed", identity: this.#identity$.value });
    const owner: RelayOwner = { connectionId, windowId };
    return {
      subscribeRelay: (request: RelaySubscribeRequest) => {
        if (!this.#relay) throw new Error("relay service unavailable");
        const subscription = this.#relay.subscribe(owner, request, send);
        cleanups.add(subscription.close);
        return subscription;
      },
      subscribeOutbox: (request: OutboxSubscribeRequest) => {
        if (!this.#outbox) throw new Error("outbox service unavailable");
        const subscription = this.#outbox.subscribe(owner, request, send);
        cleanups.add(subscription.close);
        return subscription;
      },
      close: () => this.#closeWindow(windowId),
    };
  }

  destroy(): void {
    for (const windowId of [...this.#windows.keys()]) {
      this.#closeWindow(windowId);
    }
    this.#subscription.unsubscribe();
    this.#outbox?.destroy();
    this.#relay?.destroy();
    this.#cache?.destroy?.();
  }

  #closeWindow(windowId: string): void {
    this.#windows.delete(windowId);
    const cleanups = this.#windowCleanups.get(windowId);
    this.#windowCleanups.delete(windowId);
    for (const cleanup of cleanups ?? []) cleanup();
  }
}

export function createPortalRuntime({ fixture }: { fixture: Fixture }) {
  const accounts = new AccountRuntime();
  const connections = new ConnectionRegistry();
  const relay = new TracerRelayAdapter(fixture.events.initial);
  const events = new RuntimeEvents();

  return {
    events,
    relay,
    signIn: (pubkey: string) => accounts.signIn(pubkey),
    signOut: () => accounts.signOut(),
    resolveArtifact: async () => {
      const resolved = await resolveVerifiedArtifact(fixture);
      return {
        ...resolved,
        indexHtml: injectNappletNamespacePrelude(resolved.indexHtml, {
          domains: ["identity", "relay"],
        }),
      };
    },
    openWindow(connectionId: string, windowId: string, source: object) {
      connections.register(connectionId, windowId, source);
      let initialized = false;
      return {
        receive(candidate: object, message: { readonly type?: unknown }) {
          if (!connections.owns(connectionId, windowId, candidate)) return;
          if (message.type !== "shell.ready" || initialized) return;
          initialized = true;
          events.emit({
            type: "shell.init",
            message: {
              type: "shell.init",
              capabilities: { domains: ["identity", "relay"] },
              services: ["identity", "relay"],
            },
          });
        },
        subscribeRelay(
          message: RelaySubscribeMessage,
          listener: Parameters<TracerRelayAdapter["subscribe"]>[1],
        ) {
          return relay.subscribe(message, listener);
        },
      };
    },
  };
}
