import type { EventTemplate, NostrEvent } from "@napplet/core";
import type { EventStore } from "applesauce-core";
import { verifyEvent } from "nostr-tools";
import type { IdentitySnapshot } from "./accounts.ts";
import type { PublishOutcome } from "./outbox.ts";

export const CATALOG_KIND = 30078;
export const CATALOG_IDENTIFIER = "org.napplet.portal:installed";

const HEX_64 = /^[0-9a-f]{64}$/;
const NIP_5A_COORDINATE = /^\d+:[0-9a-f]{64}:[^:\s]+$/;

export interface InstalledNappletEntry {
  readonly coordinate: string;
  readonly acceptedManifestEventId: string;
}

export interface InstalledCatalog {
  readonly version: 1;
  readonly entries: readonly InstalledNappletEntry[];
}

export interface VerifiedCatalogArtifact {
  readonly manifestEventId: string;
  readonly title: string;
  readonly version: string;
  readonly capabilities: readonly string[];
  readonly launch: {
    readonly dTag: string;
    readonly aggregateHash: string;
    readonly srcdoc: string;
  };
}

export interface CatalogProjectionEntry extends InstalledNappletEntry {
  readonly title: string;
  readonly version: string;
  readonly capabilities: readonly string[];
  readonly launch: VerifiedCatalogArtifact["launch"];
}

export interface CatalogProjection {
  readonly catalogEventId: string | null;
  readonly entries: readonly CatalogProjectionEntry[];
}

export type CatalogMutationResult =
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

export interface CatalogServiceOptions {
  readonly eventStore: EventStore;
  readonly identity: () => IdentitySnapshot;
  readonly resolveVerifiedArtifact: (
    coordinate: string,
    manifestEventId: string,
  ) => Promise<VerifiedCatalogArtifact>;
  readonly signEvent: (template: EventTemplate) => Promise<NostrEvent>;
  readonly publish: (event: NostrEvent) => Promise<readonly PublishOutcome[]>;
  readonly now?: () => number;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function parseContent(content: string): InstalledCatalog | null {
  try {
    const value = JSON.parse(content) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const catalog = value as Record<string, unknown>;
    if (
      !exactKeys(catalog, ["version", "entries"]) || catalog.version !== 1 ||
      !Array.isArray(catalog.entries)
    ) return null;
    const entries: InstalledNappletEntry[] = [];
    const coordinates = new Set<string>();
    for (const candidate of catalog.entries) {
      if (
        !candidate || typeof candidate !== "object" || Array.isArray(candidate)
      ) return null;
      const entry = candidate as Record<string, unknown>;
      if (
        !exactKeys(entry, ["coordinate", "acceptedManifestEventId"]) ||
        typeof entry.coordinate !== "string" ||
        !NIP_5A_COORDINATE.test(entry.coordinate) ||
        typeof entry.acceptedManifestEventId !== "string" ||
        !HEX_64.test(entry.acceptedManifestEventId) ||
        coordinates.has(entry.coordinate)
      ) return null;
      coordinates.add(entry.coordinate);
      entries.push(Object.freeze({
        coordinate: entry.coordinate,
        acceptedManifestEventId: entry.acceptedManifestEventId,
      }));
    }
    return Object.freeze({ version: 1, entries: Object.freeze(entries) });
  } catch {
    return null;
  }
}

export function decodeCatalogEvent(
  event: NostrEvent,
  activePubkey: string,
): InstalledCatalog | null {
  if (
    event.kind !== CATALOG_KIND || event.pubkey !== activePubkey ||
    !verifyEvent(event)
  ) return null;
  const dTags = event.tags.filter((tag) => tag[0] === "d");
  if (
    dTags.length !== 1 || dTags[0].length !== 2 ||
    dTags[0][1] !== CATALOG_IDENTIFIER
  ) return null;
  return parseContent(event.content);
}

const EMPTY: CatalogProjection = Object.freeze({
  catalogEventId: null,
  entries: Object.freeze([]),
});

export class CatalogService {
  readonly options: CatalogServiceOptions;
  #mutationTail: Promise<void> = Promise.resolve();
  readonly #listeners = new Set<() => void>();

  constructor(options: CatalogServiceOptions) {
    this.options = options;
  }

