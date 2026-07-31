import type { EventTemplate, NostrEvent } from "@napplet/core";
import type { EventStore } from "applesauce-core";
import { nip19, verifyEvent } from "nostr-tools";
import type { IdentitySnapshot } from "./accounts.ts";
import type { PublishOutcome } from "./outbox.ts";
import type { RelayPolicy } from "./relay_policy.ts";

export const CATALOG_KIND = 30078;
export const CATALOG_IDENTIFIER = "org.napplet.portal:installed";

const HEX_64 = /^[0-9a-f]{64}$/;
const NIP_5A_COORDINATE = /^\d+:[0-9a-f]{64}:[^:\s]+$/;
const ARCHETYPE_SLUG = /^[a-z][a-z0-9-]*$/;
const CONVENTION = /^napplet:([^/?#\s]+)\/([^/?#\s]+)$/;
const COMPONENT_LIMIT = 128;

export interface ArchetypeDeclaration {
  readonly archetype: string;
  readonly action: string;
  readonly convention: string;
}

export function decodeArchetypeDeclarations(
  tags: readonly (readonly string[])[],
): readonly ArchetypeDeclaration[] {
  const declarations: ArchetypeDeclaration[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    if (
      tag.length !== 3 || tag[0] !== "archetype" ||
      tag[1].length > COMPONENT_LIMIT || tag[2].length > COMPONENT_LIMIT ||
      !ARCHETYPE_SLUG.test(tag[1])
    ) continue;
    const match = CONVENTION.exec(tag[2]);
    if (
      !match || match[1] !== tag[1] || match[2].length > COMPONENT_LIMIT ||
      !ARCHETYPE_SLUG.test(match[2])
    ) continue;
    const key = `${tag[1]}\0${tag[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    declarations.push(Object.freeze({
      archetype: tag[1],
      action: match[2],
      convention: tag[2],
    }));
  }
  return Object.freeze(declarations);
}

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
  readonly declarations: readonly ArchetypeDeclaration[];
  readonly launch: {
    readonly dTag: string;
    readonly aggregateHash: string;
    readonly srcdoc: string;
  };
}

export interface CatalogProjectionEntry extends InstalledNappletEntry {
  readonly resolution: "pending" | "ready" | "unavailable";
  readonly title?: string;
  readonly version?: string;
  readonly capabilities?: readonly string[];
}

export interface CatalogProjection {
  readonly catalogEventId: string | null;
  readonly entries: readonly CatalogProjectionEntry[];
  readonly status?: "idle" | "refreshing" | "ready" | "stale" | "error";
  readonly error?: string;
}

export interface InstallPreview {
  readonly publisher: string;
  readonly coordinate: string;
  readonly manifestEventId: string;
  readonly title: string;
  readonly version: string;
  readonly aggregateHash: string;
  readonly capabilities: readonly string[];
  readonly sourceCatalogEventId: string | null;
}

export type CatalogAuthorityResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string; readonly retryable: boolean };

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
  readonly relayPolicy?: RelayPolicy;
  readonly configuredReadRelays?: () => readonly string[];
  readonly resolvePreviewArtifact?: (
    coordinate: string,
    relays: readonly string[],
  ) => Promise<VerifiedCatalogArtifact>;
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
  status: "idle",
});

export class CatalogService {
  readonly options: CatalogServiceOptions;
  #mutationTail: Promise<void> = Promise.resolve();
  readonly #listeners = new Set<() => void>();
  #projection: CatalogProjection = EMPTY;
  readonly #inflight = new Map<string, Promise<void>>();
  readonly #verified = new Map<string, VerifiedCatalogArtifact>();
  readonly #queue: Array<() => Promise<void>> = [];
  #activeJobs = 0;

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
    if (accepted > 0) this.#refresh();
    return accepted;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  project(): Promise<CatalogProjection> {
    this.#refresh();
    return Promise.resolve(this.#projection);
  }

  acceptsManifest(coordinate: string, manifestEventId: string): boolean {
    this.#refresh();
    return this.#projection.entries.some((entry) =>
      entry.coordinate === coordinate &&
      entry.acceptedManifestEventId === manifestEventId
    );
  }

  authoritySnapshot(): {
    readonly accountPubkey: string | null;
    readonly catalogEventId: string | null;
    readonly status: CatalogProjection["status"];
    readonly artifacts: readonly {
      readonly coordinate: string;
      readonly acceptedManifestEventId: string;
      readonly artifact: VerifiedCatalogArtifact;
    }[];
  } {
    const artifacts = this.#projection.entries.flatMap((entry) => {
      if (entry.resolution !== "ready") return [];
      const artifact = this.#verified.get(
        `${this.#projection.catalogEventId}:${entry.coordinate}:${entry.acceptedManifestEventId}`,
      );
      return artifact
        ? [{
          coordinate: entry.coordinate,
          acceptedManifestEventId: entry.acceptedManifestEventId,
          artifact,
        }]
        : [];
    });
    return Object.freeze({
      accountPubkey: this.options.identity().pubkey,
      catalogEventId: this.#projection.catalogEventId,
      status: this.#projection.status,
      artifacts: Object.freeze(artifacts),
    });
  }

  retry(): void {
    this.#refresh(true);
  }

  resetAccount(): void {
    this.#verified.clear();
    this.#projection = EMPTY;
    this.#notify();
  }

  markLoading(): void {
    this.#projection = Object.freeze({
      ...this.#projection,
      status: "refreshing",
      error: undefined,
    });
    this.#notify();
  }

  markReady(): void {
    this.#projection = Object.freeze({
      ...this.#projection,
      status: "ready",
      error: undefined,
    });
    this.#notify();
  }

  markStale(): void {
    this.#projection = Object.freeze({ ...this.#projection, status: "stale" });
    this.#notify();
  }

  markError(message: string): void {
    this.#projection = Object.freeze({
      ...this.#projection,
      status: "error",
      error: message,
    });
    this.#notify();
  }

  #refresh(force = false): void {
    const identity = this.options.identity();
    if (!identity.pubkey) {
      if (this.#projection !== EMPTY) {
        this.#projection = EMPTY;
        this.#notify();
      }
      return;
    }
    const event = this.options.eventStore.getReplaceable(
      CATALOG_KIND,
      identity.pubkey,
      CATALOG_IDENTIFIER,
    );
    if (!event) {
      if (this.#projection !== EMPTY) {
        this.#projection = EMPTY;
        this.#notify();
      }
      return;
    }
    const catalog = decodeCatalogEvent(event, identity.pubkey);
    if (!catalog) {
      if (this.#projection.entries.length > 0) {
        this.#projection = Object.freeze({
          ...this.#projection,
          status: "error",
          error: "catalog refresh failed",
        });
        this.#notify();
      }
      return;
    }
    const previous = this.#projection.catalogEventId === event.id
      ? new Map(
        this.#projection.entries.map((entry) => [entry.coordinate, entry]),
      )
      : new Map<string, CatalogProjectionEntry>();
    const entries = catalog.entries.map((entry): CatalogProjectionEntry => {
      const held = previous.get(entry.coordinate);
      if (
        !force &&
        held?.acceptedManifestEventId === entry.acceptedManifestEventId
      ) return held;
      return Object.freeze({ ...entry, resolution: "pending" });
    });
    this.#projection = Object.freeze({
      catalogEventId: event.id,
      entries: Object.freeze(entries),
      status: "refreshing",
    });
    this.#notify();
    for (const entry of catalog.entries) {
      const current = previous.get(entry.coordinate);
      if (
        force ||
        current?.acceptedManifestEventId !== entry.acceptedManifestEventId ||
        current.resolution !== "ready"
      ) {
        this.#enqueue(identity.pubkey, event.id, entry);
      }
    }
  }

  #enqueue(
    pubkey: string,
    catalogEventId: string,
    entry: InstalledNappletEntry,
  ): void {
    const key =
      `${pubkey}:${catalogEventId}:${entry.coordinate}:${entry.acceptedManifestEventId}`;
    if (this.#inflight.has(key)) return;
    const task = new Promise<void>((resolve) => {
      this.#queue.push(async () => {
        try {
          const verified = await this.options.resolveVerifiedArtifact(
            entry.coordinate,
            entry.acceptedManifestEventId,
          );
          this.#applyEnrichment(
            pubkey,
            catalogEventId,
            entry,
            verified.manifestEventId === entry.acceptedManifestEventId
              ? verified
              : undefined,
          );
        } catch {
          this.#applyEnrichment(pubkey, catalogEventId, entry);
        } finally {
          this.#inflight.delete(key);
          resolve();
        }
      });
    });
    this.#inflight.set(key, task);
    this.#drain();
  }

  #drain(): void {
    while (this.#activeJobs < 4 && this.#queue.length > 0) {
      const job = this.#queue.shift()!;
      this.#activeJobs++;
      void job().finally(() => {
        this.#activeJobs--;
        this.#drain();
      });
    }
  }

  #applyEnrichment(
    pubkey: string,
    catalogEventId: string,
    expected: InstalledNappletEntry,
    verified?: VerifiedCatalogArtifact,
  ): void {
    if (
      this.options.identity().pubkey !== pubkey ||
      this.#projection.catalogEventId !== catalogEventId
    ) return;
    const index = this.#projection.entries.findIndex((entry) =>
      entry.coordinate === expected.coordinate &&
      entry.acceptedManifestEventId === expected.acceptedManifestEventId
    );
    if (index < 0) return;
    const entries = [...this.#projection.entries];
    entries[index] = verified
      ? Object.freeze({
        ...expected,
        resolution: "ready",
        title: verified.title,
        version: verified.version,
        capabilities: Object.freeze([...verified.capabilities]),
      })
      : Object.freeze({ ...expected, resolution: "unavailable" });
    const verifiedKey =
      `${catalogEventId}:${expected.coordinate}:${expected.acceptedManifestEventId}`;
    if (verified) this.#verified.set(verifiedKey, verified);
    else this.#verified.delete(verifiedKey);
    const settled = entries.every((entry) => entry.resolution !== "pending");
    this.#projection = Object.freeze({
      catalogEventId,
      entries: Object.freeze(entries),
      status: settled ? "ready" : "refreshing",
    });
    this.#notify();
  }

  async previewInstall(
    input: string,
  ): Promise<CatalogAuthorityResult<InstallPreview>> {
    if (input.length === 0 || input.length > 5000) {
      return { ok: false, error: "invalid naddr", retryable: false };
    }
    try {
      const decoded = nip19.decodeNostrURI(input);
      if (
        decoded.type !== "naddr" || decoded.data.kind !== 35129 ||
        !HEX_64.test(decoded.data.pubkey) || !decoded.data.identifier ||
        decoded.data.identifier.includes(":")
      ) {
        return {
          ok: false,
          error: "invalid named manifest naddr",
          retryable: false,
        };
      }
      const coordinate =
        `35129:${decoded.data.pubkey}:${decoded.data.identifier}`;
      const relays = this.options.relayPolicy?.previewReads(
        decoded.data.relays ?? [],
        this.options.configuredReadRelays?.() ?? [],
        8,
      ) ?? [];
      if (!this.options.resolvePreviewArtifact) {
        return { ok: false, error: "preview unavailable", retryable: true };
      }
      const verified = await this.options.resolvePreviewArtifact(
        coordinate,
        relays,
      );
      return {
        ok: true,
        value: Object.freeze({
          publisher: decoded.data.pubkey,
          coordinate,
          manifestEventId: verified.manifestEventId,
          title: verified.title,
          version: verified.version,
          aggregateHash: verified.launch.aggregateHash,
          capabilities: Object.freeze([...verified.capabilities]),
          sourceCatalogEventId: this.#currentCatalogEvent()?.id ?? null,
        }),
      };
    } catch {
      return { ok: false, error: "preview failed", retryable: true };
    }
  }

  approveManifestUpdate(
    id: string,
    coordinate: string,
    manifestEventId: string,
    sourceCatalogEventId?: string | null,
  ): Promise<CatalogMutationResult> {
    return this.#serialize(() =>
      this.#mutate(id, async (entries) => {
        if (
          sourceCatalogEventId !== undefined &&
          (this.#currentCatalogEvent()?.id ?? null) !== sourceCatalogEventId
        ) throw new Error("catalog changed");
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

  async launch(
    catalogEventId: string,
    coordinate: string,
    manifestEventId: string,
  ): Promise<CatalogAuthorityResult<VerifiedCatalogArtifact>> {
    const event = this.#currentCatalogEvent();
    const identity = this.options.identity();
    const pubkey = identity.pubkey;
    if (!event || !pubkey || event.id !== catalogEventId) {
      return { ok: false, error: "catalog changed", retryable: true };
    }
    const catalog = decodeCatalogEvent(event, pubkey);
    const accepted = catalog?.entries.find((entry) =>
      entry.coordinate === coordinate
    );
    if (!accepted || accepted.acceptedManifestEventId !== manifestEventId) {
      return { ok: false, error: "napplet is not accepted", retryable: true };
    }
    try {
      const verified = await this.options.resolveVerifiedArtifact(
        coordinate,
        manifestEventId,
      );
      const currentIdentity = this.options.identity();
      const currentEvent = this.#currentCatalogEvent();
      if (
        currentIdentity.accountId !== identity.accountId ||
        currentIdentity.pubkey !== identity.pubkey ||
        currentIdentity.status !== identity.status ||
        currentEvent?.id !== catalogEventId
      ) {
        return { ok: false, error: "catalog changed", retryable: true };
      }
      const currentCatalog = decodeCatalogEvent(currentEvent, pubkey);
      const currentAccepted = currentCatalog?.entries.find((entry) =>
        entry.coordinate === coordinate
      );
      if (currentAccepted?.acceptedManifestEventId !== manifestEventId) {
        return { ok: false, error: "catalog changed", retryable: true };
      }
      if (verified.manifestEventId !== manifestEventId) {
        throw new Error("manifest mismatch");
      }
      return { ok: true, value: verified };
    } catch {
      return {
        ok: false,
        error: "accepted artifact unavailable",
        retryable: true,
      };
    }
  }

  #currentCatalogEvent(): NostrEvent | undefined {
    const pubkey = this.options.identity().pubkey;
    return pubkey
      ? this.options.eventStore.getReplaceable(
        CATALOG_KIND,
        pubkey,
        CATALOG_IDENTIFIER,
      )
      : undefined;
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
      this.#assertMutationAuthority(identity, currentEvent?.id ?? null);
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
      this.#assertMutationAuthority(identity, currentEvent?.id ?? null);
      if (
        event.pubkey !== identity.pubkey ||
        !decodeCatalogEvent(event, identity.pubkey)
      ) return { id, ok: false, error: "event signing failed", outcomes: [] };
      const outcomes = await this.options.publish(event);
      this.#assertMutationAuthority(identity, currentEvent?.id ?? null);
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
      this.#refresh();
      return { id, ok: true, event, outcomes };
    } catch {
      return { id, ok: false, error: "catalog mutation failed", outcomes: [] };
    }
  }

  #assertMutationAuthority(
    expected: IdentitySnapshot,
    expectedCatalogEventId: string | null,
  ): void {
    const current = this.options.identity();
    if (
      current.status !== "active" || current.accountId !== expected.accountId ||
      current.pubkey !== expected.pubkey ||
      (this.#currentCatalogEvent()?.id ?? null) !== expectedCatalogEventId
    ) throw new Error("catalog authority changed");
  }

  #notify(): void {
    for (const listener of this.#listeners) listener();
  }
}
