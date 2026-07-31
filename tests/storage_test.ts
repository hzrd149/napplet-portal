import {
  type NappletStorageSnapshot,
  NappletStorageStore,
} from "../runtime/storage_store.ts";
import { StorageService } from "../runtime/storage.ts";
import {
  NapDispatcher,
  type WindowCapabilityContext,
} from "../runtime/nap_dispatcher.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function tempPath(): Promise<{ directory: string; path: string }> {
  const directory = await Deno.makeTempDir();
  return { directory, path: `${directory}/storage.json` };
}

const identity = Object.freeze({
  accountPubkey: "1".repeat(64),
  coordinate: `35129:${"2".repeat(64)}:example`,
  manifestEventId: "3".repeat(64),
  dTag: "example",
  aggregateHash: "4".repeat(64),
  scope: "shared" as const,
  instanceId: "",
});

Deno.test("missing snapshot initializes empty and canonical snapshot survives restart", async () => {
  const temporary = await tempPath();
  try {
    const store = new NappletStorageStore(temporary.path);
    assert((await store.read()).version === 1, "missing snapshot is version 1");
    const service = await StorageService.open(store);
    await service.set(
      { ...identity, scope: "instance", instanceId: "b" },
      "z",
      "last",
    );
    await service.set(identity, "b", "two");
    await service.set(identity, "a", "one");
    assert(JSON.stringify(service.keys(identity)) === '["a","b"]', "keys sort");
    const text = await Deno.readTextFile(temporary.path);
    const namespaceKeys = Object.keys(JSON.parse(text).namespaces);
    assert(
      JSON.stringify(namespaceKeys) ===
        JSON.stringify([...namespaceKeys].sort()),
      "namespaces serialize canonically",
    );
    const restarted = await StorageService.open(
      new NappletStorageStore(temporary.path),
    );
    assert(restarted.get(identity, "a") === "one", "shared value reloads");
    assert(
      restarted.get(
        { ...identity, scope: "instance", instanceId: "b" },
        "z",
      ) === "last",
      "instance value reloads",
    );
    assert(
      JSON.stringify(restarted.keys(identity)) === '["a","b"]',
      "restart key order is stable",
    );
  } finally {
    await Deno.remove(temporary.directory, { recursive: true });
  }
});

Deno.test("malformed snapshot fails closed and is not overwritten by mutation", async () => {
  const invalidDocuments = [
    '{"version":2,"namespaces":{}}',
    '{"version":1,"namespaces":{},"extra":true}',
    '{"version":1,"namespaces":[]}',
    '{"version":1,"namespaces":{"__proto__":{"key":"value"}}}',
    '{"version":1,"namespaces":{"name":{"key":3}}}',
  ];
  for (const document of invalidDocuments) {
    const temporary = await tempPath();
    try {
      await Deno.writeTextFile(temporary.path, document);
      let rejected = false;
      try {
        await StorageService.open(new NappletStorageStore(temporary.path));
      } catch {
        rejected = true;
      }
      assert(rejected, "malformed snapshot rejects startup");
      assert(
        await Deno.readTextFile(temporary.path) === document,
        "malformed evidence remains unchanged",
      );
    } finally {
      await Deno.remove(temporary.directory, { recursive: true });
    }
  }
});

Deno.test("concurrent cross-namespace mutations use one global snapshot tail", async () => {
  const temporary = await tempPath();
  try {
    const service = await StorageService.open(
      new NappletStorageStore(temporary.path),
    );
    await Promise.all(Array.from({ length: 40 }, (_, index) =>
      service.set(
        { ...identity, accountPubkey: String(index % 2).repeat(64) },
        `key-${index}`,
        `value-${index}`,
      )));
    const restarted = await StorageService.open(
      new NappletStorageStore(temporary.path),
    );
    assert(
      restarted.keys({ ...identity, accountPubkey: "0".repeat(64) }).length ===
        20,
      "first namespace retained",
    );
    assert(restarted.keys(identity).length === 20, "second namespace retained");
  } finally {
    await Deno.remove(temporary.directory, { recursive: true });
  }
});

Deno.test("write failure preserves committed memory and disk and queue recovers", async () => {
  const temporary = await tempPath();
  try {
    let fail = false;
    const store = new NappletStorageStore(temporary.path, {
      beforeRename: () => {
        if (fail) throw new Error("injected rename failure");
      },
    });
    const service = await StorageService.open(store);
    await service.set(identity, "stable", "before");
    const committed: NappletStorageSnapshot = await store.read();
    fail = true;
    let rejected = false;
    try {
      await service.set(identity, "unstable", "lost");
    } catch {
      rejected = true;
    }
    assert(rejected, "injected write failure rejects");
    assert(
      service.get(identity, "unstable") === null,
      "memory does not publish failed write",
    );
    assert(
      JSON.stringify(await store.read()) === JSON.stringify(committed),
      "disk remains committed",
    );
    fail = false;
    await service.set(identity, "recovered", "after");
    assert(
      service.get(identity, "recovered") === "after",
      "queue accepts later work",
    );
  } finally {
    await Deno.remove(temporary.directory, { recursive: true });
  }
});

