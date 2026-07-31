import { nip19 } from "nostr-tools";
import fixture from "./fixtures/supplied_napplet_contract.json" with {
  type: "json",
};
import {
  NapDispatcher,
  type WindowCapabilityContext,
} from "../runtime/nap_dispatcher.ts";
import { createPortalRuntime } from "../runtime/portal_runtime.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const accountPubkey = "1".repeat(64);
const manifestEventId = "2".repeat(64);

function context(
  overrides: Partial<WindowCapabilityContext> = {},
): WindowCapabilityContext {
  return Object.freeze({
    connectionId: "connection-a",
    windowId: "window-a",
    accountPubkey,
    coordinate: `35129:${"3".repeat(64)}:tracer`,
    manifestEventId,
    dTag: "tracer",
    aggregateHash: "4".repeat(64),
    grantedDomains: Object.freeze(["common", "storage"]),
    instanceId: "instance-backend-issued",
    ...overrides,
  });
}

function createHarness() {
  const values = new Map<string, string>();
  const sent: Record<string, unknown>[] = [];
  let current = context();
  let storageCalls = 0;
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
    storage: {
      get(namespace, key) {
        storageCalls++;
        return values.get(`${namespace}:${key}`) ?? null;
      },
      set(namespace, key, value) {
        storageCalls++;
        values.set(`${namespace}:${key}`, value);
      },
      remove(namespace, key) {
        values.delete(`${namespace}:${key}`);
      },
      keys() {
        return [];
      },
    },
    isCurrent: (candidate) =>
      candidate.connectionId === current.connectionId &&
      candidate.windowId === current.windowId &&
      candidate.accountPubkey === current.accountPubkey &&
      candidate.coordinate === current.coordinate &&
      candidate.manifestEventId === current.manifestEventId &&
      candidate.aggregateHash === current.aggregateHash &&
      candidate.instanceId === current.instanceId,
    send: (_owner, message) => sent.push(message),
  });
  return {
    dispatcher,
    sent,
    storageCalls: () => storageCalls,
    replace(next: WindowCapabilityContext) {
      current = next;
    },
  };
}

Deno.test("verified authority completes canonical COMMON and STORAGE tracer round trips", async () => {
  const harness = createHarness();
  const authority = context();
  await harness.dispatcher.dispatch(authority, {
    type: "common.encodeNip19",
    id: "encode",
    input: { type: "npub", hex: accountPubkey },
  });
  await harness.dispatcher.dispatch(authority, {
    type: "storage.set",
    id: "set",
    key: "greeting",
    value: "hello",
  });
  await harness.dispatcher.dispatch(authority, {
    type: "storage.get",
    id: "get",
    key: "greeting",
  });

  assert(harness.sent.length === 3, "each request settles exactly once");
  assert(
    harness.sent[0].type === "common.encodeNip19.result" &&
      harness.sent[0].id === "encode" && harness.sent[0].ok === true &&
      harness.sent[0].nip19Type === "npub" &&
      harness.sent[0].value === nip19.npubEncode(accountPubkey),
    "COMMON uses the canonical pinned result envelope",
  );
  assert(
    harness.sent[1].type === "storage.set.result" &&
      harness.sent[1].id === "set" && !("error" in harness.sent[1]),
    "STORAGE set returns its correlated canonical result",
  );
  assert(
    harness.sent[2].type === "storage.get.result" &&
      harness.sent[2].id === "get" && harness.sent[2].value === "hello",
    "STORAGE get reads the same verified shared namespace",
  );
});

