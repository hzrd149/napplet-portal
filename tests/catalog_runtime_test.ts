import { computeAggregateHash } from "@kehto/nip/5a";
import { EventStore } from "applesauce-core";
import { BehaviorSubject, of, Subject } from "npm:rxjs@7.8.2";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip19,
} from "nostr-tools";
import type { IdentitySnapshot } from "../runtime/accounts.ts";
import {
  CATALOG_IDENTIFIER,
  CATALOG_KIND,
  CatalogService,
} from "../runtime/catalog.ts";
import {
  CatalogSyncOwner,
  createEventRuntime,
} from "../runtime/event_runtime.ts";
import { createProductionCatalogResolver } from "../runtime/portal_runtime.ts";
import { RelayPolicy } from "../runtime/relay_policy.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return [...new Uint8Array(hash)].map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

async function manifest(identifier = "second-napplet") {
  const key = generateSecretKey();
  const bytes = new TextEncoder().encode(
    "<main>Second verified napplet</main>",
  );
  const blobHash = await sha256(bytes);
  const aggregate = computeAggregateHash([{
    path: "/index.html",
    sha256: blobHash,
  }]);
  const event = finalizeEvent({
    kind: 35129,
    created_at: 42,
    content: "",
    tags: [
      ["d", identifier],
      ["path", "/index.html", blobHash],
      ["x", aggregate, "aggregate"],
      ["server", "https://manifest.example"],
      ["requires", "identity"],
      ["title", "Second Napplet"],
    ],
  }, key);
  return {
    event,
    bytes,
    key,
    coordinate: `35129:${event.pubkey}:${identifier}`,
  };
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

Deno.test("production resolver previews, approves, and launches an arbitrary exact manifest", async () => {
  const candidate = await manifest();
  const requested: string[][] = [];
  const eventRuntime = createEventRuntime({
    request: (relays) => {
      requested.push(relays);
      return new BehaviorSubject(candidate.event);
    },
  });
  const resolve = createProductionCatalogResolver({
    eventRuntime,
    blossomServers: () => ["https://configured-blossom.example"],
    fetchBytes: (url) => {
      assert(
        url.startsWith("https://configured-blossom.example/"),
        "configured Blossom is first",
      );
      return Promise.resolve(candidate.bytes);
    },
  });
  const accountKey = generateSecretKey();
  const accountPubkey = getPublicKey(accountKey);
  const service = new CatalogService({
    eventStore: eventRuntime.eventStore,
    identity: () => ({
      accountId: accountPubkey,
      pubkey: accountPubkey,
      status: "active",
    }),
    relayPolicy: new RelayPolicy({
      defaults: [],
      blocked: ["wss://blocked.example"],
    }),
    configuredReadRelays: () => ["wss://configured.example"],
    resolvePreviewArtifact: (coordinate, relays) =>
      resolve(coordinate, undefined, relays),
    resolveVerifiedArtifact: (coordinate, id) =>
      resolve(coordinate, id, ["wss://configured.example"]),
    signEvent: (template) =>
      Promise.resolve(finalizeEvent(template, accountKey)),
    publish: () =>
      Promise.resolve([{ relay: "wss://write.example", accepted: true }]),
  });
  const address = nip19.naddrEncode({
    kind: 35129,
    pubkey: candidate.event.pubkey,
    identifier: "second-napplet",
    relays: ["wss://blocked.example", "wss://hint.example"],
  });
  const preview = await service.previewInstall(address);
  assert(preview.ok, "arbitrary coordinate previews");
  assert(
    requested[0].join(",") === "wss://hint.example/,wss://configured.example/",
    "bounded policy reads flow to exact loader",
  );
  const approved = await service.approveManifestUpdate(
    "approve",
    candidate.coordinate,
    candidate.event.id,
    preview.value.sourceCatalogEventId,
  );
  assert(approved.ok, "verified manifest can be approved");
  const projection = await service.project();
  const launched = await service.launch(
    projection.catalogEventId!,
    candidate.coordinate,
    candidate.event.id,
  );
  assert(
    launched.ok &&
      launched.value.launch.srcdoc.includes("Second verified napplet"),
    "only verified bytes launch",
  );
  eventRuntime.destroy();
});

Deno.test("production resolver rejects exact identity and integrity mismatches without bytes", async () => {
  const candidate = await manifest();
  const variants = [
    { ...candidate.event, id: "f".repeat(64) },
    finalizeEvent({
      ...candidate.event,
      tags: candidate.event.tags.map((tag) =>
        tag[0] === "d" ? ["d", "wrong"] : tag
      ),
    }, candidate.key),
    finalizeEvent({ ...candidate.event, kind: 1 }, candidate.key),
    { ...candidate.event, sig: "0".repeat(128) },
    finalizeEvent({
      ...candidate.event,
      tags: candidate.event.tags.map((tag) =>
        tag[0] === "x" ? ["x", "0".repeat(64), "aggregate"] : tag
      ),
    }, candidate.key),
  ];
  for (const event of variants) {
    const runtime = createEventRuntime({ request: () => of(event) });
    const resolve = createProductionCatalogResolver({
      eventRuntime: runtime,
      blossomServers: () => [],
      fetchBytes: () => Promise.resolve(candidate.bytes),
    });
    let exposed = false;
    try {
      const result = await resolve(candidate.coordinate, candidate.event.id, [
        "wss://relay.example",
      ]);
      exposed = result.launch.srcdoc.length > 0;
    } catch { /* expected */ }
    assert(!exposed, "mismatch must expose no executable bytes");
    runtime.destroy();
  }
  const runtime = createEventRuntime({ request: () => of(candidate.event) });
  const resolve = createProductionCatalogResolver({
    eventRuntime: runtime,
    blossomServers: () => [],
    fetchBytes: () => Promise.resolve(new TextEncoder().encode("tampered")),
  });
  await assertRejects(() =>
    resolve(candidate.coordinate, candidate.event.id, ["wss://relay.example"])
  );
  runtime.destroy();
});

async function assertRejects(action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch {
    return;
  }
  throw new Error("expected rejection");
}

Deno.test("catalog sync replaces account and settings work, preserves last-good state, and rejects late generations", async () => {
  const accountA = generateSecretKey();
  const accountB = generateSecretKey();
  const pubkeyA = getPublicKey(accountA);
  const pubkeyB = getPublicKey(accountB);
  const identity$ = new BehaviorSubject<IdentitySnapshot>({
    accountId: pubkeyA,
    pubkey: pubkeyA,
    status: "active",
  });
  const relays$ = new BehaviorSubject<readonly string[]>(["wss://one.example"]);
  const streams: Subject<ReturnType<typeof catalogEvent>>[] = [];
  const requested: string[][] = [];
  const runtime = createEventRuntime({
    request: (relays) => {
      requested.push(relays);
      const stream = new Subject<ReturnType<typeof catalogEvent>>();
      streams.push(stream);
      return stream;
    },
  });
  let current = identity$.value;
  identity$.subscribe((identity) => current = identity);
  const service = new CatalogService({
    eventStore: new EventStore(),
    identity: () => current,
    resolveVerifiedArtifact: () => Promise.reject(new Error("not needed")),
    signEvent: () => Promise.reject(new Error("not needed")),
    publish: () => Promise.resolve([]),
  });
  const owner = new CatalogSyncOwner({
    eventRuntime: runtime,
    catalog: service,
    identity$,
    configuredReads$: relays$,
    relayPolicy: (relays) => new RelayPolicy({ defaults: relays }),
  });
  streams[0].next(catalogEvent(accountA, 1));
  streams[0].complete();
  await settle();
  assert(
    (await service.project()).catalogEventId !== null,
    "EOSE keeps loaded truth ready",
  );
  relays$.next(["wss://two.example"]);
  const old = streams[0];
  assert(
    streams.length === 2 && requested[1][0] === "wss://two.example/",
    "settings replace one subscription",
  );
  old.next(catalogEvent(accountA, 9));
  streams[1].error(new Error("offline"));
  assert(
    (await service.project()).catalogEventId !== null,
    "transient error preserves last-good truth",
  );
  identity$.next({ accountId: pubkeyB, pubkey: pubkeyB, status: "active" });
  assert(
    (await service.project()).entries.length === 0,
    "account authority resets",
  );
  streams[1].next(catalogEvent(accountA, 10));
  owner.reconnect();
  assert(Number(streams.length) === 4, "reconnect replaces active work once");
  owner.destroy();
  assert(
    streams[3].observed === false,
    "teardown releases active subscription",
  );
  runtime.destroy();
});

function catalogEvent(key: Uint8Array, createdAt: number) {
  return finalizeEvent({
    kind: CATALOG_KIND,
    created_at: createdAt,
    tags: [["d", CATALOG_IDENTIFIER]],
    content: JSON.stringify({ version: 1, entries: [] }),
  }, key);
}
