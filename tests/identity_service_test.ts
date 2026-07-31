import fixture from "./fixtures/supplied_napplet_contract.json" with {
  type: "json",
};
import { Subject } from "npm:rxjs@7.8.2";
import { OutboxAdapter, type OutboxRawItem } from "../runtime/outbox.ts";
import { createPortalRuntime } from "../runtime/portal_runtime.ts";
import { createVerifiedIdentityPublisher } from "../components/NappletFrame.tsx";
import {
  BackendRelayAdapter,
  type RawRelayItem,
} from "../runtime/relay_adapter.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("sign-out identity delivery is exact once and verified-source bound", () => {
  const trusted = {} as Window;
  const stale = {} as Window;
  const sent: unknown[] = [];
  const publish = createVerifiedIdentityPublisher({
    source: () => trusted,
    registered: () => ({
      source: trusted,
      identity: { dTag: "app", aggregateHash: "hash" },
    }),
    post: (message) => sent.push(message),
  });
  const canonical = {
    type: "identity.changed" as const,
    identity: { pubkey: "" },
  };
  assert(
    !publish(stale, canonical),
    "stale or foreign source must be rejected",
  );
  assert(
    publish(trusted, canonical),
    "eligible verified source must receive sign-out",
  );
  assert(
    sent.length === 1,
    "eligible source must receive exactly one transition",
  );
  assert(
    JSON.stringify(sent[0]) === JSON.stringify(canonical),
    "delivery must use pinned canonical envelope",
  );
});

Deno.test("identity broadcasts browser-safe active and unavailable states across windows", () => {
  const runtime = createPortalRuntime({ fixture });
  const first: Array<{ identity: { status: string } }> = [];
  const second: Array<{ identity: { status: string } }> = [];
  const one = runtime.openWindow(
    "connection-one",
    "window-one",
    {},
    (message) => first.push(message as { identity: { status: string } }),
  );
  const two = runtime.openWindow(
    "connection-two",
    "window-two",
    {},
    (message) => second.push(message as { identity: { status: string } }),
  );

  one.replayIdentity();
  two.replayIdentity();
  assert(
    first.at(-1)?.identity.status === "unavailable",
    "no active account starts unavailable",
  );

  runtime.signIn("f".repeat(64));
  one.replayIdentity();
  two.replayIdentity();
  assert(
    first.at(-1)?.identity.status === "active",
    "sign-in must be observable by every window",
  );
  assert(
    second.at(-1)?.identity.status === "active",
    "both windows observe the same active identity",
  );

  // AccountRuntime (the tracer account authority behind createPortalRuntime)
  // only ever reports "active" — the intermediate "offline" leg cannot be
  // driven through this real bridge. PortalAccounts' offline status
  // transitions are covered separately in tests/accounts_test.ts (see
  // "restored unavailable NIP-46 remains active offline and retries").

  runtime.destroyWindow("window-one");
  const beforeClose = first.length;
  one.replayIdentity();
  assert(
    first.length === beforeClose,
    "closed window must stop receiving identity updates",
  );

  runtime.signOut();
  two.replayIdentity();
  assert(
    second.at(-1)?.identity.status === "unavailable",
    "remaining window must receive sign-out",
  );
  assert(
    JSON.stringify(second).includes("signer") === false,
    "identity must contain no signer material",
  );

  runtime.destroy();
});