Deno.test("authority, exact keys, capabilities, and revocation fail closed", async () => {
  const harness = createHarness();
  const authority = context();
  const denied = context({ grantedDomains: Object.freeze(["common"]) });

  await harness.dispatcher.dispatch(denied, {
    type: "storage.get",
    id: "denied",
    key: "secret",
  });
  await harness.dispatcher.dispatch(authority, {
    type: "storage.set",
    id: "structured",
    key: "secret",
    value: { unsafe: true },
  } as never);
  await harness.dispatcher.dispatch(authority, {
    type: "common.encodeNip19",
    id: "ambiguous",
    input: { type: "nsec", hex: accountPubkey },
  } as never);
  harness.replace(context({ manifestEventId: "5".repeat(64) }));
  await harness.dispatcher.dispatch(authority, {
    type: "storage.get",
    id: "stale",
    key: "secret",
  });

  assert(harness.storageCalls() === 0, "denied requests never reach storage");
  assert(harness.sent.length === 4, "every rejection settles once");
  assert(
    harness.sent.every((message) =>
      message.error === "not-authorized" || message.error === "invalid-request"
    ),
    "rejections use stable redacted errors",
  );
  assert(
    harness.sent.every((message) =>
      !JSON.stringify(message).includes(accountPubkey) &&
      !JSON.stringify(message).includes(manifestEventId)
    ),
    "authorization errors disclose no namespace authority",
  );
});

Deno.test("instance authority survives reconnect identity and revokes on expiry", async () => {
  const harness = createHarness();
  const authority = context();
  await harness.dispatcher.dispatch(authority, {
    type: "storage.set",
    id: "set-instance",
    key: "draft",
    value: "retained",
    scope: "instance",
  });

  // Reconnect reuses the exact backend object; no browser field can recreate it.
  await harness.dispatcher.dispatch(authority, {
    type: "storage.get",
    id: "get-reconnected",
    key: "draft",
    scope: "instance",
  });
  harness.dispatcher.abortWindow(authority.windowId);
  await harness.dispatcher.dispatch(authority, {
    type: "storage.get",
    id: "get-expired",
    key: "draft",
    scope: "instance",
  });

  assert(
    harness.sent[1].value === "retained",
    "reconnect retains instance state",
  );
  assert(
    harness.sent[2].error === "not-authorized",
    "expiry revokes authority without exposing stored state",
  );
});

Deno.test("catalog launch binds backend authority before full proxy forwarding", async () => {
  const runtime = createPortalRuntime({ fixture });
  const sent: Record<string, unknown>[] = [];
  const values = new Map<string, string>();
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
    storage: {
      get: (namespace, key) => values.get(`${namespace}:${key}`) ?? null,
      set: (namespace, key, value) => {
        values.set(`${namespace}:${key}`, value);
      },
      remove: (namespace, key) => {
        values.delete(`${namespace}:${key}`);
      },
      keys: () => [],
    },
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
          manifestEventId,
          title: "Tracer",
          version: "1",
          capabilities: ["common.encodeNip19", "storage"],
          launch: {
            dTag: "tracer",
            aggregateHash: "4".repeat(64),
            srcdoc: "<main>verified</main>",
          },
        },
      }),
  } as never);
  runtime.signIn(accountPubkey);
  const source = {};
  const bridge = runtime.openWindow(
    "connection-a",
    "window-a",
    source,
    (message) => sent.push(message),
  );

  await bridge.dispatchTransfer({
    type: "storage.get",
    id: "before",
    key: "key",
  });
  await bridge.catalogCommand({
    type: "catalog.launch",
    id: "launch",
    catalogEventId: "catalog",
    coordinate: context().coordinate,
    manifestEventId,
  });
  await bridge.dispatchTransfer({
    type: "storage.set",
    id: "set",
    key: "key",
    value: "value",
  });
  await bridge.dispatchTransfer({
    type: "storage.get",
    id: "after",
    key: "key",
  });

  assert(sent[0].error === "not-authorized", "unbound forwarding fails closed");
  assert(sent[1].type === "storage.set.result", "verified launch enables set");
  assert(sent[2].value === "value", "verified launch enables correlated get");
  runtime.destroyWindow("window-a");
  await bridge.dispatchTransfer({
    type: "storage.get",
    id: "expired",
    key: "key",
  });
  assert(sent.length === 3, "expired windows cannot emit or dispatch results");
  runtime.destroy();
});
