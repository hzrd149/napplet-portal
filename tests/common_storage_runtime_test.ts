import { nip19 } from "nostr-tools";
import {
  NapDispatcher,
  type WindowCapabilityContext,
} from "../runtime/nap_dispatcher.ts";

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
    },
    isCurrent: (candidate) => candidate === current,
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
    input: { type: "npub", data: accountPubkey },
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
    input: { type: "nsec", data: accountPubkey },
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

  assert(harness.sent[1].value === "retained", "reconnect retains instance state");
  assert(
    harness.sent[2].error === "not-authorized",
    "expiry revokes authority without exposing stored state",
  );
});
