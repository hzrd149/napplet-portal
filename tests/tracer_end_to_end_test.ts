import fixture from "./fixtures/supplied_napplet_contract.json" with {
  type: "json",
};
import type {
  RelayEoseMessage,
  RelayEventMessage,
  RelaySubscribeMessage,
} from "@napplet/nap/relay";
import { of } from "npm:rxjs@7.8.2";
import { loadRuntimeConfig } from "../runtime/config.ts";
import { createEventRuntime } from "../runtime/event_runtime.ts";
import { createPortalRuntime } from "../runtime/portal_runtime.ts";
import { RuntimeSettingsService } from "../runtime/settings.ts";
import { SettingsStore } from "../runtime/settings_store.ts";

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

Deno.test("persisted settings reach a process-wide loader without restart", async () => {
  const directory = await Deno.makeTempDir();
  const settings = await RuntimeSettingsService.create(
    new SettingsStore(`${directory}/settings.json`),
    loadRuntimeConfig({}, () => undefined),
  );
  let requestedRelays: readonly string[] = [];
  const eventRuntime = createEventRuntime({
    request: (relays) => {
      requestedRelays = [...relays];
      return of(fixture.events.initial);
    },
  });
  const runtime = createPortalRuntime({ fixture, settings, eventRuntime });

  try {
    await settings.save({
      relays: ["wss://tracer.example"],
      remoteSignerRelays: [],
      blossomServers: ["https://blossom.example"],
    });
    const loaded = await runtime.loadEvent(fixture.events.initial.id);

    assert(loaded?.id === fixture.events.initial.id, "loader should find event");
    assert(
      requestedRelays[0] === "wss://tracer.example/",
      "next loader operation should use saved settings",
    );
    assert(
      eventRuntime.eventStore.getEvent(loaded.id) === loaded,
      "shared EventStore should own the loaded event",
    );
  } finally {
    runtime.destroy();
    runtime.destroy();
    await Deno.remove(directory, { recursive: true });
  }

  assert(eventRuntime.destroyed, "event runtime should tear down deterministically");
  assert(settings.destroyed, "settings stream should be released");
});
