import { finalizeEvent, getPublicKey } from "nostr-tools";
import { Subject } from "npm:rxjs@7.8.2";
import { CommonService } from "../runtime/common.ts";
import { EventRuntime } from "../runtime/event_runtime.ts";
import {
  NapDispatcher,
  type WindowCapabilityContext,
} from "../runtime/nap_dispatcher.ts";
import { StorageService } from "../runtime/storage.ts";
import { NappletStorageStore } from "../runtime/storage_store.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const account = "1".repeat(64);
const authority: WindowCapabilityContext = Object.freeze({
  connectionId: "connection",
  windowId: "window",
  accountPubkey: account,
  coordinate: `35129:${"2".repeat(64)}:example`,
  manifestEventId: "3".repeat(64),
  dTag: "example",
  aggregateHash: "4".repeat(64),
  grantedDomains: Object.freeze(["storage"]),
  grantedCapabilities: Object.freeze(["storage"]),
  generation: 1,
  instanceId: "instance-a",
});

function dispatcherFor(
  storage: ConstructorParameters<typeof NapDispatcher>[0]["storage"],
  sent: Record<string, unknown>[],
  isCurrent: (candidate: WindowCapabilityContext) => boolean,
): NapDispatcher {
  return new NapDispatcher({
    resource: {
      bytes: () => Promise.reject(new Error("unused")),
      bytesMany: () => Promise.resolve([]),
    },
    transfer: {
      upload: () => Promise.reject(new Error("unused")),
      status: () => undefined,
    },
    settings: () => ({ blossomServers: [] }),
    storage,
    isCurrent,
    send: (_owner, message) => sent.push(message),
  });
}

