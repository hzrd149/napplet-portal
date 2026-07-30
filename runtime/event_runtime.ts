import type { NostrEvent } from "@napplet/core";
import { EventStore } from "applesauce-core";
import { Loaders } from "applesauce-loaders";
import { RelayPool } from "applesauce-relay";
import type { Filter } from "nostr-tools";
import { firstValueFrom, type Observable } from "npm:rxjs@7.8.2";

type Request = (
  relays: string[],
  filters: Filter[],
) => Observable<NostrEvent>;

export interface EventRuntimeOptions {
  readonly request?: Request;
}

export class EventRuntime {
  readonly eventStore: EventStore;
  readonly relayPool: RelayPool;
  readonly loader: ReturnType<typeof Loaders.createEventLoaderForStore>;
  destroyed = false;

  constructor(options: EventRuntimeOptions = {}) {
    this.eventStore = new EventStore();
    this.relayPool = new RelayPool();
    const upstream: Parameters<typeof Loaders.createEventLoaderForStore>[1] =
      options.request ? { request: options.request } : this.relayPool;
    this.loader = Loaders.createEventLoaderForStore(
      this.eventStore,
      upstream,
      { bufferTime: 0 },
    );
  }

  loadEvent(
    id: string,
    relays: readonly string[],
  ): Promise<NostrEvent | undefined> {
    if (this.destroyed) {
      return Promise.reject(new Error("Event runtime is destroyed"));
    }
    const existing = this.eventStore.getEvent(id);
    if (existing) return Promise.resolve(existing);
    return firstValueFrom(
      this.loader({ id, relays: [...relays] }),
      { defaultValue: undefined },
    );
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.eventStore.dispose();
    this.relayPool.close();
  }
}

export function createEventRuntime(
  options: EventRuntimeOptions = {},
): EventRuntime {
  return new EventRuntime(options);
}
