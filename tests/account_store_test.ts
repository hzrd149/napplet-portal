import {
  type AccountSnapshot,
  AccountStore,
} from "../runtime/account_store.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(
  actual: unknown,
  expected: unknown,
  message: string,
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`,
    );
  }
}

const nip46Account = {
  id: "nip46-account",
  type: "nostr-connect",
  pubkey: "a".repeat(64),
  signer: {
    remote: "b".repeat(64),
    clientSecret: "nip46-client-secret",
    relays: ["wss://relay.example/"],
  },
};

const privateKeyAccount = {
  id: "nsec-account",
  type: "private-key",
  pubkey: "c".repeat(64),
  signer: { key: "nsec1sensitivekeymaterial" },
};

function snapshot(activeAccountId: string): AccountSnapshot {
  return {
    version: 1,
    activeAccountId,
    accounts: [nip46Account, privateKeyAccount],
  };
}

Deno.test("account snapshot atomically round-trips complete sensitive signer state", async () => {
  const directory = await Deno.makeTempDir();
  try {
    const path = `${directory}/accounts.json`;
    const store = new AccountStore(path);
    await store.write(snapshot("nip46-account"));

    assertEquals(
      await store.read(),
      snapshot("nip46-account"),
      "snapshot should round-trip",
    );
    const stat = await Deno.stat(path);
    if (Deno.build.os !== "windows") {
      assert(
        (stat.mode! & 0o077) === 0,
        "account snapshot must not be group/world accessible",
      );
    }
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("account writes serialize and leave no temporary sibling", async () => {
  const directory = await Deno.makeTempDir();
  try {
    const path = `${directory}/accounts.json`;
    const store = new AccountStore(path);
    const first = store.write(snapshot("nip46-account"));
    const second = store.write(snapshot("nsec-account"));
    await Promise.all([first, second]);

    assertEquals(
      (await store.read())?.activeAccountId,
      "nsec-account",
      "last queued write wins",
    );
    assertEquals(
      await Array.fromAsync(Deno.readDir(directory)).then((items) =>
        items.map((item) => item.name)
      ),
      ["accounts.json"],
      "temporary file should be renamed",
    );
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("corrupt and unknown snapshots fail without disclosing file content", async () => {
  const directory = await Deno.makeTempDir();
  try {
    const path = `${directory}/accounts.json`;
    const store = new AccountStore(path);
    for (
      const content of ["nsec1must-not-leak", '{"version":99,"accounts":[]}']
    ) {
      await Deno.writeTextFile(path, content);
      try {
        await store.read();
        throw new Error("invalid snapshot should fail");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        assert(
          message === "Account snapshot is invalid",
          "error should be fixed and redacted",
        );
        assert(
          !message.includes(content),
          "error must not include sensitive content",
        );
      }
    }
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("browser transport module has no account store or signer dependency", async () => {
  const transport = await Deno.readTextFile(
    new URL("../runtime/transport.ts", import.meta.url),
  );
  assert(
    !/account_store|signer|nsec|clientSecret/i.test(transport),
    "transport must remain secret-free",
  );
});
