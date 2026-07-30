import { injectNappletNamespacePrelude } from "@kehto/shell";
import type { NostrEvent } from "@napplet/core";
import type { RelaySubscribeMessage } from "@napplet/nap/relay";
import type { BehaviorSubject } from "npm:rxjs@7.8.2";
import { debug as rootDebug, shortId } from "../debug.ts";
import { AccountRuntime, type IdentitySnapshot } from "./accounts.ts";
import { resolveVerifiedArtifact } from "./artifacts.ts";
import { ConnectionRegistry } from "./connections.ts";
import { createEventRuntime, type EventRuntime } from "./event_runtime.ts";
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
import type { RuntimeSettingsService } from "./settings.ts";

const debug = rootDebug.extend("runtime");

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
    debug("event listener subscribed count=%d", this.#listeners.size);
    return () => this.#listeners.delete(listener);
  }

  emit(event: RuntimeEvent): void {
    debug(
      "event emitted type=%s listeners=%d",
      event.type,
      this.#listeners.size,
    );
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
      debug(
        "broadcast identity status=%s account=%s windows=%d",
        identity.status,
        shortId(identity.accountId),
        this.#windows.size,
      );
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
    debug(
      "open window connection=%s window=%s",
      shortId(connectionId),
      shortId(windowId),
    );
    this.#closeWindow(windowId);
    this.#windows.set(windowId, send);
    const cleanups = new Set<() => void>();
    this.#windowCleanups.set(windowId, cleanups);
    send({ type: "identity.changed", identity: this.#identity$.value });
    const owner: RelayOwner = { connectionId, windowId };
    return {
      subscribeRelay: (request: RelaySubscribeRequest) => {
        if (!this.#relay) throw new Error("relay service unavailable");
        debug(
          "window relay subscribe connection=%s window=%s sub=%s relay=%s",
          shortId(connectionId),
          shortId(windowId),
          request.subId,
          request.relay,
        );
        const subscription = this.#relay.subscribe(owner, request, send);
        cleanups.add(subscription.close);
        return subscription;
      },
      subscribeOutbox: (request: OutboxSubscribeRequest) => {
        if (!this.#outbox) throw new Error("outbox service unavailable");
        debug(
          "window outbox subscribe connection=%s window=%s sub=%s",
          shortId(connectionId),
          shortId(windowId),
          request.subId,
        );
        const subscription = this.#outbox.subscribe(owner, request, send);
        cleanups.add(subscription.close);
        return subscription;
      },
      close: () => this.#closeWindow(windowId),
    };
  }

  destroy(): void {
    debug("destroy started windows=%d", this.#windows.size);
    for (const windowId of [...this.#windows.keys()]) {
      this.#closeWindow(windowId);
    }
    this.#subscription.unsubscribe();
    this.#outbox?.destroy();
    this.#relay?.destroy();
    this.#cache?.destroy?.();
    debug("destroy complete");
  }

  #closeWindow(windowId: string): void {
    const hadWindow = this.#windows.delete(windowId);
    debug("close window window=%s known=%s", shortId(windowId), hadWindow);
    const cleanups = this.#windowCleanups.get(windowId);
    this.#windowCleanups.delete(windowId);
    for (const cleanup of cleanups ?? []) cleanup();
  }
}

interface PortalRuntimeOptions {
  readonly fixture: Fixture;
  readonly settings?: RuntimeSettingsService;
  readonly eventRuntime?: EventRuntime;
}

export function createPortalRuntime(
  { fixture, settings, eventRuntime = createEventRuntime() }:
    PortalRuntimeOptions,
) {
  debug(
    "create portal runtime fixture=%s",
    shortId(fixture.identity.aggregateHash),
  );
  const accounts = new AccountRuntime();
  const connections = new ConnectionRegistry();
  const relay = new TracerRelayAdapter(fixture.events.initial);
  const events = new RuntimeEvents();
  let destroyed = false;

  return {
    events,
    relay,
    eventRuntime,
    get activeAccount() {
      return accounts.active;
    },
    signIn: (pubkey: string) => accounts.signIn(pubkey),
    signOut: () => accounts.signOut(),
    loadEvent: (id: string) => {
      if (!settings) throw new Error("runtime settings unavailable");
      return eventRuntime.loadEvent(id, settings.settings.relays);
    },
    resolveArtifact: async () => {
      debug("resolve artifact started");
      const resolved = await resolveVerifiedArtifact(fixture);
      debug(
        "resolve artifact complete dTag=%s aggregate=%s",
        resolved.dTag,
        shortId(resolved.aggregateHash),
      );
      return {
        ...resolved,
        indexHtml: injectNappletNamespacePrelude(resolved.indexHtml, {
          domains: ["identity", "relay"],
        }),
      };
    },
    openWindow(connectionId: string, windowId: string, source: object) {
      debug(
        "open tracer window connection=%s window=%s",
        shortId(connectionId),
        shortId(windowId),
      );
      connections.register(connectionId, windowId, source);
      let initialized = false;
      return {
        receive(candidate: object, message: { readonly type?: unknown }) {
          if (!connections.owns(connectionId, windowId, candidate)) {
            debug(
              "ignored foreign tracer message connection=%s window=%s type=%s",
              shortId(connectionId),
              shortId(windowId),
              String(message.type),
            );
            return;
          }
          if (message.type !== "shell.ready" || initialized) {
            debug(
              "ignored tracer message connection=%s window=%s type=%s initialized=%s",
              shortId(connectionId),
              shortId(windowId),
              String(message.type),
              initialized,
            );
            return;
          }
          initialized = true;
          debug(
            "tracer shell initialized connection=%s window=%s",
            shortId(connectionId),
            shortId(windowId),
          );
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
          debug(
            "tracer relay subscribe connection=%s window=%s sub=%s",
            shortId(connectionId),
            shortId(windowId),
            message.subId,
          );
          return relay.subscribe(message, listener);
        },
      };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      eventRuntime.destroy();
      settings?.destroy();
    },
  };
}
