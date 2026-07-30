import fixture from "./fixtures/supplied_napplet_contract.json" with {
  type: "json",
};
import type {
  RelayEoseMessage,
  RelayEventMessage,
  RelaySubscribeMessage,
} from "@napplet/nap/relay";
import { finalizeEvent } from "nostr-tools";
import { getSeenRelays } from "applesauce-core/helpers";
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
  const loadedEvent = finalizeEvent(
    { kind: 1, created_at: 1, content: "loader tracer", tags: [] },
    crypto.getRandomValues(new Uint8Array(32)),
  );
  const eventRuntime = createEventRuntime({
    request: (relays) => {
      requestedRelays = [...relays];
      return of(loadedEvent);
    },
  });
  const runtime = createPortalRuntime({ fixture, settings, eventRuntime });

  try {
    await settings.save({
      relays: ["wss://tracer.example"],
      remoteSignerRelays: [],
      blossomServers: ["https://blossom.example"],
    });
    const loaded = await runtime.loadEvent(loadedEvent.id);

    assert(loaded?.id === loadedEvent.id, "loader should find event");
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

  assert(
    eventRuntime.destroyed,
    "event runtime should tear down deterministically",
  );
  assert(settings.destroyed, "settings stream should be released");
});

Deno.test("shared EventStore owns empty, duplicate, provenance, replacement, and delete semantics", () => {
  const eventRuntime = createEventRuntime();
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const original = finalizeEvent(
    { kind: 0, created_at: 1, content: "old", tags: [] },
    secret,
  );
  const replacement = finalizeEvent(
    { kind: 0, created_at: 2, content: "new", tags: [] },
    secret,
  );
  const deletion = finalizeEvent(
    { kind: 5, created_at: 3, content: "", tags: [["e", replacement.id]] },
    secret,
  );

  try {
    assert(
      eventRuntime.eventStore.getEvent(original.id) === undefined,
      "empty store should return no event",
    );
    const stored = eventRuntime.eventStore.add(original, "wss://one.example/");
    const duplicate = eventRuntime.eventStore.add(
      { ...original },
      "wss://two.example/",
    );
    assert(
      stored === duplicate,
      "duplicates should resolve to one event instance",
    );
    assert(
      getSeenRelays(stored!)?.size === 2,
      "duplicate observations should retain relay provenance",
    );
    eventRuntime.eventStore.add(replacement);
    assert(
      eventRuntime.eventStore.getReplaceable(0, replacement.pubkey) ===
        replacement,
      "newest replaceable event should win",
    );
    eventRuntime.eventStore.add(deletion);
    assert(
      eventRuntime.eventStore.getEvent(replacement.id) === undefined,
      "authorized deletion should remove its target",
    );
  } finally {
    eventRuntime.destroy();
  }
});
