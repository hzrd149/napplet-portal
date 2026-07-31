import {
  type NappletStorageSnapshot,
  NappletStorageStore,
} from "./storage_store.ts";

export const STORAGE_QUOTA = Object.freeze({
  aggregateBytes: 512 * 1024,
  keysPerNamespace: 256,
  keyBytes: 1024,
  valueBytes: 64 * 1024,
});

const encoder = new TextEncoder();

export class StorageServiceError extends Error {
  readonly code: "not-authorized" | "quota-exceeded" | "storage-unavailable";

  constructor(
    code: "not-authorized" | "quota-exceeded" | "storage-unavailable",
  ) {
    super(code);
    this.code = code;
  }
}

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
    isCurrent: () => boolean = () => true,
  ): Promise<void> {
    if (
      encoder.encode(key).byteLength > STORAGE_QUOTA.keyBytes ||
      encoder.encode(value).byteLength > STORAGE_QUOTA.valueBytes
    ) return Promise.reject(new StorageServiceError("quota-exceeded"));
    return this.#mutate(
      identity,
      (entries) => {
        entries[key] = value;
      },
      identity,
      isCurrent,
    );
  }

  remove(
    identity: StorageNamespaceIdentity,
    key: string,
    isCurrent: () => boolean = () => true,
  ): Promise<void> {
    return this.#mutate(
      identity,
      (entries) => {
        delete entries[key];
      },
      identity,
      isCurrent,
    );
  }

  #mutate(
    identity: StorageNamespaceIdentity,
    mutation: (entries: Record<string, string>) => void,
    quotaIdentity: StorageNamespaceIdentity,
    isCurrent: () => boolean,
  ): Promise<void> {
    const operation = this.#mutationTail.then(async () => {
      if (!isCurrent()) throw new StorageServiceError("not-authorized");
      const namespaces: Record<string, Record<string, string>> = Object.create(
        null,
      );
      for (const [name, entries] of Object.entries(this.#snapshot.namespaces)) {
        namespaces[name] = { ...entries };
      }
      const name = namespaceKey(identity);
      const entries = namespaces[name] ?? Object.create(null);
      mutation(entries);
      if (Object.keys(entries).length > STORAGE_QUOTA.keysPerNamespace) {
        throw new StorageServiceError("quota-exceeded");
      }
      if (Object.keys(entries).length === 0) delete namespaces[name];
      else namespaces[name] = entries;
      const next = freezeSnapshot(namespaces);
      this.#validateAggregate(next, quotaIdentity);
      try {
        await this.#store.write(next, isCurrent);
      } catch (error) {
        if (error instanceof StorageServiceError) throw error;
        throw new StorageServiceError("storage-unavailable");
      }
      this.#snapshot = next;
    });
    this.#mutationTail = operation.catch(() => undefined);
    return operation;
  }

  #validateAggregate(
    snapshot: NappletStorageSnapshot,
    identity: StorageNamespaceIdentity,
  ): void {
    let bytes = 0;
    for (const [name, entries] of Object.entries(snapshot.namespaces)) {
      let tuple: unknown;
      try {
        tuple = JSON.parse(name);
      } catch {
        continue;
      }
      if (
        !Array.isArray(tuple) || tuple[0] !== identity.accountPubkey ||
        tuple[1] !== identity.coordinate ||
        tuple[2] !== identity.manifestEventId || tuple[3] !== identity.dTag ||
        tuple[4] !== identity.aggregateHash
      ) continue;
      for (const [key, value] of Object.entries(entries)) {
        bytes += encoder.encode(key).byteLength +
          encoder.encode(value).byteLength;
      }
    }
    if (bytes > STORAGE_QUOTA.aggregateBytes) {
      throw new StorageServiceError("quota-exceeded");
    }
  }
}
