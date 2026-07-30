import {
  Accounts,
  type IAccount,
  type SerializedAccount,
} from "applesauce-accounts";
import { AccountStore } from "../runtime/account_store.ts";
import {
  type PortalAccountFactories,
  PortalAccounts,
} from "../runtime/accounts.ts";
import { EMPTY } from "npm:rxjs@7.8.2";

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => resolve = accept);
  return { promise, resolve };
}

const nip46Serialized: SerializedAccount = {
  id: "connect-account",
  type: "nostr-connect",
  pubkey: "a".repeat(64),
  signer: {
    clientKey: "1".repeat(64),
    remote: "a".repeat(64),
    relays: ["wss://relay.example/"],
    bunkerSecret: "sensitive-bunker-secret",
  },
};

function nip46Account(): IAccount {
  return Accounts.NostrConnectAccount.fromJSON(nip46Serialized);
}

async function withPortal(
  run: (portal: PortalAccounts, path: string) => Promise<void>,
  factories: Partial<PortalAccountFactories> = {},
): Promise<void> {
  const directory = await Deno.makeTempDir();
  try {
    const path = `${directory}/accounts.json`;
    const portal = new PortalAccounts(new AccountStore(path), {
      relays: ["wss://relay.example/"],
      subscriptionMethod: () => EMPTY,
      publishMethod: () => Promise.resolve(),
      ...factories,
    });
    await portal.restore();
    await run(portal, path);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
}

Deno.test("Nostr Connect leads with URI then activates and broadcasts globally", async () => {
  const connected = deferred<IAccount>();
  await withPortal(async (portal, path) => {
    const tabOne: string[] = [];
    const tabTwo: string[] = [];
    portal.identity$.subscribe((identity) => tabOne.push(identity.status));
    portal.identity$.subscribe((identity) => tabTwo.push(identity.status));

    const pending = await portal.startNostrConnect();
    assert(
      pending.uri.startsWith("nostrconnect://"),
      "primary flow should return copy/QR URI",
    );
    assertEquals(
      portal.identity.status,
      "unavailable",
      "URI creation must not activate an unconnected remote signer",
    );
    connected.resolve(nip46Account());
    const identity = await pending.connected;

    assertEquals(identity, {
      accountId: "connect-account",
      pubkey: "a".repeat(64),
      status: "active",
    }, "connected identity should be browser-safe");
    assertEquals(
      tabOne.at(-1),
      "active",
      "first tab should receive global update",
    );
    assertEquals(
      tabTwo.at(-1),
      "active",
      "second tab should receive global update",
    );
    const persisted = JSON.parse(await Deno.readTextFile(path));
    assertEquals(
      persisted.activeAccountId,
      "connect-account",
      "active selection should persist",
    );
    assert(
      persisted.accounts[0].signer.clientKey,
      "complete NIP-46 client state should persist",
    );
  }, {
    createNostrConnect: () => ({
      uri: "nostrconnect://client?relay=wss%3A%2F%2Frelay.example",
      connected: connected.promise,
    }),
  });
});

Deno.test("Nostr Connect uses Applesauce pool API with signer-owned relays", async () => {
  const source = await Deno.readTextFile("runtime/accounts.ts");
  assert(
    source.includes("pool: this.#factories.pool"),
    "signer must receive the Applesauce RelayPool API",
  );
  assert(
    !source.includes("NostrConnectSigner.subscriptionMethod ="),
    "singleton signer must not mutate global connection methods",
  );
  assert(
    source.includes("await signer.waitForSigner("),
    "account activation must wait for Applesauce remote signer resolution",
  );
});

Deno.test("bunker and Not recommended nsec paths run server-side and newest wins", async () => {
  await withPortal(async (portal) => {
    const bunker = await portal.signInBunker("bunker://redacted");
    assertEquals(bunker.accountId, "connect-account", "bunker should activate");

    const nsec = await portal.signInNsec("1".repeat(64));
    assert(
      nsec.accountId !== bunker.accountId,
      "nsec should add a distinct account",
    );
    assertEquals(
      portal.identity.pubkey,
      nsec.pubkey,
      "newest successful login should win",
    );
    assert(
      !JSON.stringify(portal.identity).includes("1".repeat(64)),
      "projection must exclude private key",
    );
    assert(
      !JSON.stringify(portal.identity).includes("bunker"),
      "projection must exclude bunker data",
    );
  }, { connectBunker: () => Promise.resolve(nip46Account()) });
});

Deno.test("restored unavailable NIP-46 remains active offline and retries", async () => {
  const directory = await Deno.makeTempDir();
  try {
    const path = `${directory}/accounts.json`;
    const store = new AccountStore(path);
    await store.write({
      version: 1,
      activeAccountId: "connect-account",
      accounts: [nip46Serialized as Record<string, unknown>],
    });
    let retries = 0;
    const portal = new PortalAccounts(store, {
      relays: ["wss://relay.example/"],
      subscriptionMethod: () => EMPTY,
      publishMethod: () => Promise.resolve(),
      reconnectNostrConnect: () => {
        retries++;
        return Promise.reject(new Error("offline"));
      },
    });
    await portal.restore();

    assertEquals(
      portal.identity.status,
      "offline",
      "restored signer should remain active/offline",
    );
    assertEquals(
      portal.identity.pubkey,
      "a".repeat(64),
      "public reads retain active pubkey",
    );
    await portal.retryOffline();
    assertEquals(retries, 1, "offline signer should retry without deletion");
    assertEquals(portal.accountCount, 1, "retry failure must retain account");
    await portal.signEvent({
      kind: 1,
      content: "blocked",
      tags: [],
      created_at: 1,
    })
      .then(
        () => {
          throw new Error("offline signing should reject");
        },
        (error) =>
          assert(
            String(error).includes("unavailable"),
            "sign error should be safe",
          ),
      );
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("sign-out broadcasts unavailable and rejects signing without stopping public reads", async () => {
  await withPortal(async (portal) => {
    await portal.signInNsec("2".repeat(64));
    const statuses: string[] = [];
    portal.identity$.subscribe((identity) => statuses.push(identity.status));
    await portal.signOut();

    assertEquals(
      statuses.at(-1),
      "unavailable",
      "all consumers should see unavailable",
    );
    assertEquals(
      portal.publicReadsEnabled,
      true,
      "public runtime reads should continue",
    );
    await portal.signEvent({
      kind: 1,
      content: "blocked",
      tags: [],
      created_at: 1,
    })
      .then(
        () => {
          throw new Error("signed-out signing should reject");
        },
        (error) =>
          assert(
            String(error).includes("unavailable"),
            "sign error should be safe",
          ),
      );
  });
});

Deno.test("browser-facing identity structures never contain signer material", async () => {
  const source = await Deno.readTextFile(
    new URL("../runtime/transport.ts", import.meta.url),
  );
  assert(
    !/applesauce-(accounts|signers)|PrivateKey|NostrConnectSigner/.test(source),
    "transport imports no authority-bearing account code",
  );
});
