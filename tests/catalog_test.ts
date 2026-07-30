import { EventStore } from "applesauce-core";
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools";
import {
  CATALOG_IDENTIFIER,
  CatalogService,
  decodeCatalogEvent,
  type VerifiedCatalogArtifact,
} from "../runtime/catalog.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const key = generateSecretKey();
const pubkey = getPublicKey(key);
const otherKey = generateSecretKey();
const coordinate = `35129:${getPublicKey(otherKey)}:security-lab`;
const acceptedId = "a".repeat(64);
const pendingId = "b".repeat(64);

function catalogEvent(
  entries: readonly Record<string, unknown>[],
  createdAt = 1,
  overrides: Partial<{ kind: number; pubkey: string; d: string }> = {},
) {
  const signed = finalizeEvent({
    kind: overrides.kind ?? 30078,
    created_at: createdAt,
    tags: [["d", overrides.d ?? CATALOG_IDENTIFIER]],
    content: JSON.stringify({ version: 1, entries }),
  }, key);
  return overrides.pubkey ? { ...signed, pubkey: overrides.pubkey } : signed;
}

function artifact(eventId: string): VerifiedCatalogArtifact {
  return {
    manifestEventId: eventId,
    title: eventId === pendingId ? "Security Lab Next" : "Security Lab",
    version: eventId === pendingId ? "2" : "1",
    capabilities: eventId === pendingId ? ["identity", "relay"] : ["identity"],
    launch: {
      dTag: "security-lab",
      aggregateHash: "c".repeat(64),
      srcdoc: "<main>verified</main>",
    },
  };
}

Deno.test("catalog codec rejects malformed, foreign, unsigned, and secret-bearing public content", () => {
  const store = new EventStore();
  const valid = catalogEvent([{
    coordinate,
    acceptedManifestEventId: acceptedId,
  }]);
  assert(store.add(valid), "valid signature must enter EventStore");
  assert(
    decodeCatalogEvent(valid, pubkey)?.entries.length === 1,
    "valid catalog decodes",
  );
  assert(
    !decodeCatalogEvent(catalogEvent([], 2, { kind: 1 }), pubkey),
    "kind must match",
  );
  assert(
    !decodeCatalogEvent(catalogEvent([], 2), "f".repeat(64)),
    "author must be active",
  );
  assert(
    !decodeCatalogEvent(catalogEvent([], 2, { d: "wrong" }), pubkey),
    "d tag must be exact",
  );
  assert(
    !decodeCatalogEvent(
      { ...structuredClone(valid), sig: "0".repeat(128) },
      pubkey,
    ),
    "signature must verify",
  );
  assert(
    !decodeCatalogEvent(
      catalogEvent([{
        coordinate,
        acceptedManifestEventId: acceptedId,
        secret: "nsec",
      }], 3),
      pubkey,
    ),
    "unknown fields must fail closed",
  );
  assert(
    !decodeCatalogEvent(
      catalogEvent(
        [{ coordinate: "bad", acceptedManifestEventId: acceptedId }],
        3,
      ),
      pubkey,
    ),
    "coordinate must be NIP-5A",
  );
});

Deno.test("latest valid replacement is isolated to active account and projects verified accepted identity", async () => {
  const store = new EventStore();
  const older = catalogEvent([{
    coordinate,
    acceptedManifestEventId: acceptedId,
  }], 1);
  const newer = catalogEvent([{
    coordinate,
    acceptedManifestEventId: pendingId,
  }], 2);
  const malformed = catalogEvent([{
    coordinate: "bad",
    acceptedManifestEventId: pendingId,
  }], 3);
  const service = new CatalogService({
    eventStore: store,
    identity: () => ({ accountId: "a", pubkey, status: "active" }),
    resolveVerifiedArtifact: (_coordinate, eventId) =>
      Promise.resolve(artifact(eventId)),
    signEvent: () => Promise.reject(new Error("unused")),
    publish: () => Promise.resolve([]),
  });
  assert(service.load([]) === 0, "empty relay result is valid");
  assert(
    service.load([older, newer, malformed]) === 2,
    "many results retain only valid replacements",
  );
  const projected = await service.project();
  assert(
    projected.catalogEventId === newer.id,
    "latest valid replacement wins",
  );
  assert(
    projected.entries[0].title === "Security Lab Next",
    "identity comes from verified manifest",
  );
  assert(
    !("iframeMetadata" in projected.entries[0]),
    "iframe metadata is never identity input",
  );
  const foreign = new CatalogService({
    ...service.options,
    identity: () => ({
      accountId: "b",
      pubkey: getPublicKey(otherKey),
      status: "active",
    }),
  });
  assert(
    (await foreign.project()).entries.length === 0,
    "active accounts are isolated",
  );
});

