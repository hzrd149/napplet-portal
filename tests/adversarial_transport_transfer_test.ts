import {
  ActiveBinaryRequests,
  BinaryFrameKind,
  decodeBinaryFrames,
  encodeBinaryFrame,
  encodeUploadPayload,
  MAX_BINARY_PAYLOAD_BYTES,
} from "../runtime/binary_transport.ts";
import { ResourceDestinationPolicy } from "../runtime/resource_policy.ts";
import {
  ResourceService,
  ResourceServiceError,
} from "../runtime/resource_service.ts";
import {
  decodeClientMessage,
  decodeNapControlMessage,
  TRANSFER_POLICY,
} from "../runtime/transport.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("resource boundary tracer denies private URL and stale ownership without effects", async () => {
  let fetchCalls = 0;
  const service = new ResourceService({
    policy: new ResourceDestinationPolicy({
      resolveDns: (_hostname, recordType) =>
        Promise.resolve(recordType === "A" ? ["169.254.169.254"] : []),
    }),
    fetch: () => {
      fetchCalls++;
      return Promise.resolve(new Response("secret"));
    },
  });

  let projected = "";
  await service.bytes("https://metadata.example/latest/token").then(
    () => {
      throw new Error("private destination must be denied");
    },
    (error) => {
      assert(error instanceof ResourceServiceError, "stable service error");
      projected = `${error.code}:${error.message}`;
    },
  );
  assert(fetchCalls === 0, "denial occurs before network effects");
  assert(
    projected === "blocked-by-policy:resource unavailable",
    "denial projection is stable and sanitized",
  );
  assert(!projected.includes("metadata.example"), "destination is not leaked");
  assert(!projected.includes("token"), "path and secret hints are not leaked");

  const active = new ActiveBinaryRequests(2);
  const current = {
    connectionId: "connection-a",
    windowId: "window-a",
    generation: 2,
  };
  assert(active.open(current, "transfer-a"), "current owner opens transfer");
  assert(
    !active.settle({ ...current, generation: 1 }, "transfer-a"),
    "stale generation cannot settle current transfer",
  );
  assert(
    !active.settle({ ...current, connectionId: "connection-b" }, "transfer-a"),
    "foreign connection cannot settle current transfer",
  );
  assert(active.settle(current, "transfer-a"), "exact owner settles transfer");
});

Deno.test("URL and redirect matrix rejects ambiguity and revalidates every hop", async () => {
  const attempted: string[] = [];
  const policy = new ResourceDestinationPolicy({
    resolveDns: (hostname, recordType) => {
      const address = hostname === "public.example"
        ? "93.184.216.34"
        : "127.0.0.1";
      return Promise.resolve(recordType === "A" ? [address] : []);
    },
  });
  const denied = [
    "",
    "//public.example/path",
    "http://public.example/path",
    "https://user:password@public.example/path",
    "https://public.example/path#secret",
    "https://public.example:444/path",
    "https://127.1/private",
    "https://[::ffff:127.0.0.1]/private",
    `https://public.example/${"x".repeat(TRANSFER_POLICY.maxUrlChars)}`,
  ];
  for (const url of denied) {
    await policy.authorize(url).then(
      () => {
        throw new Error(`expected URL denial: ${url}`);
      },
      (error) => assert(error instanceof Error, "URL denial is typed"),
    );
  }

  const service = new ResourceService({
    policy,
    fetch: (url) => {
      attempted.push(url.href);
      return Promise.resolve(
        new Response(null, {
          status: 302,
          headers: { location: "https://private.example/admin/token" },
        }),
      );
    },
  });
  let denial = "";
  await service.bytes("https://public.example/start").catch((error) => {
    assert(error instanceof ResourceServiceError, "redirect denial is typed");
    denial = `${error.code}:${error.message}`;
  });
  assert(
    attempted.length === 1,
    "private redirect is denied before second I/O",
  );
  assert(
    denial === "blocked-by-policy:resource unavailable",
    "redirect denial is stable and sanitized",
  );
  assert(!denial.includes("private.example"), "redirect target is not leaked");
  assert(!denial.includes("token"), "redirect path is not leaked");
});

