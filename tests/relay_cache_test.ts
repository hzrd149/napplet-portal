import fixture from "./fixtures/supplied_napplet_contract.json" with {
  type: "json",
};
import { Observable, Subject } from "npm:rxjs@7.8.2";
import {
  LOCAL_RELAY_REQUEST_TIMEOUT_MS,
  RelayCache,
} from "../runtime/relay_cache.ts";
import {
  BackendRelayAdapter,
  type RawRelayItem,
} from "../runtime/relay_adapter.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function owner(connectionId = "one") {
  return { connectionId, windowId: "window" };
}

function request(subId: string) {
  return {
    type: "relay.subscribe" as const,
    id: `request-${subId}`,
    subId,
    relay: "wss://upstream.example",
    filters: [{ kinds: [1] }],
  };
}

Deno.test("local EOSE opens upstream with the exact backend timeout", () => {
  const local = new Subject<RawRelayItem>();
  const upstream = new Subject<RawRelayItem>();
  let timeout = 0;
  let upstreamSubscriptions = 0;
  const cache = new RelayCache({
    url: "ws://127.0.0.1:7777/",
    request: (_filters, options) => {
      timeout = options.timeout;
      return local;
    },
    publish: () => Promise.resolve(),
  });
  const adapter = new BackendRelayAdapter({
    cache,
    store: { query: () => [], add: () => {} },
    pool: {
      req: () =>
        new Observable((subscriber) => {
          upstreamSubscriptions++;
          return upstream.subscribe(subscriber);
        }),
    },
  });
  const messages: string[] = [];
  adapter.subscribe(
    owner(),
    request("bounded"),
    (message) => messages.push(message.type),
  );
  assert(
    timeout === LOCAL_RELAY_REQUEST_TIMEOUT_MS && timeout === 1_500,
    "exact timeout is passed to Applesauce",
  );
  assert(upstreamSubscriptions === 0, "upstream waits for local completion");
  local.next({ type: "EOSE" });
  local.complete();
  assert(
    upstreamSubscriptions > 0,
    "early local EOSE opens upstream immediately",
  );
  assert(
    !messages.includes("relay.eose"),
    "local EOSE is an internal cache boundary",
  );
  upstream.next({ type: "EOSE" });
  assert(
    messages.filter((type) => type === "relay.eose").length === 1,
    "only upstream produces singular EOSE",
  );
});

Deno.test("local failure degrades health and falls through to upstream", () => {
  let upstreamSubscriptions = 0;
  const cache = new RelayCache({
    url: "ws://127.0.0.1:7777/",
    request: () =>
      new Observable((subscriber) =>
        subscriber.error(new Error("secret payload"))
      ),
    publish: () => Promise.resolve(),
  });
  new BackendRelayAdapter({
    cache,
    store: { query: () => [], add: () => {} },
    pool: {
      req: () =>
        new Observable(() => {
          upstreamSubscriptions++;
        }),
    },
  }).subscribe(owner(), request("failure"), () => {});
  assert(upstreamSubscriptions === 1, "local error opens upstream");
  const health = cache.relayCacheHealth$.value;
  assert(
    health.status === "degraded" && health.reason === "read-failed",
    "sanitized health records read failure",
  );
  assert(
    !JSON.stringify(health).includes("secret"),
    "health omits upstream payloads",
  );
});

Deno.test("upstream delivery precedes observed cache acknowledgement with provenance and dedupe", async () => {
  const local = new Subject<RawRelayItem>();
  const upstream = new Subject<RawRelayItem>();
  let rejectWrite: ((reason: Error) => void) | undefined;
  const order: string[] = [];
  const added: string[] = [];
  const cache = new RelayCache({
    url: "ws://127.0.0.1:7777/",
    request: () => local,
    publish: () =>
      new Promise((_resolve, reject) => {
        rejectWrite = reject;
      }),
  });
  const adapter = new BackendRelayAdapter({
    cache,
    store: { query: () => [], add: (_event, from) => added.push(from ?? "") },
    pool: { req: () => upstream },
  });
  adapter.subscribe(owner(), request("write"), (message) => {
    if (message.type === "relay.event") order.push("delivered");
  });
  local.complete();
  upstream.next({
    type: "EVENT",
    event: fixture.events.live,
    from: "wss://observed.example",
  });
  upstream.next({
    type: "EVENT",
    event: fixture.events.live,
    from: "wss://observed.example",
  });
  assert(
    order.length === 1 && order[0] === "delivered",
    "caller receives before cache acknowledgement and duplicates collapse",
  );
  assert(
    added.length === 2 &&
      added.every((from) => from === "wss://observed.example"),
    "provenance is inserted even for duplicate arrivals",
  );
  await Promise.resolve();
  rejectWrite?.(new Error("disk payload"));
  await Promise.resolve();
  await Promise.resolve();
  assert(
    cache.relayCacheHealth$.value.status === "degraded",
    "write rejection is observed without failing stream",
  );
});

Deno.test("close remains isolated per owner", () => {
  const local = new Subject<RawRelayItem>();
  const upstream = new Subject<RawRelayItem>();
  const cache = new RelayCache({
    url: "ws://127.0.0.1:7777/",
    request: () => local,
    publish: () => Promise.resolve(),
  });
  const adapter = new BackendRelayAdapter({
    cache,
    store: { query: () => [], add: () => {} },
    pool: { req: () => upstream },
  });
  const first: string[] = [];
  const second: string[] = [];
  const one = adapter.subscribe(
    owner("one"),
    request("same"),
    (message) => first.push(message.type),
  );
  adapter.subscribe(
    owner("two"),
    request("same"),
    (message) => second.push(message.type),
  );
  local.complete();
  one.close();
  upstream.next({
    type: "EVENT",
    event: fixture.events.live,
    from: "wss://relay",
  });
  assert(
    !first.includes("relay.event") && second.includes("relay.event"),
    "owner close is isolated",
  );
});
