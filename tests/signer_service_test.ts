import {
  type SignerAccountsPort,
  SignerConnectionService,
} from "../runtime/signer_service.ts";

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

Deno.test("signer service replays URI before approval and survives projection cleanup", async () => {
  const approval = deferred<{
    accountId: string;
    pubkey: string;
    status: "active";
  }>();
  const uri =
    "nostrconnect://client?relay=wss%3A%2F%2Fbucket.coracle.social%2F";
  const accounts: SignerAccountsPort = {
    startNostrConnect: () =>
      Promise.resolve({
        uri,
        connected: approval.promise,
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

Deno.test("runtime endpoint only dispatches and projects signer service state", async () => {
  const endpoint = await Deno.readTextFile("routes/api/runtime.ts");
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
    "endpoint must project state",
  );
  assert(endpoint.includes("signer.start()"), "endpoint must dispatch start");
  assert(
    endpoint.includes('message.type === "runtime.signer.cancel"') &&
      endpoint.includes("signer.cancel()"),
    "endpoint must route explicit cancellation",
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
  const service = new SignerConnectionService({
    startNostrConnect: () => {
      attempts++;
      return Promise.resolve({
        uri: `nostrconnect://attempt-${attempts}`,
        connected: attempts === 1 ? first.promise : second.promise,
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
