import fixture from "./fixtures/supplied_napplet_contract.json" with {
  type: "json",
};
import type {
  RelayEoseMessage,
  RelayEventMessage,
  RelaySubscribeMessage,
} from "@napplet/nap/relay";
import { createPortalRuntime } from "../runtime/portal_runtime.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("verified Security Lab completes sign-in, handshake, and continuing relay stream", async () => {
  assert(
    fixture.identity.identifier === "security-lab",
    "fixture must be the supplied napplet",
  );
  assert(
    fixture.artifact.singleFile,
    "verified srcdoc artifact must be self-contained",
  );
  assert(
    fixture.iframe.sandbox === "allow-scripts",
    "iframe sandbox must remain opaque",
  );

  const runtime = createPortalRuntime({ fixture });
  const trace: string[] = [];
  runtime.events.subscribe((event) => trace.push(event.type));

  const account = runtime.signIn("f".repeat(64));
  assert(account.pubkey === "f".repeat(64), "public identity should activate");

  const artifact = await runtime.resolveArtifact();
  assert(
    artifact.aggregateHash === fixture.identity.aggregateHash,
    "aggregate must verify",
  );
  assert(
    artifact.indexHtml.includes("Security Lab"),
    "actual supplied HTML should load",
  );

  const source = {};
  const bridge = runtime.openWindow("connection-1", "window-1", source);
  bridge.receive(source, { type: "shell.ready" });
  bridge.receive(source, { type: "shell.ready" });
  bridge.receive({}, { type: "shell.ready" });

  const messages: Array<RelayEventMessage | RelayEoseMessage> = [];
  const subscription = bridge.subscribeRelay(
    fixture.envelopes.relaySubscribe as RelaySubscribeMessage,
    (message) => messages.push(message),
  );
  runtime.relay.emitLive(fixture.events.live);

  assert(
    messages[0]?.type === "relay.event",
    "stored event should arrive first",
  );
  assert(
    messages[1]?.type === "relay.eose",
    "EOSE should mark stored boundary",
  );
  assert(
    messages[2]?.type === "relay.event",
    "later live event should use same stream",
  );
  assert(
    !subscription.closed,
    "stream must remain open after EOSE and live delivery",
  );
  assert(
    trace.filter((type) => type === "shell.init").length === 1,
    "shell.init must be exactly once",
  );
});