Deno.test("UTF-8 quota boundaries preserve committed state", async () => {
  const temporary = await tempPath();
  try {
    const service = await StorageService.open(
      new NappletStorageStore(temporary.path),
    );
    await service.set(identity, "k".repeat(1024), "😀".repeat(16_384));
    assert(
      service.get(identity, "k".repeat(1024))?.length === 32_768,
      "exact byte boundaries pass",
    );
    for (
      const [key, value] of [
        ["k".repeat(1025), "value"],
        ["other", `${"😀".repeat(16_384)}x`],
      ]
    ) {
      let quota = false;
      try {
        await service.set(identity, key, value);
      } catch (error) {
        quota = error instanceof Error && error.message === "quota-exceeded";
      }
      assert(quota, "plus-one UTF-8 byte is rejected");
    }
    assert(
      service.keys(identity).length === 1,
      "failed quota writes preserve state",
    );
  } finally {
    await Deno.remove(temporary.directory, { recursive: true });
  }
});

Deno.test("namespace key-count and aggregate quotas are enforced prospectively", async () => {
  const temporary = await tempPath();
  try {
    const service = await StorageService.open(
      new NappletStorageStore(temporary.path),
    );
    await Promise.all(
      Array.from(
        { length: 256 },
        (_, index) => service.set(identity, `k${index}`, ""),
      ),
    );
    let keyQuota = false;
    try {
      await service.set(identity, "overflow", "");
    } catch (error) {
      keyQuota = error instanceof Error && error.message === "quota-exceeded";
    }
    assert(keyQuota, "257th namespace key rejects");

    const aggregateIdentity = { ...identity, manifestEventId: "8".repeat(64) };
    for (let index = 0; index < 8; index++) {
      await service.set(
        {
          ...aggregateIdentity,
          scope: "instance",
          instanceId: `instance-${index}`,
        },
        "payload",
        "x".repeat(65_536),
      );
    }
    let aggregateQuota = false;
    try {
      await service.set(aggregateIdentity, "extra", "x");
    } catch (error) {
      aggregateQuota = error instanceof Error &&
        error.message === "quota-exceeded";
    }
    assert(aggregateQuota, "shared plus instances use one aggregate budget");
  } finally {
    await Deno.remove(temporary.directory, { recursive: true });
  }
});

Deno.test("dispatcher supports exact get set remove keys and redacted failures", async () => {
  const temporary = await tempPath();
  try {
    const storage = await StorageService.open(
      new NappletStorageStore(temporary.path),
    );
    const sent: Record<string, unknown>[] = [];
    const authority: WindowCapabilityContext = Object.freeze({
      connectionId: "connection",
      windowId: "window",
      accountPubkey: identity.accountPubkey,
      coordinate: identity.coordinate,
      manifestEventId: identity.manifestEventId,
      dTag: identity.dTag,
      aggregateHash: identity.aggregateHash,
      grantedDomains: Object.freeze(["storage"]),
      instanceId: "instance",
    });
    let current = true;
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
      storage,
      isCurrent: (candidate) => current && candidate === authority,
      send: (_owner, message) => sent.push(message),
    });
    await dispatcher.dispatch(authority, {
      type: "storage.set",
      id: "set",
      key: "b",
      value: "2",
    });
    await dispatcher.dispatch(authority, {
      type: "storage.set",
      id: "set2",
      key: "a",
      value: "1",
      scope: "shared",
    });
    await dispatcher.dispatch(authority, { type: "storage.keys", id: "keys" });
    await dispatcher.dispatch(authority, {
      type: "storage.remove",
      id: "remove",
      key: "a",
    });
    await dispatcher.dispatch(authority, {
      type: "storage.get",
      id: "missing",
      key: "a",
    });
    await dispatcher.dispatch(
      authority,
      { type: "storage.keys", id: "bad", scope: "other" } as never,
    );
    current = false;
    await dispatcher.dispatch(authority, {
      type: "storage.get",
      id: "revoked",
      key: "b",
    });
    assert(
      JSON.stringify(sent[2].keys) === '["a","b"]',
      "dispatcher keys sort",
    );
    assert(sent[4].value === null, "missing get is null");
    assert(sent[5].error === "invalid-request", "invented scope rejects");
    assert(
      sent[6].error === "not-authorized",
      "revocation denies without deletion",
    );
  } finally {
    await Deno.remove(temporary.directory, { recursive: true });
  }
});