Deno.test("approval serializes current projection, pins launch until settlement, and reports partial publish", async () => {
  const store = new EventStore();
  const original = catalogEvent([{
    coordinate,
    acceptedManifestEventId: acceptedId,
  }], 1);
  store.add(original);
  const signedTemplates: Record<string, unknown>[] = [];
  let release!: () => void;
  const publishGate = new Promise<void>((resolve) => release = resolve);
  const service = new CatalogService({
    eventStore: store,
    identity: () => ({ accountId: "a", pubkey, status: "active" }),
    resolveVerifiedArtifact: (_coordinate, eventId) =>
      Promise.resolve(artifact(eventId)),
    signEvent: (template) => {
      signedTemplates.push(template as unknown as Record<string, unknown>);
      return Promise.resolve(
        finalizeEvent({ ...template, created_at: 5 }, key),
      );
    },
    publish: async (_event) => {
      await publishGate;
      return [{ relay: "wss://one", accepted: true }, {
        relay: "wss://two",
        accepted: false,
      }];
    },
  });
  const pending = service.approveManifestUpdate(
    "approve-1",
    coordinate,
    pendingId,
  );
  assert(
    (await service.project()).entries[0].acceptedManifestEventId === acceptedId,
    "launch stays pinned while approval is pending",
  );
  release();
  const result = await pending;
  assert(
    !result.ok && result.outcomes.length === 2,
    "partial publish is a typed failure",
  );
  assert(
    store.getReplaceable(30078, pubkey, CATALOG_IDENTIFIER)?.id === original.id,
    "failed publish does not advance accepted catalog",
  );
  const content = JSON.parse(String(signedTemplates[0].content));
  assert(
    content.entries[0].acceptedManifestEventId === pendingId,
    "backend signs requested verified manifest ID",
  );
});

Deno.test("concurrent updates re-read latest projection; absent signer and uninstall are safe", async () => {
  const store = new EventStore();
  store.add(
    catalogEvent([{ coordinate, acceptedManifestEventId: acceptedId }], 1),
  );
  let createdAt = 10;
  const signed: string[] = [];
  const service = new CatalogService({
    eventStore: store,
    identity: () => ({ accountId: "a", pubkey, status: "active" }),
    resolveVerifiedArtifact: (_coordinate, eventId) =>
      Promise.resolve(artifact(eventId)),
    signEvent: (template) => {
      signed.push(template.content);
      return Promise.resolve(
        finalizeEvent({ ...template, created_at: createdAt++ }, key),
      );
    },
    publish: () => Promise.resolve([{ relay: "wss://one", accepted: true }]),
  });
  const [approved, removed] = await Promise.all([
    service.approveManifestUpdate("approve", coordinate, pendingId),
    service.uninstallNapplet("remove", coordinate),
  ]);
  assert(approved.ok && removed.ok, "serialized mutations settle");
  assert(
    JSON.parse(signed[1]).entries.length === 0,
    "second mutation re-reads the first replacement",
  );
  assert(
    (await service.project()).entries.length === 0,
    "uninstall publishes replacement only",
  );

  const offline = new CatalogService({
    ...service.options,
    identity: () => ({ accountId: null, pubkey: null, status: "unavailable" }),
  });
  const rejected = await offline.uninstallNapplet("offline", coordinate);
  assert(
    !rejected.ok && rejected.error === "signer unavailable",
    "absent signer is typed failure",
  );
});

Deno.test("catalog listeners observe synchronized loads and accepted mutations", async () => {
  const eventStore = new EventStore();
  const original = catalogEvent([{
    coordinate,
    acceptedManifestEventId: acceptedId,
  }], 1);
  const notifications: number[] = [];
  const service = new CatalogService({
    eventStore,
    identity: () => ({ accountId: pubkey, pubkey, status: "active" }),
    resolveVerifiedArtifact: (_coordinate, eventId) =>
      Promise.resolve(artifact(eventId)),
    signEvent: (template) =>
      Promise.resolve(catalogEvent(
        JSON.parse(template.content).entries,
        template.created_at,
      )),
    publish: () =>
      Promise.resolve([{ relay: "wss://relay.example", accepted: true }]),
  });
  const unsubscribe = service.subscribe(() => notifications.push(1));
  service.load([original]);
  await service.uninstallNapplet("remove-listener", coordinate);
  unsubscribe();
  assert(
    notifications.length === 2,
    "load and accepted replacement must each notify projection listeners",
  );
});
