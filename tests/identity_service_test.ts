import fixture from "./fixtures/supplied_napplet_contract.json" with {
  type: "json",
};
import { BehaviorSubject, Subject } from "npm:rxjs@7.8.2";
import {
  OutboxAdapter,
  type OutboxRawItem,
} from "../runtime/outbox.ts";
import { RuntimeServiceHub } from "../runtime/portal_runtime.ts";
import type { IdentitySnapshot } from "../runtime/accounts.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("identity broadcasts browser-safe active offline and unavailable states", () => {
  const identity$ = new BehaviorSubject<IdentitySnapshot>({
    accountId: null,
    pubkey: null,
    status: "unavailable",
  });
  const hub = new RuntimeServiceHub({ identity$ });
  const first: IdentitySnapshot[] = [];
  const second: IdentitySnapshot[] = [];
  const one = hub.openWindow("one", (message) => first.push(message.identity));
  hub.openWindow("two", (message) => second.push(message.identity));
  identity$.next({ accountId: "account", pubkey: "f".repeat(64), status: "active" });
  identity$.next({ accountId: "account", pubkey: "f".repeat(64), status: "offline" });
  one.close();
  identity$.next({ accountId: null, pubkey: null, status: "unavailable" });

  assert(first.map((value) => value.status).join(",") === "unavailable,active,offline", "closed window must stop immediately");
  assert(second.at(-1)?.status === "unavailable", "remaining window must receive sign-out");
  assert(JSON.stringify(second).includes("signer") === false, "identity must contain no signer material");
  hub.destroy();
});

Deno.test("OUTBOX merges preset and NIP-65 relays, omits EOSE, and signs before settled publish", async () => {
  const live = new Subject<OutboxRawItem>();
  const published: Array<{ relay: string; id: string }> = [];
  const resolvers: Array<(accepted: boolean) => void> = [];
  let signedTemplate: unknown;
  const adapter = new OutboxAdapter({
    presetRelays: ["wss://preset"],
    identity: () => ({ accountId: "a", pubkey: "f".repeat(64), status: "active" }),
    nip65Relays: () => ["wss://write", "wss://preset"],
    signEvent: (template) => {
      signedTemplate = template;
      return Promise.resolve(fixture.events.live);
    },
    pool: {
      req: (relays) => {
        assert(relays.join(",") === "wss://preset,wss://write", "routing must merge and dedupe");
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
  const resultPromise = adapter.publish("request-id", { kind: 1, content: "unsigned", tags: [], created_at: 1 })
    .then((result) => {
      settled = true;
      return result;
    });
  await Promise.resolve();
  assert(!settled, "publish must await relay acknowledgements");
  assert((signedTemplate as { content: string }).content === "unsigned", "OUTBOX must sign template");
  resolvers.forEach((resolve) => resolve(true));
  const result = await resultPromise;
  assert(result.ok && published.length === 2, "all required relay outcomes must settle");
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
  const result = await adapter.publish("blocked", { kind: 1, content: "", tags: [], created_at: 1 });
  assert(!result.ok, "unavailable signer must reject publish");
  live.next({ type: "EVENT", event: fixture.events.initial, from: "wss://preset" });
  assert(messages.includes("outbox.event"), "public reads must continue");
});

