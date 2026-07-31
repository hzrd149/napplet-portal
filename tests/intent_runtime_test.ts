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
import {
  decodeIntentCommand,
  decodeIntentNavigationMessage,
} from "../runtime/transport.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const key = generateSecretKey();
const pubkey = getPublicKey(key);
const coordinate = `35129:${"1".repeat(64)}:handler`;
const manifestEventId = "a".repeat(64);

function catalogEvent() {
  return finalizeEvent({
    kind: 30078,
    created_at: 1,
    tags: [["d", CATALOG_IDENTIFIER]],
    content: JSON.stringify({
      version: 1,
      entries: [{ coordinate, acceptedManifestEventId: manifestEventId }],
    }),
  }, key);
}

function artifact(): VerifiedCatalogArtifact {
  return {
    manifestEventId,
    title: "Handler",
    version: "1",
    capabilities: [],
    declarations: decodeArchetypeDeclarations([
      ["archetype", "note", "napplet:note/open"],
    ]),
    launch: {
      dTag: "handler",
      aggregateHash: "b".repeat(64),
      srcdoc: "verified",
    },
  };
}

async function readyHarness() {
  const store = new EventStore();
  let identity: IdentitySnapshot = {
    accountId: pubkey,
    pubkey,
    status: "active",
  };
  const catalog = new CatalogService({
    eventStore: store,
    identity: () => identity,
    resolveVerifiedArtifact: () => Promise.resolve(artifact()),
    signEvent: () => Promise.reject(new Error("unused")),
    publish: () => Promise.resolve([]),
  });
  catalog.load([catalogEvent()]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const sent: Record<string, unknown>[] = [];
  let sequence = 0;
  const intents = new IntentService(catalog, {
    account: () => identity.pubkey,
    sendNavigation: (message) => sent.push(message),
    createId: () => `opaque-${++sequence}`,
  });
  return {
    catalog,
    intents,
    sent,
    signOut() {
      identity = { accountId: null, pubkey: null, status: "unavailable" };
      catalog.resetAccount();
    },
  };
}

Deno.test("authenticated invocation verifies, tickets, acknowledges, and settles once", async () => {
  const h = await readyHarness();
  const results: Record<string, unknown>[] = [];
  const owner = { connectionId: "connection-1", windowId: "caller-1" };
  await h.intents.reserve(owner, {
    type: "intent.navigation.reserve",
    reservationId: "reservation-1",
    invocationId: "invoke-1",
    callerWindowId: "caller-1",
    mode: "reuse",
  }, {
    type: "intent.invoke",
    id: "correlation-1",
    request: {
      archetype: "note",
      convention: "napplet:note/open",
      payload: { id: 42 },
    },
  }, (message) => results.push(message));

  const authorized = h.sent[0];
  assert(
    authorized?.type === "intent.navigation.authorized",
    "exact launch verification must precede authorization",
  );
  assert(!("payload" in authorized), "navigation command must not leak payload");
  const claimed = h.intents.claim(owner, {
    type: "intent.ticket.claim",
    reservationId: "reservation-1",
    ticket: String(authorized.ticket),
    targetWindowId: String(authorized.targetWindowId),
    generation: Number(authorized.generation),
  });
  assert(claimed?.payload && (claimed.payload as { id: number }).id === 42,
    "ready target must receive payload through its ticket");
  assert(h.intents.claim(owner, {
    type: "intent.ticket.claim",
    reservationId: "reservation-1",
    ticket: String(authorized.ticket),
    targetWindowId: String(authorized.targetWindowId),
    generation: Number(authorized.generation),
  }) === null, "ticket must be single-use");

  h.intents.acknowledge(owner, {
    type: "intent.navigation.ack",
    reservationId: "reservation-1",
    invocationId: "invoke-1",
    state: "committed",
  });
  h.intents.acknowledge(owner, {
    type: "intent.navigation.ack",
    reservationId: "reservation-1",
    invocationId: "invoke-1",
    state: "committed",
  });
  assert(results.length === 1, "terminal acknowledgement must settle once");
  assert(results[0].type === "intent.invoke.result", "result type must be pinned");
  assert(results[0].id === "correlation-1", "correlation must survive");
  assert((results[0].result as { handled: boolean }).handled,
    "committed navigation must report handled");
});

Deno.test("authenticated invocation codecs reject extra keys and foreign ownership", async () => {
  assert(decodeIntentCommand({
    type: "intent.handlers",
    id: "query-1",
  })?.type === "intent.handlers", "pinned query must decode");
  assert(decodeIntentCommand({
    type: "intent.handlers",
    id: "query-1",
    extra: true,
  }) === null, "extra top-level keys must fail");
  assert(decodeIntentNavigationMessage({
    type: "intent.navigation.ack",
    reservationId: "reservation-1",
    invocationId: "invoke-1",
    state: "committed",
  })?.type === "intent.navigation.ack", "pinned ack must decode");

  const h = await readyHarness();
  const results: Record<string, unknown>[] = [];
  await h.intents.reserve(
    { connectionId: "foreign", windowId: "foreign" },
    {
      type: "intent.navigation.reserve",
      reservationId: "reservation-2",
      invocationId: "invoke-2",
      callerWindowId: "caller-1",
      mode: "reuse",
    },
    {
      type: "intent.invoke",
      id: "correlation-2",
      request: { archetype: "note" },
    },
    (message) => results.push(message),
  );
  assert(h.sent.length === 0, "foreign caller/source cannot authorize navigation");
  assert(results.length === 1, "foreign request must settle canonically");
});
