import { EventStore } from "applesauce-core";
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools";
import type { IdentitySnapshot } from "../runtime/accounts.ts";
import {
  CATALOG_IDENTIFIER,
  CatalogService,
  decodeArchetypeDeclarations,
  type VerifiedCatalogArtifact,
} from "../runtime/catalog.ts";
import { IntentService } from "../runtime/intent.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const accountKey = generateSecretKey();
const pubkey = getPublicKey(accountKey);

function catalog(
  entries: readonly { coordinate: string; id: string }[],
  createdAt: number,
) {
  return finalizeEvent({
    kind: 30078,
    created_at: createdAt,
    tags: [["d", CATALOG_IDENTIFIER]],
    content: JSON.stringify({
      version: 1,
      entries: entries.map((entry) => ({
        coordinate: entry.coordinate,
        acceptedManifestEventId: entry.id,
      })),
    }),
  }, accountKey);
}

function artifact(
  dTag: string,
  id: string,
  action = "open",
): VerifiedCatalogArtifact {
  return {
    manifestEventId: id,
    title: dTag.toUpperCase(),
    version: "1",
    capabilities: [],
    declarations: decodeArchetypeDeclarations([
      ["archetype", "note", `napplet:note/${action}`],
      ["archetype", "note", "napplet:note/open"],
    ]),
    launch: { dTag, aggregateHash: dTag.padEnd(64, "a"), srcdoc: "verified" },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => resolve = yes);
  return { promise, resolve };
}

function harness(
  resolver: (
    coordinate: string,
    id: string,
  ) => Promise<VerifiedCatalogArtifact>,
) {
  const store = new EventStore();
  let identity: IdentitySnapshot = {
    accountId: pubkey,
    pubkey,
    status: "active",
  };
  const catalogService = new CatalogService({
    eventStore: store,
    identity: () => identity,
    resolveVerifiedArtifact: resolver,
    signEvent: () => Promise.reject(new Error("unused")),
    publish: () => Promise.resolve([]),
  });
  const intents = new IntentService(catalogService);
  return {
    catalogService,
    intents,
    replaceIdentity(value: IdentitySnapshot) {
      identity = value;
      catalogService.resetAccount();
    },
  };
}

const coordinateA = `35129:${"1".repeat(64)}:z-handler`;
const coordinateB = `35129:${"2".repeat(64)}:a-handler`;
const idA = "a".repeat(64);
const idB = "b".repeat(64);

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

Deno.test("intent registry deterministically selects current verified candidates", async () => {
  const h = harness((coordinate, id) =>
    Promise.resolve(
      artifact(
        coordinate === coordinateA ? "z-handler" : "a-handler",
        id,
        "edit",
      ),
    )
  );
  h.catalogService.load([catalog([
    { coordinate: coordinateA, id: idA },
    { coordinate: coordinateB, id: idB },
  ], 1)]);
  await settle();
  const available = h.intents.available("note");
  assert(
    available.candidates.map((candidate) => candidate.dTag).join(",") ===
      "a-handler,z-handler",
    "dTag then accepted event ID determines candidate order",
  );
  assert(available.candidates[0].isDefault === true, "only first is default");
  assert(!available.candidates[1].isDefault, "non-default omits marker");
  const selected = h.intents.select({ archetype: "note", action: "edit" });
  assert(
    selected.ok && selected.candidate.dTag === "a-handler",
    "default resolves",
  );
  const explicit = h.intents.select({
    archetype: "note",
    action: "open",
    handler: "z-handler",
    convention: "napplet:note/open",
  });
  assert(
    explicit.ok && explicit.candidate.dTag === "z-handler",
    "installed explicit handler resolves",
  );
  const choose = h.intents.select({ archetype: "note", handler: "choose" });
  assert(
    !choose.ok && choose.result.error === "denied",
    "choose is policy denied",
  );
  const mismatch = h.intents.select({
    archetype: "note",
    action: "edit",
    convention: "napplet:note/open",
  });
  assert(
    !mismatch.ok && mismatch.result.error === "denied",
    "convention action mismatch is denied",
  );
});

Deno.test("intent registry revokes stale authority while retaining last-good display", async () => {
  const pending = deferred<VerifiedCatalogArtifact>();
  const h = harness((_coordinate, id) =>
    id === idA ? Promise.resolve(artifact("z-handler", id)) : pending.promise
  );
  h.catalogService.load([catalog([{ coordinate: coordinateA, id: idA }], 1)]);
  await settle();
  const token = h.intents.generation();
  assert(
    h.intents.select({ archetype: "note" }).ok,
    "initial generation has authority",
  );
  h.catalogService.load([catalog([{ coordinate: coordinateB, id: idB }], 2)]);
  assert(
    h.intents.available("note").available,
    "last-good display survives pending replacement",
  );
  assert(
    !h.intents.select({ archetype: "note" }).ok,
    "pending replacement has no stale authority",
  );
  assert(
    !h.intents.isCurrent(token),
    "replacement invalidates unresolved work",
  );
  pending.resolve(artifact("a-handler", idB));
  await settle();
  assert(
    h.intents.select({ archetype: "note" }).ok,
    "new verified generation gains authority",
  );
  h.replaceIdentity({ accountId: null, pubkey: null, status: "unavailable" });
  assert(
    !h.intents.select({ archetype: "note" }).ok,
    "sign-out revokes authority",
  );
});
