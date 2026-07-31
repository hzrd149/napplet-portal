import {
  type SignerAccountsPort,
  SignerConnectionService,
} from "../runtime/signer_service.ts";
import type { IdentitySnapshot } from "../runtime/accounts.ts";
import { BehaviorSubject } from "npm:rxjs@7.8.2";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => resolve = accept);
  return { promise, resolve };
}

async function eventually(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error("state did not settle");
}

const UNAVAILABLE: IdentitySnapshot = Object.freeze({
  accountId: null,
  pubkey: null,
  status: "unavailable",
});

function identitySubject() {
  return new BehaviorSubject<IdentitySnapshot>(UNAVAILABLE);
}

Deno.test("signer service replays URI before approval and survives projection cleanup", async () => {
  const approval = deferred<{
    accountId: string;
    pubkey: string;
    status: "active";
  }>();
  const uri =
    "nostrconnect://client?relay=wss%3A%2F%2Fbucket.coracle.social%2F";
  const accounts: SignerAccountsPort = {
    identity$: identitySubject(),
    startNostrConnect: () =>
      Promise.resolve({
        uri,
        connected: approval.promise.then((identity) => {
          accounts.identity$.next(identity);
          return identity;
        }),
      }),
  };
  const service = new SignerConnectionService(accounts, { timeoutMs: 5_000 });

  service.start();
  await eventually(() => service.state.status === "awaiting");
  assert(service.state.status === "awaiting", "service must expose awaiting");
  assert(service.state.uri === uri, "URI must replay before approval");

  const projected: string[] = [];
  const projection = service.state$.subscribe((state) => {
    projected.push(state.status);
  });
  assert(
    projected[0] === "awaiting",
    "late endpoint must receive current URI state",
  );
  projection.unsubscribe();

  approval.resolve({
    accountId: "remote",
    pubkey: "a".repeat(64),
    status: "active",
  });
  const currentStatus = () => service.state$.value.status;
  await eventually(() => currentStatus() === "active");
  assert(
    currentStatus() === "active",
    "endpoint cleanup must not cancel signer",
  );
});

Deno.test("sign-in endpoint dispatches and projects signer service state", async () => {
  const endpoint = await Deno.readTextFile("routes/api/signin/connect.ts");
  const runtimeEndpoint = await Deno.readTextFile("routes/api/runtime.ts");
  const statusEndpoint = await Deno.readTextFile("routes/api/signin/status.ts");
  const bunkerEndpoint = await Deno.readTextFile("routes/api/signin/bunker.ts");
  const nsecEndpoint = await Deno.readTextFile("routes/api/signin/nsec.ts");
  const accountsRuntime = await Deno.readTextFile("runtime/accounts.ts");
  for (
    const forbidden of [
      "RelayPool",
      "AccountStore",
      "PortalAccounts",
      "waitForSigner",
    ]
  ) {
    assert(!endpoint.includes(forbidden), `endpoint must not own ${forbidden}`);
  }
  assert(
    endpoint.includes("signer.state$.subscribe"),
    "sign-in endpoint must project state",
  );
  assert(endpoint.includes("signer.start()"), "endpoint must dispatch start");
  assert(
    !runtimeEndpoint.includes("signer.start()"),
    "runtime endpoint must not start sign-in",
  );
  assert(
    runtimeEndpoint.includes(
      "Configured napplet is not available in this tracer",
    ) &&
      runtimeEndpoint.indexOf('message.type === "runtime.start"') <
        runtimeEndpoint.indexOf("const decoded = decodeClientMessage"),
    "endpoint must reject unsupported runtime.start before NAP decoding",
  );
  assert(
    runtimeEndpoint.indexOf("await signer.restore()") <
      runtimeEndpoint.indexOf("const signerState = signer.state"),
    "runtime start must restore persisted accounts before auth check",
  );
  assert(
    statusEndpoint.includes("await ctx.state.signer.restore()"),
    "status endpoint must restore persisted accounts before projection",
  );
  assert(
    statusEndpoint.includes('identity?.status === "offline"'),
    "status endpoint must expose restored offline signer identity",
  );
  assert(
    accountsRuntime.includes("this.#manager.active$.subscribe"),
    "portal identity must derive from Applesauce active$",
  );
  assert(
    endpoint.includes('message.type === "signer.cancel"') &&
      endpoint.includes("signer.cancel()"),
    "endpoint must route explicit cancellation",
  );
  assert(
    bunkerEndpoint.includes("signInBunker") &&
      !bunkerEndpoint.includes("ctx.upgrade()"),
    "bunker sign-in must be an HTTP submission flow",
  );
  assert(
    nsecEndpoint.includes("signInNsec") &&
      !nsecEndpoint.includes("ctx.upgrade()"),
    "nsec sign-in must be an HTTP submission flow",
  );
});

Deno.test("cancel clears state and blocks late activation before a fresh attempt", async () => {
  const first = deferred<{
    accountId: string;
    pubkey: string;
    status: "active";
  }>();
  const second = deferred<{
    accountId: string;
    pubkey: string;
    status: "active";
  }>();
  let attempts = 0;
  const identity$ = identitySubject();
  const service = new SignerConnectionService({
    identity$,
    startNostrConnect: () => {
      attempts++;
      const attempt = attempts;
      return Promise.resolve({
        uri: `nostrconnect://attempt-${attempt}`,
        connected: (attempt === 1 ? first.promise : second.promise).then(
          (identity) => {
            if (attempt === 2) identity$.next(identity);
            return identity;
          },
        ),
      });
    },
  });

  service.start();
  await eventually(() => service.state.status === "awaiting");
  service.cancel();
  assert(
    service.state.status === "idle",
    "cancel must clear replayed URI state",
  );
  first.resolve({ accountId: "old", pubkey: "a".repeat(64), status: "active" });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert(service.state.status === "idle", "cancelled approval must be ignored");

  service.start();
  await eventually(() =>
    service.state.status === "awaiting" &&
    service.state.uri === "nostrconnect://attempt-2"
  );
  assert(attempts === 2, "restart must create a fresh attempt");
  second.resolve({
    accountId: "new",
    pubkey: "b".repeat(64),
    status: "active",
  });
  await eventually(() => service.state.status === "active");
});

Deno.test("restored offline account does not project active sign-in", async () => {
  let restores = 0;
  let signedOut = false;
  const identity$ = identitySubject();
  const service = new SignerConnectionService({
    identity$,
    restore: () => {
      restores++;
      if (signedOut) {
        identity$.next(UNAVAILABLE);
        return Promise.resolve(UNAVAILABLE);
      }
      const restored = {
        accountId: "saved",
        pubkey: "c".repeat(64),
        status: "offline",
      } satisfies IdentitySnapshot;
      identity$.next(restored);
      return Promise.resolve(restored);
    },
    startNostrConnect: () =>
      Promise.resolve({
        uri: "nostrconnect://unused",
        connected: Promise.reject(new Error("unused")),
      }),
    signOut: () => {
      signedOut = true;
      identity$.next({
        accountId: null,
        pubkey: null,
        status: "unavailable",
      });
      return Promise.resolve();
    },
  });

  await service.restore();
  await service.restore();

  assert(restores === 1, "restore must share the startup account load");
  assert(
    service.state.status === "idle",
    "offline restoration must not emit signer.active or pass runtime gates",
  );

  await service.signOut();
  await service.restore();
  const restoreCount = () => restores;
  const currentStatus = () => service.state.status;
  assert(restoreCount() === 2, "sign-out must invalidate cached restoration");
  assert(
    currentStatus() === "idle",
    "signed-out status must not rehydrate stale restored account",
  );
});
