import fixture from "./fixtures/supplied_napplet_contract.json" with {
  type: "json",
};
import {
  CatalogService,
  decodeArchetypeDeclarations,
} from "../runtime/catalog.ts";
import { createEventRuntime } from "../runtime/event_runtime.ts";
import { createPortalRuntime } from "../runtime/portal_runtime.ts";
import { RelayPolicy } from "../runtime/relay_policy.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("production intent tracer uses one process-owned exact service", async () => {
  const main = await Deno.readTextFile("main.ts");
  const endpoint = await Deno.readTextFile("routes/api/runtime.ts");
  assert(
    main.includes(
      "export const intentService = processRuntime.configureCatalog",
    ),
    "production must retain one process-owned intent service",
  );
  assert(
    endpoint.includes("bridge.reserveIntent"),
    "reserve must reach runtime",
  );
  assert(
    endpoint.includes("bridge.claimIntentTicket"),
    "claim must reach runtime",
  );
  assert(
    endpoint.includes("runtime.intent.ticket"),
    "claim must be correlated",
  );
});

Deno.test("signed archetype declarations reach verified intent authority", async () => {
  const eventRuntime = createEventRuntime();
  const runtime = createPortalRuntime({ fixture, eventRuntime });
  const pubkey = fixture.manifestEvent.pubkey;
  const catalog = new CatalogService({
    eventStore: eventRuntime.eventStore,
    identity: () => ({ status: "active", accountId: pubkey, pubkey }),
    resolveVerifiedArtifact: (coordinate, manifestEventId) =>
      runtime.resolveCatalogArtifact(coordinate, manifestEventId),
    relayPolicy: new RelayPolicy({ defaults: [], blocked: [] }),
    configuredReadRelays: () => [],
    signEvent: () => Promise.reject(new Error("unused")),
    publish: () => Promise.resolve([]),
  });
  const intents = runtime.configureCatalog(catalog);
  const artifact = await runtime.resolveCatalogArtifact(
    fixture.coordinate,
    fixture.manifestEvent.id,
  );
  assert(
    Object.isFrozen(artifact.declarations),
    "declarations must stay frozen",
  );
  const signedTagDeclarations = decodeArchetypeDeclarations([
    ["archetype", "note", "napplet:note/open"],
  ]);
  assert(
    signedTagDeclarations.length === 1 &&
      Object.isFrozen(signedTagDeclarations),
    "signed-tag declarations must retain exact frozen identity",
  );
  intents.destroy();
  runtime.destroy();
});

Deno.test("reservation opener is severed before transport and CSP stays external", async () => {
  const route = await Deno.readTextFile("routes/intent/reserved.tsx");
  const island = await Deno.readTextFile("islands/IntentReservation.tsx");
  const frame = await Deno.readTextFile("components/NappletFrame.tsx");
  assert(
    island.indexOf("globalThis.opener = null") <
      island.indexOf("new WebSocket"),
    "opener must be severed before transport",
  );
  assert(
    route.includes("<IntentReservation />"),
    "bootstrap uses generated island",
  );
  assert(
    !route.includes("dangerouslySetInnerHTML"),
    "no inline script relaxation",
  );
  assert(frame.includes('sandbox="allow-scripts"'), "sandbox remains exact");
  assert(!island.includes("payload"), "URL bootstrap cannot contain payload");
});

Deno.test("reservation CSP rejects malformed and replay-prone bootstrap state", async () => {
  const island = await Deno.readTextFile("islands/IntentReservation.tsx");
  assert(island.includes("history.replaceState"), "fragment must be erased");
  assert(island.includes("Number.isSafeInteger"), "generation must be bounded");
  assert(
    island.includes("socket.close()"),
    "failed claims must close transport",
  );
});
