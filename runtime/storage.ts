import {
  type NappletStorageSnapshot,
  NappletStorageStore,
} from "./storage_store.ts";

export interface StorageNamespaceIdentity {
  readonly accountPubkey: string;
  readonly coordinate: string;
  readonly manifestEventId: string;
  readonly dTag: string;
  readonly aggregateHash: string;
  readonly scope: "shared" | "instance";
  readonly instanceId: string;
}

function namespaceKey(identity: StorageNamespaceIdentity): string {
  return JSON.stringify([
    identity.accountPubkey,
    identity.coordinate,
    identity.manifestEventId,
    identity.dTag,
    identity.aggregateHash,
    identity.scope,
    identity.scope === "instance" ? identity.instanceId : "",
  ]);
}

function freezeSnapshot(
  namespaces: Record<string, Record<string, string>>,
): NappletStorageSnapshot {
  const frozen: Record<string, Readonly<Record<string, string>>> = Object
    .create(null);
  for (const namespace of Object.keys(namespaces)) {
    frozen[namespace] = Object.freeze(namespaces[namespace]);
  }
  return Object.freeze({ version: 1, namespaces: Object.freeze(frozen) });
}

export class StorageService {
  readonly #store: NappletStorageStore;
  #snapshot: NappletStorageSnapshot;
  #mutationTail: Promise<void> = Promise.resolve();

  private constructor(
    store: NappletStorageStore,
    snapshot: NappletStorageSnapshot,
  ) {
    this.#store = store;
    this.#snapshot = snapshot;
  }

  static async open(store: NappletStorageStore): Promise<StorageService> {
    return new StorageService(store, await store.read());
  }

  get(identity: StorageNamespaceIdentity, key: string): string | null {
    return this.#snapshot.namespaces[namespaceKey(identity)]?.[key] ?? null;
  }

  keys(identity: StorageNamespaceIdentity): string[] {
    return Object.keys(this.#snapshot.namespaces[namespaceKey(identity)] ?? {})
      .sort();
  }

  set(
    identity: StorageNamespaceIdentity,
    key: string,
    value: string,
  ): Promise<void> {
    return this.#mutate(identity, (entries) => {
      entries[key] = value;
    });
  }

  remove(identity: StorageNamespaceIdentity, key: string): Promise<void> {
    return this.#mutate(identity, (entries) => {
      delete entries[key];
    });
  }

  #mutate(
    identity: StorageNamespaceIdentity,
    mutation: (entries: Record<string, string>) => void,
  ): Promise<void> {
    const operation = this.#mutationTail.then(async () => {
      const namespaces: Record<string, Record<string, string>> = Object.create(
        null,
      );
      for (const [name, entries] of Object.entries(this.#snapshot.namespaces)) {
        namespaces[name] = { ...entries };
      }
      const name = namespaceKey(identity);
      const entries = namespaces[name] ?? Object.create(null);
      mutation(entries);
      if (Object.keys(entries).length === 0) delete namespaces[name];
      else namespaces[name] = entries;
      const next = freezeSnapshot(namespaces);
      await this.#store.write(next);
      this.#snapshot = next;
    });
    this.#mutationTail = operation.catch(() => undefined);
    return operation;
  }
}