Deno.test("BackendRelayAdapter shares relay authority while windows stay independent", () => {
  const raw = new Subject<RawRelayItem>();
  let poolRequests = 0;
  const relay = new BackendRelayAdapter({
    store: { query: () => [], add: () => {} },
    pool: {
      req: () => {
        poolRequests++;
        return raw;
      },
    },
  });
  const first: string[] = [];
  const second: string[] = [];
  const oneSubscription = relay.subscribe(
    { connectionId: "one", windowId: "window-one" },
    {
      type: "relay.subscribe",
      id: "1",
      subId: "same",
      relay: "wss://relay",
      filters: [],
    },
    (message) => first.push(message.type),
  );
  relay.subscribe(
    { connectionId: "two", windowId: "window-two" },
    {
      type: "relay.subscribe",
      id: "2",
      subId: "same",
      relay: "wss://relay",
      filters: [],
    },
    (message) => second.push(message.type),
  );
  raw.next({ type: "EVENT", event: fixture.events.live, from: "wss://relay" });
  oneSubscription.close();
  assert(
    first.includes("relay.event") && second.includes("relay.event"),
    "shared authority must deliver to both windows",
  );
  assert(
    relay.subscriptionCount === 1,
    "closing one window must preserve the other",
  );
  assert(
    poolRequests === 2,
    "logical subscriptions share one injected pool instance",
  );
  relay.destroy();
});

Deno.test("OUTBOX merges preset and NIP-65 relays, omits EOSE, and signs before settled publish", async () => {
  const live = new Subject<OutboxRawItem>();
  const published: Array<{ relay: string; id: string }> = [];
  const resolvers: Array<(accepted: boolean) => void> = [];
  let signedTemplate: unknown;
  const adapter = new OutboxAdapter({
    presetRelays: ["wss://preset"],
    identity: () => ({
      accountId: "a",
      pubkey: "f".repeat(64),
      status: "active",
    }),
    nip65Relays: () => ["wss://write", "wss://preset"],
    signEvent: (template) => {
      signedTemplate = template;
      return Promise.resolve(fixture.events.live);
    },
    pool: {
      req: (relays) => {
        assert(
          relays.join(",") === "wss://preset,wss://write",
          "routing must merge and dedupe",
        );
        return live;
      },
      publish: (relay, event) => {
        published.push({ relay, id: event.id });
        return new Promise((resolve) => resolvers.push(resolve));
      },
    },
  });
  const messages: string[] = [];
  adapter.subscribe(
    { connectionId: "one", windowId: "window" },
    { type: "outbox.subscribe", subId: "outbox", filters: [{ kinds: [1] }] },
    (message) => messages.push(message.type),
  );
  live.next({ type: "EOSE" });
  live.next({ type: "EVENT", event: fixture.events.live, from: "wss://write" });
  assert(messages.join(",") === "outbox.event", "OUTBOX must expose no EOSE");

  let settled = false;
  const resultPromise = adapter.publish("request-id", {
    kind: 1,
    content: "unsigned",
    tags: [],
    created_at: 1,
  })
    .then((result) => {
      settled = true;
      return result;
    });
  await Promise.resolve();
  assert(!settled, "publish must await relay acknowledgements");
  assert(
    (signedTemplate as { content: string }).content === "unsigned",
    "OUTBOX must sign template",
  );
  resolvers.forEach((resolve) => resolve(true));
  const result = await resultPromise;
  assert(
    result.ok && published.length === 2,
    "all required relay outcomes must settle",
  );
  assert(result.id === "request-id", "correlation ID must survive settlement");
});

Deno.test("signer-unavailable publish fails while OUTBOX reads stay live", async () => {
  const live = new Subject<OutboxRawItem>();
  const adapter = new OutboxAdapter({
    presetRelays: ["wss://preset"],
    identity: () => ({ accountId: null, pubkey: null, status: "unavailable" }),
    nip65Relays: () => [],
    signEvent: () => Promise.reject(new Error("must not sign")),
    pool: { req: () => live, publish: () => Promise.resolve(true) },
  });
  const messages: string[] = [];
  adapter.subscribe(
    { connectionId: "one", windowId: "window" },
    { type: "outbox.subscribe", subId: "read", filters: [] },
    (message) => messages.push(message.type),
  );
  const result = await adapter.publish("blocked", {
    kind: 1,
    content: "",
    tags: [],
    created_at: 1,
  });
  assert(!result.ok, "unavailable signer must reject publish");
  live.next({
    type: "EVENT",
    event: fixture.events.initial,
    from: "wss://preset",
  });
  assert(messages.includes("outbox.event"), "public reads must continue");
});
