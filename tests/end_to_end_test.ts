import fixture from "./fixtures/supplied_napplet_contract.json" with {
  type: "json",
};
import type {
  RelayClosedMessage,
  RelayEventMessage,
  RelaySubscribeMessage,
} from "@napplet/nap/relay";
import { createPortalRuntime } from "../runtime/portal_runtime.ts";
import { loadRuntimeConfig } from "../runtime/config.ts";
import { app, processRuntime, startupSummary } from "../main.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("Fresh composition is singleton, loopback-safe, and starter-free", async () => {
  const main = await Deno.readTextFile("main.ts");
  const utils = await Deno.readTextFile("utils.ts");
  assert(
    (main.match(/new App/g) ?? []).length === 1,
    "Fresh app must be singleton",
  );
  assert(app && processRuntime, "Fresh must expose one process runtime");
  assert(
    !main.includes("api2") && !main.includes("exampleLogger"),
    "starter routes must be gone",
  );
  try {
    await Deno.stat("routes/api/[name].tsx");
    throw new Error("starter greeting route must be removed");
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  assert(
    !utils.includes("shared: string"),
    "starter request state must be gone",
  );
  const config = loadRuntimeConfig({ NAPPLET_COORDINATE: fixture.coordinate });
  assert(config.bind === "127.0.0.1", "startup must default to loopback");
  const summary = startupSummary(config, "unavailable");
  assert(
    summary.includes(fixture.coordinate),
    "summary may include coordinate",
  );
  assert(
    !summary.includes("nsec") && !summary.includes("bunker://"),
    "summary must exclude secrets",
  );
});

Deno.test("supplied Security Lab traverses verified mount, handshake, identity, and continuing stream", async () => {
  const runtime = createPortalRuntime({ fixture });
  const trace: string[] = [];
  runtime.events.subscribe((event) => trace.push(event.type));
  const account = runtime.signIn(fixture.identity.pubkey);
  assert(account.status === "active", "identity must activate before launch");
  const artifact = await runtime.resolveArtifact();
  assert(
    artifact.dTag === fixture.identity.identifier,
    "verified dTag must bind session",
  );
  assert(
    artifact.aggregateHash === fixture.identity.aggregateHash,
    "verified aggregate must bind session",
  );

  const source = {};
  const window = runtime.openWindow("connection", "window", source);
  window.receive({}, { type: "shell.ready" });
  window.receive(source, { type: "shell.ready" });
  window.receive(source, { type: "shell.ready" });
  assert(
    trace.filter((type) => type === "shell.init").length === 1,
    "source-bound init must be exact once",
  );

  const messages: Array<RelayEventMessage | RelayClosedMessage> = [];
  const subscription = window.subscribeRelay(
    fixture.envelopes.relaySubscribe as RelaySubscribeMessage,
    (message) => {
      if (message.type === "relay.event" || message.type === "relay.closed") {
        messages.push(message);
      }
    },
  );
  runtime.relay.emitLive(fixture.events.live);
  subscription.close();
  runtime.relay.emitLive({ ...fixture.events.live, id: "3".repeat(64) });
  assert(
    messages[0]?.type === "relay.event" &&
      messages[0].result.event.id === fixture.events.initial.id,
    "stored value must arrive",
  );
  assert(
    messages[1]?.type === "relay.event" &&
      messages[1].result.event.id === fixture.events.live.id,
    "live tail must continue",
  );
  assert(
    messages[2]?.type === "relay.closed",
    "close must emit terminal frame",
  );
  assert(
    messages.length === 3,
    "closed stream must reject later live delivery",
  );
  runtime.signOut();
  assert(
    runtime.activeAccount === null,
    "sign-out must remove signing authority",
  );
});