Deno.test("state isolation tracer rejects a stale queued mutation before state effect", async () => {
  const directory = await Deno.makeTempDir();
  try {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => release = resolve);
    let writes = 0;
    const service = await StorageService.open(
      new NappletStorageStore(`${directory}/storage.json`, {
        beforeRename: async () => {
          writes++;
          if (writes === 1) await blocked;
        },
      }),
    );
    const sent: Record<string, unknown>[] = [];
    let current = true;
    const dispatcher = dispatcherFor(
      service,
      sent,
      (candidate) => current && candidate === authority,
    );
    const first = dispatcher.dispatch(authority, {
      type: "storage.set",
      id: "first",
      key: "stable",
      value: "one",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const stale = dispatcher.dispatch(authority, {
      type: "storage.set",
      id: "stale",
      key: "foreign",
      value: "must-not-commit",
      scope: "instance",
    });
    current = false;
    release();
    await Promise.all([first, stale]);

    current = true;
    await dispatcher.dispatch(authority, {
      type: "storage.get",
      id: "probe",
      key: "foreign",
      scope: "instance",
    });
    assert(
      sent.at(-1)?.value === null,
      "generation replacement makes a queued mutation inert",
    );
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("state isolation tracer returns partial COMMON truth and retires its generation", async () => {
  const upstream = new Subject<ReturnType<typeof finalizeEvent>>();
  const runtime = new EventRuntime({ request: () => upstream });
  const pubkey = getPublicKey(new Uint8Array(32).fill(7));
  const common = new CommonService({
    eventRuntime: runtime,
    identity: () => ({ accountId: account, pubkey, status: "active" }),
    relays: () => ["wss://relay.example/"],
  });
  const first = await common.execute({
    type: "common.getProfile",
    id: "partial",
    target: pubkey,
  }, "window");
  assert(
    first.ok && first.profile === null,
    "empty partial truth is immediate",
  );

  common.cancel("window");
  upstream.next(finalizeEvent({
    kind: 0,
    created_at: 1,
    content: JSON.stringify({ name: "stale" }),
    tags: [],
  }, new Uint8Array(32).fill(7)));
  const after = await common.execute({
    type: "common.getProfile",
    id: "replacement",
    target: pubkey,
  }, "replacement-window");
  assert(
    after.profile === null,
    "retired generation cannot update shared truth",
  );
  common.destroy();
  runtime.destroy();
});

Deno.test("state isolation matrix revocation during persistence cannot commit", async () => {
  const directory = await Deno.makeTempDir();
  try {
    let block = false;
    let entered!: () => void;
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => entered = resolve);
    const resume = new Promise<void>((resolve) => release = resolve);
    const store = new NappletStorageStore(`${directory}/storage.json`, {
      beforeRename: async () => {
        if (!block) return;
        entered();
        await resume;
      },
    });
    const service = await StorageService.open(store);
    const sent: Record<string, unknown>[] = [];
    let current = true;
    const dispatcher = dispatcherFor(
      service,
      sent,
      (candidate) => current && candidate === authority,
    );
    await dispatcher.dispatch(authority, {
      type: "storage.set",
      id: "baseline",
      key: "stable",
      value: "before",
    });
    block = true;
    const mutation = dispatcher.dispatch(authority, {
      type: "storage.set",
      id: "racing",
      key: "racing",
      value: "must-not-commit",
    });
    await blocked;
    current = false;
    release();
    await mutation;

    const restarted = await StorageService.open(store);
    assert(
      restarted.get({
        accountPubkey: authority.accountPubkey,
        coordinate: authority.coordinate,
        manifestEventId: authority.manifestEventId,
        dTag: authority.dTag,
        aggregateHash: authority.aggregateHash,
        scope: "shared",
        instanceId: "",
      }, "racing") === null,
      "stale write never crosses the atomic rename boundary",
    );
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("state isolation matrix closes account artifact scope and instance namespaces", async () => {
  const directory = await Deno.makeTempDir();
  try {
    const service = await StorageService.open(
      new NappletStorageStore(`${directory}/storage.json`),
    );
    const base = {
      accountPubkey: authority.accountPubkey,
      coordinate: authority.coordinate,
      manifestEventId: authority.manifestEventId,
      dTag: authority.dTag,
      aggregateHash: authority.aggregateHash,
      scope: "shared" as const,
      instanceId: "",
    };
    const namespaces = [
      base,
      { ...base, accountPubkey: "9".repeat(64) },
      { ...base, manifestEventId: "8".repeat(64) },
      { ...base, aggregateHash: "7".repeat(64) },
      { ...base, scope: "instance" as const, instanceId: "instance-a" },
      { ...base, scope: "instance" as const, instanceId: "instance-b" },
    ];
    await Promise.all(
      namespaces.map((namespace, index) =>
        service.set(namespace, "same-key", `value-${index}`)
      ),
    );
    namespaces.forEach((namespace, index) => {
      assert(
        service.get(namespace, "same-key") === `value-${index}`,
        `namespace ${index} retains only its exact value`,
      );
      assert(service.keys(namespace).length === 1, "no neighboring disclosure");
    });
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("state isolation matrix malformed and foreign dispatcher claims are inert", async () => {
  let calls = 0;
  const sent: Record<string, unknown>[] = [];
  const dispatcher = dispatcherFor(
    {
      get: () => {
        calls++;
        return "secret";
      },
      set: () => {
        calls++;
      },
      remove: () => {
        calls++;
      },
      keys: () => {
        calls++;
        return ["secret"];
      },
    },
    sent,
    (candidate) => candidate === authority,
  );
  const foreign = Object.freeze({
    ...authority,
    accountPubkey: "f".repeat(64),
  });
  await dispatcher.dispatch(foreign, {
    type: "storage.get",
    id: "foreign",
    key: "secret",
  });
  await dispatcher.dispatch(authority, {
    type: "storage.keys",
    id: "malformed",
    scope: "foreign",
  } as never);
  assert(calls === 0, "denied claims never reach a state service");
  assert(
    sent[0].error === "not-authorized" && sent[0].value === null &&
      sent[1].error === "invalid-request" && !("keys" in sent[1]),
    "denials are sanitized without namespace evidence",
  );
});
