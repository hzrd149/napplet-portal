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

const secret = new Uint8Array(32).fill(17);
const accountPubkey = getPublicKey(secret);
const manifestEventId = "2".repeat(64);

function authorityHarness(capabilities: readonly string[]) {
  const runtime = createPortalRuntime({ fixture });
  const sent: Record<string, unknown>[] = [];
  let signerEffects = 0;
  const common = new CommonService({
    eventRuntime: runtime.eventRuntime,
    identity: () => ({
      accountId: accountPubkey,
      pubkey: accountPubkey,
      status: "active",
    }),
    relays: () => ["wss://required.example/"],
    publisher: {
      publish: (_id, template) => {
        signerEffects++;
        return Promise.resolve({
          ok: true as const,
          event: finalizeEvent(template, secret),
        });
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
    acceptsManifest: (coordinate: string, eventId: string) =>
      coordinate === fixture.coordinate && eventId === manifestEventId,
    project: () =>
      Promise.resolve({
        catalogEventId: "catalog",
        entries: [],
        status: "ready",
      }),
    authoritySnapshot: () => ({
      accountPubkey,
      catalogEventId: "catalog",
      status: "ready",
      artifacts: [],
    }),
    subscribe: () => () => undefined,
    launch: () =>
      Promise.resolve({
        ok: true as const,
        value: {
          manifestEventId,
          title: "Authority tracer",
          version: "1",
          capabilities,
          declarations: [],
          launch: {
            dTag: "authority-tracer",
            aggregateHash: "3".repeat(64),
            srcdoc: "<main/>",
          },
        },
      }),
  } as never);
  runtime.signIn(accountPubkey);
  const bridge = runtime.openWindow(
    "connection-authority",
    "window-authority",
    {},
    (message) => sent.push(message),
  );
  return { runtime, bridge, sent, signerEffects: () => signerEffects };
}

Deno.test("authority tracer rejects an ungranted action before signer effect", async () => {
  const harness = authorityHarness(["common.encodeNip19"]);
  await harness.bridge.catalogCommand({
    type: "catalog.launch",
    id: "launch",
    catalogEventId: "catalog",
    coordinate: fixture.coordinate,
    manifestEventId,
  });

  await harness.bridge.dispatchTransfer({
    type: "common.encodeNip19",
    id: "declared",
    input: { type: "npub", hex: accountPubkey },
  } as never);
  await harness.bridge.dispatchTransfer({
    type: "common.follow",
    id: "forged",
    pubkeys: [nip19.npubEncode("a".repeat(64))],
  } as never);

  assert(
    harness.sent[0]?.type === "common.encodeNip19.result" &&
      harness.sent[0]?.ok === true,
    "the exact verified action grant must remain usable",
  );
  assert(
    harness.sent[1]?.type === "common.follow.result" &&
      harness.sent[1]?.error === "not-authorized",
    "a sibling action must not inherit a broad domain grant",
  );
  assert(
    harness.signerEffects() === 0,
    "ungranted signer-backed action must have zero effects",
  );
  assert(
    !JSON.stringify(harness.sent[1]).includes("wss://") &&
      !JSON.stringify(harness.sent[1]).includes("nsec"),
    "denial must be sanitized",
  );
  harness.runtime.destroy();
});
