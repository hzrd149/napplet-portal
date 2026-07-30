import { injectNappletNamespacePrelude } from "@kehto/shell";
import type { NostrEvent } from "@napplet/core";
import type { RelaySubscribeMessage } from "@napplet/nap/relay";
import { AccountRuntime } from "./accounts.ts";
import { resolveVerifiedArtifact } from "./artifacts.ts";
import { ConnectionRegistry } from "./connections.ts";
import { TracerRelayAdapter } from "./relay_adapter.ts";

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

export function createPortalRuntime({ fixture }: { fixture: Fixture }) {
  const accounts = new AccountRuntime();
  const connections = new ConnectionRegistry();
  const relay = new TracerRelayAdapter(fixture.events.initial);
  const events = new RuntimeEvents();

  return {
    events,
    relay,
    signIn: (pubkey: string) => accounts.signIn(pubkey),
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
        receive(candidate: object, message: Record<string, unknown>) {
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
