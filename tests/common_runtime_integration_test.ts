import { finalizeEvent, getPublicKey, nip19 } from "nostr-tools";
import fixture from "./fixtures/supplied_napplet_contract.json" with {
  type: "json",
};
import { CommonService } from "../runtime/common.ts";
import { NapDispatcher } from "../runtime/nap_dispatcher.ts";
import { createPortalRuntime } from "../runtime/portal_runtime.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const secret = new Uint8Array(32).fill(9);
const pubkey = getPublicKey(secret);

function harness(accept = true) {
  const runtime = createPortalRuntime({ fixture });
  const sent: Record<string, unknown>[] = [];
  let publishes = 0;
  const common = new CommonService({
    eventRuntime: runtime.eventRuntime,
    identity: () => ({ accountId: "active", pubkey, status: "active" }),
    relays: () => ["wss://required.example/"],
    publisher: {
      publish: (_id, template) => {
        publishes++;
        return Promise.resolve(
          accept
            ? { ok: true as const, event: finalizeEvent(template, secret) }
            : { ok: false as const, error: "relay detail" },
        );
      },
    },
  });
  const dispatcher = new NapDispatcher({
    resource: {
      bytes: () => Promise.reject(new Error("unused")),
      bytesMany: () => Promise.resolve([]),
    },
    transfer: {
      upload: () => Promise.reject(new Error("unused")),
      status: () => undefined,
    },
    settings: () => ({ blossomServers: [] }),
    common,
    send: (owner, message) => runtime.deliverTransfer(owner, message),
  });
  runtime.configureTransfers(dispatcher);
  runtime.configureCatalog({
    project: () =>
      Promise.resolve({
        catalogEventId: "catalog",
        entries: [],
        status: "ready",
      }),
    subscribe: () => () => undefined,
    launch: () =>
      Promise.resolve({
        ok: true as const,
        value: {
          manifestEventId: "2".repeat(64),
          title: "Common",
          version: "1",
          capabilities: ["common"],
          launch: {
            dTag: "common",
            aggregateHash: "3".repeat(64),
            srcdoc: "<main/>",
          },
        },
      }),
  } as never);
  runtime.signIn(pubkey);
  const bridge = runtime.openWindow(
    "connection",
    "window",
    {},
    (message) => sent.push(message),
  );
  return { runtime, bridge, sent, publishes: () => publishes };
}

Deno.test("authorized success waits for production COMMON publication seam", async () => {
  const h = harness();
  await h.bridge.catalogCommand({
    type: "catalog.launch",
    id: "launch",
    catalogEventId: "catalog",
    coordinate: fixture.coordinate,
    manifestEventId: "2".repeat(64),
  });
  await h.bridge.dispatchTransfer(
    {
      type: "common.follow",
      id: "follow",
      pubkeys: [nip19.npubEncode("a".repeat(64))],
    } as never,
  );
  assert(
    h.publishes() === 1 && h.sent[0].ok === true &&
      h.sent[0].type === "common.follow.result",
    "authorized action settles after publish",
  );
  h.runtime.destroy();
});

Deno.test("denied COMMON authority never publishes", async () => {
  const h = harness();
  await h.bridge.dispatchTransfer(
    {
      type: "common.follow",
      id: "denied",
      pubkeys: [nip19.npubEncode("a".repeat(64))],
    } as never,
  );
  assert(
    h.publishes() === 0 && h.sent[0].error === "not-authorized",
    "missing launch is denied",
  );
  h.runtime.destroy();
});

Deno.test("publication failure is stable and records no successful mutation", async () => {
  const h = harness(false);
  await h.bridge.catalogCommand({
    type: "catalog.launch",
    id: "launch",
    catalogEventId: "catalog",
    coordinate: fixture.coordinate,
    manifestEventId: "2".repeat(64),
  });
  await h.bridge.dispatchTransfer(
    {
      type: "common.follow",
      id: "failed",
      pubkeys: [nip19.npubEncode("a".repeat(64))],
    } as never,
  );
  assert(
    h.sent[0].ok === false && h.sent[0].error === "publication-failed" &&
      !JSON.stringify(h.sent[0]).includes("relay detail"),
    "publication details are redacted",
  );
  h.runtime.destroy();
});

Deno.test("production composition wires PortalAccounts signer and RelayPolicy outbox", async () => {
  const source = await Deno.readTextFile("main.ts");
  assert(
    source.includes("new CommonService"),
    "main constructs the process COMMON service",
  );
  assert(
    source.includes("new OutboxAdapter"),
    "main constructs the required-relay publisher",
  );
  assert(
    source.includes("signerAccounts.signEvent"),
    "production signing stays in PortalAccounts",
  );
  assert(
    source.includes("eventRuntime.relayPool"),
    "production publication uses the process relay pool",
  );
});