Deno.test("transfer controls reject missing extra wrong-type and oversized inputs", () => {
  const valid = {
    type: "resource.bytes",
    id: "r-1",
    url: "https://public.example/a",
  };
  assert(
    decodeNapControlMessage(valid)?.type === "resource.bytes",
    "baseline accepted",
  );
  for (
    const value of [
      { type: "resource.bytes", id: "r-1" },
      { ...valid, extra: true },
      { ...valid, url: 7 },
      { ...valid, id: "" },
      { ...valid, url: `https://public.example/${"x".repeat(2_100)}` },
      { type: "resource.bytesMany", id: "r", urls: [] },
      { type: "resource.bytesMany", id: "r", urls: Array(9).fill(valid.url) },
      { type: "upload.status", id: "u", uploadId: "", extra: false },
    ]
  ) {
    assert(decodeNapControlMessage(value) === null, "hostile control rejected");
  }

  const owner = { connectionId: "c", windowId: "w", generation: 4 };
  const raw = JSON.stringify({
    type: "runtime.forward",
    connectionId: owner.connectionId,
    windowId: owner.windowId,
    generation: owner.generation,
    message: valid,
    token: "must-not-cross-boundary",
  });
  assert(!decodeClientMessage(raw, owner).ok, "extra outer fields fail closed");
});

Deno.test("binary and correlation matrix rejects malformed duplicate stale and shutdown input", () => {
  const owner = { connectionId: "c", windowId: "w", generation: 9 };
  const valid = encodeBinaryFrame({
    kind: BinaryFrameKind.ResourceRequest,
    id: "binary-1",
    payload: new Uint8Array(),
  });
  const malformed = valid.slice();
  new DataView(malformed.buffer).setUint32(8, 1, false);
  assert(!decodeBinaryFrames(malformed, owner).ok, "length mismatch rejected");
  assert(
    !decodeBinaryFrames(valid.subarray(0, valid.length - 1), owner).ok,
    "truncation rejected",
  );

  let oversized = false;
  try {
    encodeBinaryFrame({
      kind: BinaryFrameKind.UploadRequest,
      id: "upload-1",
      payload: encodeUploadPayload(
        {},
        new Uint8Array(MAX_BINARY_PAYLOAD_BYTES + 1),
      ),
    });
  } catch {
    oversized = true;
  }
  assert(oversized, "oversized upload rejected before framing");

  const active = new ActiveBinaryRequests(2);
  assert(
    !active.open({ ...owner, generation: -1 }, "bad"),
    "negative generation rejected",
  );
  assert(!active.open(owner, ""), "empty correlation rejected");
  assert(active.open(owner, "one"), "first correlation accepted");
  assert(!active.open(owner, "one"), "duplicate correlation rejected");
  active.clear();
  assert(!active.settle(owner, "one"), "post-shutdown result rejected");
});

Deno.test("resource batch rejects empty envelopes and preserves sanitized ordered settlement", async () => {
  const service = new ResourceService({
    policy: new ResourceDestinationPolicy({
      resolveDns: (_hostname, recordType) =>
        Promise.resolve(recordType === "A" ? ["93.184.216.34"] : []),
    }),
    fetch: (url) =>
      Promise.resolve(
        url.pathname.includes("missing")
          ? new Response("/srv/private/token", { status: 404 })
          : new Response(
            new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
          ),
      ),
  });
  await service.bytesMany([]).then(
    () => {
      throw new Error("empty batch must be denied");
    },
    (error) =>
      assert(error instanceof ResourceServiceError, "empty batch typed denial"),
  );
  const results = await service.bytesMany([
    "https://public.example/first",
    "https://public.example/missing",
    "https://public.example/third",
  ]);
  assert(results.length === 3, "every row settles in input order");
  assert(
    results[0].ok && !results[1].ok && results[2].ok,
    "mixed results are ordered",
  );
  const middle = results[1];
  assert(!middle.ok, "middle row is the failure");
  const projection = `${middle.error.code}:${middle.error.message}`;
  assert(
    projection === "not-found:resource unavailable",
    "failure is stable and sanitized",
  );
  assert(!projection.includes("/srv/private"), "local path is not disclosed");
  assert(!projection.includes("token"), "secret hint is not disclosed");
});
