import {
  type NappletStorageSnapshot,
  NappletStorageStore,
} from "../runtime/storage_store.ts";
import { StorageService } from "../runtime/storage.ts";

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