  load(events: readonly NostrEvent[]): number {
    const pubkey = this.options.identity().pubkey;
    if (!pubkey) return 0;
    let accepted = 0;
    for (const event of events) {
      if (!decodeCatalogEvent(event, pubkey)) continue;
      if (this.options.eventStore.add(event)) accepted++;
    }
    if (accepted > 0) this.#notify();
    return accepted;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async project(): Promise<CatalogProjection> {
    const identity = this.options.identity();
    if (!identity.pubkey) return EMPTY;
    const event = this.options.eventStore.getReplaceable(
      CATALOG_KIND,
      identity.pubkey,
      CATALOG_IDENTIFIER,
    );
    if (!event) return EMPTY;
    const catalog = decodeCatalogEvent(event, identity.pubkey);
    if (!catalog) return EMPTY;
    const entries: CatalogProjectionEntry[] = [];
    for (const entry of catalog.entries) {
      try {
        const verified = await this.options.resolveVerifiedArtifact(
          entry.coordinate,
          entry.acceptedManifestEventId,
        );
        if (verified.manifestEventId !== entry.acceptedManifestEventId) {
          continue;
        }
        entries.push(Object.freeze({
          ...entry,
          title: verified.title,
          version: verified.version,
          capabilities: Object.freeze([...verified.capabilities]),
          launch: Object.freeze({ ...verified.launch }),
        }));
      } catch {
        // A public catalog entry is not launchable until its accepted manifest
        // passes the existing artifact integrity boundary.
      }
    }
    return Object.freeze({
      catalogEventId: event.id,
      entries: Object.freeze(entries),
    });
  }

  approveManifestUpdate(
    id: string,
    coordinate: string,
    manifestEventId: string,
  ): Promise<CatalogMutationResult> {
    return this.#serialize(() =>
      this.#mutate(id, async (entries) => {
        const verified = await this.options.resolveVerifiedArtifact(
          coordinate,
          manifestEventId,
        );
        if (verified.manifestEventId !== manifestEventId) {
          throw new Error("manifest verification mismatch");
        }
        const next = entries.filter((entry) => entry.coordinate !== coordinate);
        next.push({ coordinate, acceptedManifestEventId: manifestEventId });
        return next;
      })
    );
  }

  uninstallNapplet(
    id: string,
    coordinate: string,
  ): Promise<CatalogMutationResult> {
    return this.#serialize(() =>
      this.#mutate(
        id,
        (entries) =>
          Promise.resolve(
            entries.filter((entry) => entry.coordinate !== coordinate),
          ),
      )
    );
  }

  #serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#mutationTail.then(operation, operation);
    this.#mutationTail = result.then(() => undefined, () => undefined);
    return result;
  }

  async #mutate(
    id: string,
    update: (
      entries: InstalledNappletEntry[],
    ) => Promise<InstalledNappletEntry[]>,
  ): Promise<CatalogMutationResult> {
    const identity = this.options.identity();
    if (identity.status !== "active" || !identity.pubkey) {
      return { id, ok: false, error: "signer unavailable", outcomes: [] };
    }
    const currentEvent = this.options.eventStore.getReplaceable(
      CATALOG_KIND,
      identity.pubkey,
      CATALOG_IDENTIFIER,
    );
    const current = currentEvent
      ? decodeCatalogEvent(currentEvent, identity.pubkey)
      : null;
    try {
      const entries = await update([...(current?.entries ?? [])]);
      const createdAt = Math.max(
        this.options.now?.() ?? Math.floor(Date.now() / 1000),
        (currentEvent?.created_at ?? 0) + 1,
      );
      const event = await this.options.signEvent({
        kind: CATALOG_KIND,
        created_at: createdAt,
        tags: [["d", CATALOG_IDENTIFIER]],
        content: JSON.stringify({ version: 1, entries }),
      });
      if (
        event.pubkey !== identity.pubkey ||
        !decodeCatalogEvent(event, identity.pubkey)
      ) return { id, ok: false, error: "event signing failed", outcomes: [] };
      const outcomes = await this.options.publish(event);
      if (
        outcomes.length === 0 || outcomes.some((outcome) => !outcome.accepted)
      ) {
        return {
          id,
          ok: false,
          error: "required relay rejected publish",
          outcomes,
        };
      }
      this.options.eventStore.add(event);
      this.#notify();
      return { id, ok: true, event, outcomes };
    } catch {
      return { id, ok: false, error: "catalog mutation failed", outcomes: [] };
    }
  }

  #notify(): void {
    for (const listener of this.#listeners) listener();
  }
}
