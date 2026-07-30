import fixture from "./fixtures/supplied_napplet_contract.json" with {
  type: "json",
};
import { Subject } from "npm:rxjs@7.8.2";
import {
  BackendRelayAdapter,
  type RawRelayItem,
} from "../runtime/relay_adapter.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("RELAY merges store first with exact-provenance live tail and one EOSE", () => {
  const live = new Subject<RawRelayItem>();
  const stored = [fixture.events.initial];
  const added: Array<{ id: string; from?: string }> = [];
  const adapter = new BackendRelayAdapter({
    store: {
      query: () => stored,
      add: (event, from) => added.push({ id: event.id, from }),
    },
    pool: { req: () => live },
  });
  const received: Array<Record<string, unknown>> = [];
  const subscription = adapter.subscribe(
    { connectionId: "one", windowId: "window" },
    {
      type: "relay.subscribe",
      id: "request",
      subId: "shared",
      relay: "wss://supplied.example",
      filters: [{ kinds: [1] }],
    },
    (message) => received.push(message as unknown as Record<string, unknown>),
  );

  live.next({
    type: "EVENT",
    event: fixture.events.initial,
    from: "wss://observed.example",
  });
  live.next({ type: "EOSE" });
  live.next({ type: "EOSE" });
  live.next({
    type: "EVENT",
    event: fixture.events.live,
    from: "wss://observed.example",
  });

  assert(
    received.length === 3,
    "dedupe plus one EOSE must yield three envelopes",
  );
  const cached = received[0].result as { sidecar?: unknown };
  assert(cached.sidecar === undefined, "cache provenance must be omitted");
  assert(
    received[1].type === "relay.eose",
    "EOSE must be nonterminal boundary",
  );
  const tail = received[2].result as { sidecar: { relayHints: string[] } };
  assert(
    tail.sidecar.relayHints[0] === "wss://observed.example",
    "raw from must be exact hint",
  );
  assert(
    added[0]?.from === "wss://observed.example",
    "store must retain observed provenance",
  );
  assert(!subscription.closed, "stream must remain live after EOSE");
});

Deno.test("same subId stays independently owned and close is immediate", () => {
  const live = new Subject<RawRelayItem>();
  const adapter = new BackendRelayAdapter({
    store: { query: () => [], add: () => {} },
    pool: { req: () => live },
  });
  const first: string[] = [];
  const second: string[] = [];
  const one = adapter.subscribe(
    { connectionId: "one", windowId: "window" },
    {
      type: "relay.subscribe",
      id: "a",
      subId: "same",
      relay: "wss://one",
      filters: [],
    },
    (message) => first.push(message.type),
  );
  adapter.subscribe(
    { connectionId: "two", windowId: "window" },
    {
      type: "relay.subscribe",
      id: "b",
      subId: "same",
      relay: "wss://two",
      filters: [],
    },
    (message) => second.push(message.type),
  );
  one.close();
  live.next({ type: "EVENT", event: fixture.events.live, from: "wss://live" });
  assert(first.at(-1) === "relay.closed", "close must emit canonical closed");
  assert(!first.includes("relay.event"), "closed owner must stop immediately");
  assert(second.includes("relay.event"), "other owner must remain live");
  assert(adapter.subscriptionCount === 1, "only closed ownership is removed");
});

Deno.test("RELAY forwards signed events unchanged and encrypts before backend signing", async () => {
  const published: unknown[] = [];
  const adapter = new BackendRelayAdapter({
    store: { query: () => [], add: () => {} },
    pool: {
      req: () => new Subject<RawRelayItem>(),
      publish: (_relay, event) => {
        published.push(event);
        return Promise.resolve(true);
      },
    },
  });
  const signed = fixture.events.live;
  const direct = await adapter.publishSigned("direct", signed, ["wss://relay"]);
  assert(
    direct.ok && published[0] === signed,
    "signed RELAY event must pass unchanged",
  );

  let signedContent = "";
  const encrypted = await adapter.publishEncrypted(
    "encrypted",
    { kind: 4, content: "plaintext", tags: [], created_at: 1 },
    "recipient",
    ["wss://relay"],
    {
      encrypt: (_recipient, plaintext) =>
        Promise.resolve(`cipher:${plaintext}`),
      signEvent: (template) => {
        signedContent = template.content;
        return Promise.resolve(signed);
      },
    },
  );
  assert(encrypted.ok, "encrypted publish must settle after relay acceptance");
  assert(
    signedContent === "cipher:plaintext",
    "backend must encrypt before signing",
  );
});
