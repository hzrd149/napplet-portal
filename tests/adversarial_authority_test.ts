import { finalizeEvent, getPublicKey, nip19 } from "nostr-tools";
import { EventStore } from "applesauce-core";
import fixture from "./fixtures/supplied_napplet_contract.json" with {
  type: "json",
};
import { CommonService } from "../runtime/common.ts";
import {
  isExactWindowAuthority,
  NapDispatcher,
  type WindowCapabilityContext,
} from "../runtime/nap_dispatcher.ts";
import { createPortalRuntime } from "../runtime/portal_runtime.ts";
import {
  CATALOG_IDENTIFIER,
  CatalogService,
  type VerifiedCatalogArtifact,
} from "../runtime/catalog.ts";
import { hasContractGrant } from "../runtime/nap_contract_registry.ts";
import { SignerConnectionService } from "../runtime/signer_service.ts";
import { BehaviorSubject } from "npm:rxjs@7.8.2";
import type { IdentitySnapshot } from "../runtime/accounts.ts";

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

Deno.test("authority matrix denies malformed invented and sibling grants", () => {
  const rows: readonly [readonly string[], string, boolean][] = [
    [["common"], "common.follow", true],
    [["common.follow"], "common.follow", true],
    [["common.encodeNip19"], "common.follow", false],
    [["common.follow.extra"], "common.follow", false],
    [["common"], "common.invented", false],
    [["identity"], "common.follow", false],
    [[""], "common.follow", false],
  ];
  for (const [grants, action, expected] of rows) {
    assert(
      hasContractGrant(grants, action) === expected,
      `${JSON.stringify(grants)} must resolve ${action} to ${expected}`,
    );
  }
});

Deno.test("window authority matrix rejects foreign identity instance and generation", () => {
  const current: WindowCapabilityContext = Object.freeze({
    connectionId: "connection",
    windowId: "window",
    accountPubkey,
    coordinate: fixture.coordinate,
    manifestEventId,
    dTag: "authority",
    aggregateHash: "3".repeat(64),
    grantedDomains: Object.freeze(["common"]),
    grantedCapabilities: Object.freeze(["common.follow"]),
    instanceId: "instance",
    generation: 7,
  });
  const accepted = (coordinate: string, eventId: string) =>
    coordinate === fixture.coordinate && eventId === manifestEventId;
  assert(
    isExactWindowAuthority(current, current, accountPubkey, accepted),
    "the exact server-owned context must remain authorized",
  );
  const mutations: Partial<WindowCapabilityContext>[] = [
    { connectionId: "foreign" },
    { windowId: "foreign" },
    { accountPubkey: "f".repeat(64) },
    { coordinate: "35129:" + "f".repeat(64) + ":foreign" },
    { manifestEventId: "f".repeat(64) },
    { dTag: "foreign" },
    { aggregateHash: "f".repeat(64) },
    { grantedDomains: ["common", "storage"] },
    { grantedCapabilities: ["common"] },
    { instanceId: "foreign" },
    { generation: 6 },
  ];
  for (const mutation of mutations) {
    const candidate = Object.freeze({ ...current, ...mutation });
    assert(
      !isExactWindowAuthority(current, candidate, accountPubkey, accepted),
      `foreign authority mutation must deny: ${JSON.stringify(mutation)}`,
    );
  }
  assert(
    !isExactWindowAuthority(current, current, "f".repeat(64), accepted),
    "active account replacement must deny the prior context",
  );
  assert(
    !isExactWindowAuthority(current, current, accountPubkey, () => false),
    "catalog replacement must deny the prior context",
  );
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => resolve = done);
  return { promise, resolve };
}

