import type { NostrEvent } from "@napplet/core";
import { EventStore } from "applesauce-core";
import { Loaders } from "applesauce-loaders";
import { RelayPool } from "applesauce-relay";
import type { Filter } from "nostr-tools";
import {
  combineLatest,
  firstValueFrom,
  type Observable,
  type Subscription,
} from "npm:rxjs@7.8.2";
import type { IdentitySnapshot } from "./accounts.ts";
import type { CatalogService } from "./catalog.ts";
import type { RelayPolicy } from "./relay_policy.ts";

type Request = (
  relays: string[],
  filters: Filter[],
) => Observable<NostrEvent>;

export interface EventRuntimeOptions {
  readonly request?: Request;
  readonly relayPolicy?: RelayPolicy;
}

export class EventRuntime {
  readonly eventStore: EventStore;
  readonly relayPool: RelayPool;
  readonly loader: ReturnType<typeof Loaders.createEventLoaderForStore>;
  readonly #policy?: RelayPolicy;
  readonly #request: Request;
  destroyed = false;

  constructor(options: EventRuntimeOptions = {}) {
    this.#policy = options.relayPolicy;
    this.eventStore = new EventStore();
    this.relayPool = new RelayPool();
    this.#request = options.request ??
      ((relays, filters) => this.relayPool.request(relays, filters));
    const upstream: Parameters<typeof Loaders.createEventLoaderForStore>[1] = {
      request: this.#request,
    };
    this.loader = Loaders.createEventLoaderForStore(
      this.eventStore,
      upstream,
      { bufferTime: 0 },
    );
  }

  refreshReplaceable(
    kind: 0 | 3,
    pubkey: string,
    relays: readonly string[],
    timeoutMs = 5_000,
  ): () => void {
    if (this.destroyed) return () => undefined;
    const eligible = this.#policy
      ? this.#policy.read({ inboxes: relays, outboxes: [] })
      : relays;
    const subscription = this.#request([...eligible], [{
      kinds: [kind],
      authors: [pubkey],
    }]).subscribe({
      next: (event) => this.eventStore.add(event),
      error: () => undefined,
    });
    const timer = setTimeout(() => subscription.unsubscribe(), timeoutMs);
    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }

  loadManifest(
    coordinate: string,
    relays: readonly string[],
    exactId?: string,
  ): Promise<NostrEvent | undefined> {
    const [kindText, pubkey, identifier] = coordinate.split(":");
    const kind = Number(kindText);
    if (kind !== 35129 || !pubkey || !identifier) {
      return Promise.reject(new Error("invalid manifest coordinate"));
    }
    if (exactId) return this.loadEvent(exactId, relays);
    const eligible = this.#policy
      ? this.#policy.read({ inboxes: relays, outboxes: [] })
      : relays;
    return firstValueFrom(
      this.#request([...eligible], [{
        kinds: [kind],
        authors: [pubkey],
        "#d": [identifier],
        limit: 1,
      }]),
      { defaultValue: undefined },
    );
  }

  subscribeCatalog(
    relays: readonly string[],
    pubkey: string,
  ): Observable<NostrEvent> {
    if (this.destroyed) throw new Error("Event runtime is destroyed");
    const eligible = this.#policy
      ? this.#policy.read({ inboxes: relays, outboxes: [] })
      : relays;
    return this.#request([...eligible], [{
      kinds: [30078],
      authors: [pubkey],
      "#d": ["org.napplet.portal:installed"],
    }]);
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
    const eligible = this.#policy
      ? this.#policy.read({ inboxes: relays, outboxes: [] })
      : relays;
    return firstValueFrom(
      this.loader({ id, relays: [...eligible] }),
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

export interface CatalogSyncOwnerOptions {
  readonly eventRuntime: EventRuntime;
  readonly catalog: CatalogService;
  readonly identity$: Observable<IdentitySnapshot>;
  readonly configuredReads$: Observable<readonly string[]>;
  readonly relayPolicy: (configured: readonly string[]) => RelayPolicy;
}

export class CatalogSyncOwner {
  readonly #options: CatalogSyncOwnerOptions;
  readonly #sources: Subscription;
  #active?: Subscription;
  #generation = 0;
  #latest?: { identity: IdentitySnapshot; relays: readonly string[] };

  constructor(options: CatalogSyncOwnerOptions) {
    this.#options = options;
    this.#sources = combineLatest([
      options.identity$,
      options.configuredReads$,
    ]).subscribe(([identity, relays]) => this.#replace(identity, relays));
  }

  reconnect(): void {
    if (this.#latest) {
      this.#options.catalog.markStale();
      this.#replace(this.#latest.identity, this.#latest.relays, false);
    }
  }

  destroy(): void {
    this.#generation++;
    this.#active?.unsubscribe();
    this.#active = undefined;
    this.#sources.unsubscribe();
  }

  #replace(
    identity: IdentitySnapshot,
    configured: readonly string[],
    accountSignal = true,
  ): void {
    const previousPubkey = this.#latest?.identity.pubkey;
    this.#latest = { identity, relays: configured };
    this.#active?.unsubscribe();
    this.#active = undefined;
    const generation = ++this.#generation;
    if (accountSignal && previousPubkey !== identity.pubkey) {
      this.#options.catalog.resetAccount();
    }
    if (!identity.pubkey) return;
    const relays = this.#options.relayPolicy(configured).read();
    this.#options.catalog.markLoading();
    const source = this.#options.eventRuntime.subscribeCatalog(
      relays,
      identity.pubkey,
    );
    this.#active = source.subscribe({
      next: (event) => {
        if (generation === this.#generation) {
          this.#options.catalog.load([event]);
        }
      },
      complete: () => {
        if (generation === this.#generation) this.#options.catalog.markReady();
      },
      error: (error) => {
        if (generation === this.#generation) {
          this.#options.catalog.markError(
            error instanceof Error ? error.message : "catalog relay error",
          );
        }
      },
    });
  }
}

export function createEventRuntime(
  options: EventRuntimeOptions = {},
): EventRuntime {
  return new EventRuntime(options);
}
