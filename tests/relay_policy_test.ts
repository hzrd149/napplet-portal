import { EventStore } from "applesauce-core";
import { MailboxesModel } from "applesauce-core/models";
import {
  createFilterMap,
  createOutboxMap,
} from "applesauce-core/helpers/relay-selection";
import { RelayPool } from "applesauce-relay";
import { map, type Observable, of } from "npm:rxjs@7.8.2";
import {
  RelayPolicy,
  resolveAuthPermission,
  resolveReadRelays,
  resolveWriteRelays,
} from "../runtime/relay_policy.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("installed mailbox model drives pool observable maps on replacement", () => {
  const pubkey = "a".repeat(64);
  const store = new EventStore({ verifyEvent: () => true });
  const mailboxes$ = store.model(MailboxesModel, pubkey);
  const outboxes$ = mailboxes$.pipe(
    map((mailboxes) =>
      createOutboxMap([{ pubkey, relays: mailboxes?.outboxes ?? [] }])
    ),
  );
  const filters$ = outboxes$.pipe(
    map((outboxes) => createFilterMap(outboxes, { kinds: [1] })),
  );
  const seen: string[][] = [];
  outboxes$.subscribe((map) => seen.push(Object.keys(map)));

  const pool = new RelayPool();
  const outboxInput: Parameters<RelayPool["outboxSubscription"]>[0] = outboxes$;
  const filterInput: Parameters<RelayPool["subscriptionMap"]>[0] = filters$;
  assert(
    outboxInput === outboxes$ && filterInput === filters$,
    "pool accepts model-derived observables directly",
  );

  const event = (created_at: number, relay: string) => ({
    id: `${created_at}`.padStart(64, "0"),
    pubkey,
    created_at,
    kind: 10002,
    tags: [["r", relay, "write"]],
    content: "",
    sig: "b".repeat(128),
  });
  store.add(event(1, "wss://relay.damus.io"));
  store.add(event(2, "wss://nos.lol"));
  assert(seen[0]?.length === 0, "mailboxes are initially absent");
  assert(
    seen.some((relays) => relays.includes("wss://relay.damus.io/")),
    "first relay list emits",
  );
  assert(
    seen.at(-1)?.includes("wss://nos.lol/"),
    "newer replacement changes pool input",
  );
  pool.close();
  store.dispose();
});

Deno.test("relay policy canonicalizes precedence, blocking, empty sets, and AUTH", () => {
  const settings = {
    defaults: ["wss://default.example", "wss://DEFAULT.example/"],
    fallbacks: ["wss://fallback.example"],
    blocked: ["wss://blocked.example/", "wss://default.example"],
    auth: ["wss://auth.example", "wss://blocked.example"],
  };
  assert(
    resolveReadRelays(
      { inboxes: ["wss://nip65.example"], outboxes: [] },
      settings,
    )[0] === "wss://nip65.example/",
    "NIP-65 wins",
  );
  assert(
    resolveWriteRelays(undefined, settings)[0] === "wss://fallback.example/",
    "blocked defaults fall through",
  );
  assert(
    resolveReadRelays(undefined, { defaults: [], fallbacks: [] }).length === 0,
    "empty eligible set stays empty",
  );
  assert(
    resolveAuthPermission("wss://AUTH.example/", settings),
    "exact canonical opt-in permits AUTH",
  );
  assert(
    !resolveAuthPermission("wss://other.example", settings),
    "AUTH is opt-in",
  );
  assert(
    !resolveAuthPermission("wss://blocked.example", settings),
    "blocked overrides AUTH",
  );
});

Deno.test("blocked relay is removed before any pool operation input", () => {
  const policy = new RelayPolicy({
    defaults: [],
    blocked: ["wss://blocked.example"],
  });
  const seen: string[][] = [];
  policy.filterMap(of({
    "wss://blocked.example": { kinds: [1] },
    "wss://ok.example": { kinds: [1] },
  })).subscribe((map) => seen.push(Object.keys(map)));
  assert(
    seen[0]?.length === 1 && seen[0][0] === "wss://ok.example/",
    "blocked URL never reaches subscription map",
  );
  assert(
    policy.read({ inboxes: ["wss://blocked.example"], outboxes: [] }).length ===
      0,
    "blocked URL never reaches connect/read",
  );
  assert(
    policy.write({ inboxes: [], outboxes: ["wss://blocked.example"] })
      .length === 0,
    "blocked URL never reaches publish",
  );
  assert(
    !policy.auth("wss://blocked.example"),
    "blocked URL never reaches AUTH",
  );
});