function catalogAuthorityHarness() {
  const accountASecret = new Uint8Array(32).fill(21);
  const accountBSecret = new Uint8Array(32).fill(22);
  const accountA = getPublicKey(accountASecret);
  const accountB = getPublicKey(accountBSecret);
  const nappletSecret = new Uint8Array(32).fill(23);
  const nappletPubkey = getPublicKey(nappletSecret);
  const coordinate = `35129:${nappletPubkey}:authority`;
  const acceptedManifestEventId = "a".repeat(64);
  const store = new EventStore();
  const event = finalizeEvent({
    kind: 30078,
    created_at: 1,
    tags: [["d", CATALOG_IDENTIFIER]],
    content: JSON.stringify({
      version: 1,
      entries: [{ coordinate, acceptedManifestEventId }],
    }),
  }, accountASecret);
  store.add(event);
  let active = {
    accountId: accountA,
    pubkey: accountA,
    status: "active" as const,
  };
  let publishes = 0;
  const resolution = deferred<VerifiedCatalogArtifact>();
  const service = new CatalogService({
    eventStore: store,
    identity: () => active,
    resolveVerifiedArtifact: () => resolution.promise,
    signEvent: (template) =>
      Promise.resolve(finalizeEvent(template, accountASecret)),
    publish: () => {
      publishes++;
      return Promise.resolve([{
        relay: "wss://required.example",
        accepted: true,
      }]);
    },
  });
  return {
    service,
    event,
    coordinate,
    acceptedManifestEventId,
    resolution,
    replaceAccount: () => {
      active = { accountId: accountB, pubkey: accountB, status: "active" };
    },
    publishes: () => publishes,
  };
}

function verifiedArtifact(manifestEventId: string): VerifiedCatalogArtifact {
  return {
    manifestEventId,
    title: "Authority",
    version: "1",
    capabilities: ["common.follow"],
    declarations: [],
    launch: {
      dTag: "authority",
      aggregateHash: "b".repeat(64),
      srcdoc: "<main/>",
    },
  };
}

Deno.test("catalog authority rejects account replacement during artifact resolution", async () => {
  const harness = catalogAuthorityHarness();
  const pending = harness.service.launch(
    harness.event.id,
    harness.coordinate,
    harness.acceptedManifestEventId,
  );
  harness.replaceAccount();
  harness.resolution.resolve(verifiedArtifact(harness.acceptedManifestEventId));
  const result = await pending;
  assert(!result.ok, "foreign active account must receive no launch bytes");
  assert(
    JSON.stringify(result) ===
      '{"ok":false,"error":"catalog changed","retryable":true}',
    "catalog replacement denial must be stable and sanitized",
  );
});

Deno.test("catalog signer authority rejects account replacement before publication", async () => {
  const harness = catalogAuthorityHarness();
  const pending = harness.service.approveManifestUpdate(
    "approve",
    harness.coordinate,
    harness.acceptedManifestEventId,
  );
  await Promise.resolve();
  harness.replaceAccount();
  harness.resolution.resolve(verifiedArtifact(harness.acceptedManifestEventId));
  const result = await pending;
  assert(!result.ok, "foreign active account must not mutate the catalog");
  assert(
    harness.publishes() === 0,
    "stale signer must cause zero publication effects",
  );
  assert(
    result.error === "catalog mutation failed",
    "signer authority denial must be sanitized",
  );
});

Deno.test("signer failures never return nsec bunker or upstream authority details", async () => {
  const unavailable = {
    accountId: null,
    pubkey: null,
    status: "unavailable" as const,
  };
  const secretError = "nsec1secret bunker://private local=/home/user/key";
  const service = new SignerConnectionService({
    identity$: new BehaviorSubject<IdentitySnapshot>(unavailable),
    startNostrConnect: () => Promise.reject(new Error("unused")),
    signInBunker: () => Promise.reject(new Error(secretError)),
    signInNsec: () => Promise.reject(new Error(secretError)),
  });

  for (
    const [invoke, expected] of [
      [
        () => service.signInBunker("bunker://untrusted"),
        "Bunker sign-in failed",
      ],
      [() => service.signInNsec("nsec1untrusted"), "nsec sign-in failed"],
    ] as const
  ) {
    let observed = "";
    try {
      await invoke();
    } catch (error) {
      observed = error instanceof Error ? error.message : String(error);
    }
    assert(observed === expected, "signer rejection must use a stable error");
    assert(
      !JSON.stringify(service.state).includes(secretError),
      "projected signer state must contain no upstream authority detail",
    );
  }
});
