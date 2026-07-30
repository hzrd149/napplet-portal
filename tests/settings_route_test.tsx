import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.16";
import { renderToString } from "npm:preact-render-to-string@^6.6.3";
import {
  parseSettingsForm,
  RuntimeSettingsPage,
} from "../routes/settings.tsx";

const snapshot = {
  relays: ["wss://relay.example/"],
  remoteSignerRelays: [],
  blossomServers: ["https://blossom.example/"],
  indexerRelays: ["wss://index.example/"],
  lookupRelays: [],
  localRelay: "",
  authRelays: ["wss://relay.example/"],
  blockedRelays: ["wss://blocked.example/"],
};

Deno.test("runtime settings renders the immediate canonical snapshot and independent health", () => {
  const html = renderToString(
    <RuntimeSettingsPage
      values={snapshot}
      health={{ relay: "checking", blossom: "degraded" }}
    />,
  );
  for (const copy of [
    "Runtime settings",
    "Relay routing",
    "Fallback and extra relays",
    "Default indexer relays",
    "Default lookup relays",
    "Local relay cache",
    "Relay authentication",
    "Allow NIP-42 AUTH",
    "Blossom servers",
    "Checking local relay cache…",
    "Local Blossom cache unavailable — using upstream servers.",
  ]) assertStringIncludes(html, copy);
  assertStringIncludes(html, "wss://relay.example/");
});

Deno.test("settings form canonicalizes valid values atomically", () => {
  const body = new URLSearchParams({
    relays: " wss://RELAY.example\nwss://relay.example/ ",
    indexerRelays: "wss://index.example",
    lookupRelays: "",
    localRelay: "ws://127.0.0.1:7777",
    blossomServers: "https://blossom.example",
  });
  body.append("authRelays", "wss://relay.example");
  const result = parseSettingsForm(body, []);
  assert(result.ok);
  assertEquals(result.values.relays, ["wss://relay.example/"]);
  assertEquals(result.values.localRelay, "ws://127.0.0.1:7777/");
  assertEquals(result.values.authRelays, ["wss://relay.example/"]);
});

Deno.test("invalid settings retain every submitted value with field errors", () => {
  const body = new URLSearchParams({
    relays: "not-a-url",
    indexerRelays: "wss://valid.example",
    lookupRelays: "",
    localRelay: "",
    blossomServers: "ftp://wrong.example",
  });
  const result = parseSettingsForm(body, []);
  assert(!result.ok);
  assertEquals(result.raw.relays, "not-a-url");
  assertEquals(result.raw.indexerRelays, "wss://valid.example");
  assert(result.errors.relays);
  assert(result.errors.blossomServers);
});

Deno.test("blocked AUTH rows override selection and empty state is explicit", () => {
  const html = renderToString(
    <RuntimeSettingsPage
      values={{ ...snapshot, relays: [], authRelays: [] }}
      health={{ relay: "healthy", blossom: "healthy" }}
    />,
  );
  assertStringIncludes(html, "Blocked — connection and AUTH disabled");
  assertStringIncludes(html, "No relays available for AUTH.");
  assert(!html.includes('value="wss://blocked.example/" checked'));
});

Deno.test("settings uses exact success and validation summaries", () => {
  const success = renderToString(
    <RuntimeSettingsPage values={snapshot} success />,
  );
  assertStringIncludes(
    success,
    "Settings saved. New operations will use these values.",
  );
  const failure = renderToString(
    <RuntimeSettingsPage
      values={snapshot}
      errors={{ relays: "Enter valid WebSocket relay URLs." }}
    />,
  );
  assertStringIncludes(
    failure,
    "Some settings could not be saved. Review the highlighted fields and try again.",
  );
});
