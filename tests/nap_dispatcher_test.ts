import { NapDispatcher, type NapOwner } from "../runtime/nap_dispatcher.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const owner: NapOwner = {
  connectionId: "connection-a",
  windowId: "window-a",
  napplet: "35129:pubkey:example@aggregate",
  account: "account-a",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => resolve = done);
  return { promise, resolve };
}

Deno.test("dispatcher cancel and window expiry abort exact owned resource work", async () => {
  const pending = deferred<{ bytes: Uint8Array; blob: Blob; mime: string }>();
  const signals: AbortSignal[] = [];
  const sent: unknown[] = [];
  const dispatcher = new NapDispatcher({
    resource: {
      bytes: (_url, options) => {
        signals.push(
          options instanceof AbortSignal ? options : options!.signal!,
        );
        return pending.promise;
      },
      bytesMany: () => Promise.resolve([]),
    },
    transfer: {
      upload: () => Promise.reject(new Error("unused")),
      status: () => undefined,
      clearOwner: () => undefined,
    },
    settings: () => ({ blossomServers: ["https://one.example/"] }),
    send: (_owner, message) => sent.push(message),
  });

  const first = dispatcher.dispatch(owner, {
    type: "resource.bytes",
    id: "first",
    url: "https://example.com/a.png",
  });
  await Promise.resolve();
  dispatcher.dispatch(owner, { type: "resource.cancel", id: "first" });
  assert(signals[0]?.aborted, "explicit cancel aborts matching operation");

  const second = dispatcher.dispatch(owner, {
    type: "resource.bytes",
    id: "second",
    url: "https://example.com/b.png",
  });
  await Promise.resolve();
  dispatcher.abortWindow(owner.windowId);
  assert(signals[1]?.aborted, "window expiry aborts owned operation");
  pending.resolve({
    bytes: new Uint8Array([1]),
    blob: new Blob([new Uint8Array([1])]),
    mime: "image/png",
  });
  await Promise.all([first, second]);
  assert(sent.length === 0, "cancelled late completions are suppressed");
});

Deno.test("dispatcher rejects duplicate IDs and a third byte operation before work", async () => {
  const pending: Array<
    ReturnType<typeof deferred<{ bytes: Uint8Array; blob: Blob; mime: string }>>
  > = [];
  let starts = 0;
  const sent: Array<Record<string, unknown>> = [];
  const dispatcher = new NapDispatcher({
    resource: {
      bytes: () => {
        starts++;
        const next = deferred<
          { bytes: Uint8Array; blob: Blob; mime: string }
        >();
        pending.push(next);
        return next.promise;
      },
      bytesMany: () => Promise.resolve([]),
    },
    transfer: {
      upload: () => Promise.reject(new Error("unused")),
      status: () => undefined,
      clearOwner: () => undefined,
    },
    settings: () => ({ blossomServers: [] }),
    send: (_owner, message) => sent.push(message),
  });
  const a = dispatcher.dispatch(owner, {
    type: "resource.bytes",
    id: "a",
    url: "https://example.com/a",
  });
  await Promise.resolve();
  await dispatcher.dispatch(owner, {
    type: "resource.bytes",
    id: "a",
    url: "https://example.com/a",
  });
  const b = dispatcher.dispatch(owner, {
    type: "resource.bytes",
    id: "b",
    url: "https://example.com/b",
  });
  await Promise.resolve();
  await dispatcher.dispatch(owner, {
    type: "resource.bytes",
    id: "c",
    url: "https://example.com/c",
  });
  assert(starts === 2, "duplicate and third request never start service work");
  assert(
    sent.filter((message) => message.error === "quota-exceeded").length === 2,
    "both rejections are canonical quota errors",
  );
  dispatcher.destroy();
  assert(
    pending.every(({ promise: _promise }, index) => index < 2),
    "pending operations retained for cleanup",
  );
  pending.forEach(({ resolve }) =>
    resolve({ bytes: new Uint8Array(), blob: new Blob(), mime: "text/plain" })
  );
  await Promise.all([a, b]);
});

Deno.test("dispatcher exposes closed actions, snapshots settings, and scopes upload status", async () => {
  let settings = { blossomServers: ["https://first.example/"] };
  const observedServers: string[][] = [];
  const statuses = new Map<string, Record<string, unknown>>();
  const sent: Array<{ owner: NapOwner; message: Record<string, unknown> }> = [];
  const dispatcher = new NapDispatcher({
    resource: {
      bytes: () =>
        Promise.resolve({
          bytes: new Uint8Array([1]),
          blob: new Blob([new Uint8Array([1])]),
          mime: "image/png",
        }),
      bytesMany: () => Promise.resolve([]),
    },
    transfer: {
      upload: (request) => {
        observedServers.push(request.requiredServers.map(String));
        const result = {
          ok: true,
          uploadId: `upload-${observedServers.length}`,
          status: "complete" as const,
          rail: "blossom" as const,
        };
        statuses.set(`${request.owner}:${result.uploadId}`, {
          ...result,
          updatedAt: 1,
        });
        return Promise.resolve(result);
      },
      status: (key, uploadId) => statuses.get(`${key}:${uploadId}`) as never,
      clearOwner: (key) => {
        for (const statusKey of statuses.keys()) {
          if (statusKey.startsWith(`${key}:`)) statuses.delete(statusKey);
        }
      },
    },
    settings: () => settings,
    send: (target, message) => sent.push({ owner: target, message }),
  });
  await dispatcher.dispatch(owner, { type: "resource.info", id: "ri" });
  await dispatcher.dispatch(owner, { type: "upload.info", id: "ui" });
  await dispatcher.dispatch(owner, {
    type: "upload.upload",
    id: "up-1",
    request: { data: new Blob(["first"]), rail: "blossom" },
  });
  settings = { blossomServers: ["https://second.example/"] };
  await dispatcher.dispatch(owner, {
    type: "upload.upload",
    id: "up-2",
    request: { data: new Blob(["second"]), rail: "blossom" },
  });
  await dispatcher.dispatch(owner, {
    type: "upload.status",
    id: "status-own",
    uploadId: "upload-1",
  });
  await dispatcher.dispatch({ ...owner, account: "account-b" }, {
    type: "upload.status",
    id: "status-foreign",
    uploadId: "upload-1",
  });
  assert(
    observedServers[0][0] === "https://first.example/",
    "first operation snapshots first settings",
  );
  assert(
    observedServers[1][0] === "https://second.example/",
    "later operation sees changed settings",
  );
  assert(
    sent.some(({ message }) => message.type === "resource.info.result"),
    "resource info is wired",
  );
  assert(
    sent.some(({ message }) => message.type === "upload.info.result"),
    "upload info is wired",
  );
  const own = sent.find(({ message }) => message.id === "status-own")?.message;
  const foreign = sent.find(({ message }) => message.id === "status-foreign")
    ?.message;
  assert(Boolean(own?.status), "exact owner can inspect retained status");
  assert(
    foreign?.error === "unavailable" && !foreign.status,
    "foreign owner receives generic unavailable",
  );
  assert(
    sent.filter(({ message }) => message.type === "upload.status.changed")
      .every(({ owner: target }) => target.account === "account-a"),
    "status changes push only to owner",
  );
});
