import { EventStore } from "applesauce-core";
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools";
import {
  CATALOG_IDENTIFIER,
  CatalogService,
  decodeCatalogEvent,
  type VerifiedCatalogArtifact,
} from "../runtime/catalog.ts";
import { RelayPolicy } from "../runtime/relay_policy.ts";
import { nip19 } from "nostr-tools";

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
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
  await settle();
  const ready = await service.project();
  assert(
    projected.catalogEventId === newer.id,
    "latest valid replacement wins",
  );
  assert(
    ready.entries[0].title === "Security Lab Next",
    "identity comes from verified manifest",
  );
  assert(
    !("iframeMetadata" in ready.entries[0]) && !("launch" in ready.entries[0]),
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
    notifications.length >= 2,
    "raw and enriched projections must notify listeners",
  );
});

Deno.test("accepted truth emits pending immediately, retains failure, retries, and discards stale completion", async () => {
  const store = new EventStore();
  const first = deferred<VerifiedCatalogArtifact>();
  let activePubkey = pubkey;
  let attempts = 0;
  const service = new CatalogService({
    eventStore: store,
    identity: () => ({
      accountId: activePubkey,
      pubkey: activePubkey,
      status: "active",
    }),
    resolveVerifiedArtifact: (_coordinate, eventId) => {
      attempts++;
      return attempts === 1
        ? first.promise
        : Promise.resolve(artifact(eventId));
    },
    signEvent: () => Promise.reject(new Error("unused")),
    publish: () => Promise.resolve([]),
  });
  service.load([
    catalogEvent([{ coordinate, acceptedManifestEventId: acceptedId }]),
  ]);
  const pending = await service.project();
  assert(
    pending.entries.length === 1 && pending.entries[0].resolution === "pending",
    "accepted membership is immediate",
  );
  assert(
    !("launch" in pending.entries[0]),
    "ordinary projection never exposes bytes",
  );
  activePubkey = getPublicKey(otherKey);
  await service.project();
  first.resolve(artifact(acceptedId));
  await settle();
  assert(
    (await service.project()).entries.length === 0,
    "old account completion cannot reanimate truth",
  );

  activePubkey = pubkey;
  service.retry();
  await settle();
  const ready = await service.project();
  assert(
    ready.entries[0].resolution === "ready",
    "retry enriches the same accepted entry",
  );
});

Deno.test("enrichment queue caps at four and shares exact in-flight work", async () => {
  const store = new EventStore();
  const gates = Array.from(
    { length: 6 },
    () => deferred<VerifiedCatalogArtifact>(),
  );
  let running = 0;
  let maximum = 0;
  let calls = 0;
  const entries = gates.map((_, index) => ({
    coordinate: `35129:${getPublicKey(otherKey)}:app-${index}`,
    acceptedManifestEventId: index.toString(16).padStart(64, "0"),
  }));
  const service = new CatalogService({
    eventStore: store,
    identity: () => ({ accountId: pubkey, pubkey, status: "active" }),
    resolveVerifiedArtifact: (_coordinate, eventId) => {
      const index = Number.parseInt(eventId, 16);
      calls++;
      running++;
      maximum = Math.max(maximum, running);
      return gates[index].promise.finally(() => running--);
    },
    signEvent: () => Promise.reject(new Error("unused")),
    publish: () => Promise.resolve([]),
  });
  service.load([catalogEvent(entries)]);
  await service.project();
  await service.project();
  assert(
    calls === 4 && maximum === 4,
    "only four exact resolutions run and duplicate refresh shares them",
  );
  gates.forEach((gate, index) =>
    gate.resolve(artifact(entries[index].acceptedManifestEventId))
  );
  await settle();
  await settle();
  assert(
    (await service.project()).entries.every((entry) =>
      entry.resolution === "ready"
    ),
    "queued work completes without dropping entries",
  );
});

Deno.test("preview derives immutable facts, approval is generation-bound, and launch rechecks exact accepted triple", async () => {
  const store = new EventStore();
  const original = catalogEvent([{
    coordinate,
    acceptedManifestEventId: acceptedId,
  }]);
  store.add(original);
  const previewArtifact = artifact(pendingId);
  let previewRelays: readonly string[] = [];
  const service = new CatalogService({
    eventStore: store,
    identity: () => ({ accountId: pubkey, pubkey, status: "active" }),
    relayPolicy: new RelayPolicy({
      defaults: [],
      blocked: ["wss://blocked.example"],
    }),
    configuredReadRelays: () => ["wss://configured.example"],
    resolvePreviewArtifact: (_coordinate, relays) => {
      previewRelays = relays;
      return Promise.resolve(previewArtifact);
    },
    resolveVerifiedArtifact: (_coordinate, eventId) =>
      Promise.resolve(artifact(eventId)),
    signEvent: (template) => Promise.resolve(finalizeEvent(template, key)),
    publish: () => Promise.resolve([{ relay: "wss://one", accepted: true }]),
  });
  const naddr = nip19.naddrEncode({
    kind: 35129,
    pubkey: getPublicKey(otherKey),
    identifier: "security-lab",
    relays: [
      "https://bad.example",
      "wss://blocked.example",
      "wss://hint.example",
    ],
  });
  const preview = await service.previewInstall(`nostr:${naddr}`);
  assert(
    preview.ok && preview.value.sourceCatalogEventId === original.id,
    "review is bound to current catalog generation",
  );
  assert(
    preview.ok &&
      preview.value.aggregateHash === previewArtifact.launch.aggregateHash,
    "review facts come from verified artifact",
  );
  assert(
    previewRelays.join(",") === "wss://hint.example/,wss://configured.example/",
    "preview reads use policy-approved hints first",
  );
  assert(
    !(await service.previewInstall("x".repeat(5001))).ok,
    "oversized input fails closed",
  );
  assert(
    !(await service.previewInstall(
      nip19.naddrEncode({ kind: 1, pubkey, identifier: "wrong" }),
    )).ok,
    "wrong kind fails closed",
  );

  const staleApproval = await service.approveManifestUpdate(
    "stale",
    coordinate,
    pendingId,
    "f".repeat(64),
  );
  assert(
    !staleApproval.ok &&
      store.getReplaceable(30078, pubkey, CATALOG_IDENTIFIER)?.id ===
        original.id,
    "changed generation cannot sign or advance",
  );
  const staleLaunch = await service.launch(
    "f".repeat(64),
    coordinate,
    acceptedId,
  );
  const mismatchLaunch = await service.launch(
    original.id,
    coordinate,
    pendingId,
  );
  const launched = await service.launch(original.id, coordinate, acceptedId);
  assert(
    !staleLaunch.ok && staleLaunch.retryable && !mismatchLaunch.ok,
    "stale launch selectors are retryable failures",
  );
  assert(
    launched.ok && launched.value.launch.srcdoc.includes("verified"),
    "exact accepted artifact releases verified bytes",
  );
});
