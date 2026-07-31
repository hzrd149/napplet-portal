import {
  ActiveBinaryRequests,
  BinaryFrameKind,
  BinaryFrameStreamDecoder,
  decodeBinaryFrames,
  encodeBinaryFrame,
  MAX_BINARY_PAYLOAD_BYTES,
} from "../runtime/binary_transport.ts";
import {
  FIXED_RESOURCE_BYTES,
  FIXED_RESOURCE_ID,
  handleFixedResourceFrame,
} from "../routes/api/runtime.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const owner = { connectionId: "connection-1", windowId: "window-1" };

Deno.test("binary frames decode fragmented and concatenated input deterministically", () => {
  const first = encodeBinaryFrame({
    kind: BinaryFrameKind.ResourceRequest,
    id: "resource-1",
    payload: new Uint8Array(),
  });
  const second = encodeBinaryFrame({
    kind: BinaryFrameKind.ResourceResult,
    id: "resource-2",
    payload: new Uint8Array([1, 2, 3]),
  });
  const joined = new Uint8Array(first.length + second.length);
  joined.set(first);
  joined.set(second, first.length);

  const decoder = new BinaryFrameStreamDecoder(owner);
  assert(decoder.push(joined.slice(0, 7)).length === 0, "header fragment waits");
  assert(decoder.push(joined.slice(7, first.length - 1)).length === 0, "body fragment waits");
  const frames = decoder.push(joined.slice(first.length - 1));
  assert(frames.length === 2, "both concatenated frames decode");
  assert(frames[0].id === "resource-1", "first correlation retained");
  assert(frames[0].owner === owner, "owner comes from authenticated socket");
  assert(frames[1].payload.join(",") === "1,2,3", "payload remains binary");
});

Deno.test("binary frames fail closed for malformed headers and limits", () => {
  const valid = encodeBinaryFrame({
    kind: BinaryFrameKind.ResourceRequest,
    id: "resource-1",
    payload: new Uint8Array(),
  });
  for (const [name, mutate] of [
    ["magic", (bytes: Uint8Array) => bytes[0] ^= 0xff],
    ["version", (bytes: Uint8Array) => bytes[4] = 99],
    ["kind", (bytes: Uint8Array) => bytes[5] = 99],
  ] as const) {
    const bytes = valid.slice();
    mutate(bytes);
    assert(!decodeBinaryFrames(bytes, owner).ok, `${name} rejected`);
  }
  const mismatched = valid.slice();
  new DataView(mismatched.buffer).setUint32(8, 1, false);
  assert(!decodeBinaryFrames(mismatched, owner).ok, "declared length rejected");
  assert(
    !decodeBinaryFrames(new Uint8Array(12), owner).ok,
    "empty malformed metadata rejected",
  );
  let oversized = false;
  try {
    encodeBinaryFrame({
      kind: BinaryFrameKind.UploadRequest,
      id: "x",
      payload: new Uint8Array(MAX_BINARY_PAYLOAD_BYTES + 1),
    });
  } catch {
    oversized = true;
  }
  assert(oversized, "oversized payload rejected before framing");
  assert(
    !decodeBinaryFrames(valid.slice(0, valid.length - 1), owner).ok,
    "truncated frame rejected by complete decoder",
  );
});

Deno.test("active binary requests reject duplicate, foreign, and late results", () => {
  const requests = new ActiveBinaryRequests(2);
  assert(requests.open(owner, "resource-1"), "request opens");
  assert(!requests.open(owner, "resource-1"), "duplicate active id rejected");
  assert(
    !requests.settle(
      { connectionId: "foreign", windowId: owner.windowId },
      "resource-1",
    ),
    "foreign owner rejected",
  );
  assert(requests.settle(owner, "resource-1"), "owned result settles");
  assert(!requests.settle(owner, "resource-1"), "late result rejected");
});

Deno.test("fixed RESOURCE tracer returns binary bytes without network access", async () => {
  let fetchCalls = 0;
  const request = encodeBinaryFrame({
    kind: BinaryFrameKind.ResourceRequest,
    id: FIXED_RESOURCE_ID,
    payload: new Uint8Array(),
  });
  const response = await handleFixedResourceFrame(request, owner, {
    fetch: () => {
      fetchCalls++;
      throw new Error("network must remain disabled");
    },
  });
  assert(response !== null, "fixed resource responds");
  const decoded = decodeBinaryFrames(response, owner);
  assert(decoded.ok && decoded.frames.length === 1, "result frame decodes");
  assert(decoded.frames[0].kind === BinaryFrameKind.ResourceResult, "result kind");
  assert(decoded.frames[0].id === FIXED_RESOURCE_ID, "correlation retained");
  assert(
    decoded.frames[0].payload.join(",") === FIXED_RESOURCE_BYTES.join(","),
    "fixed bytes returned",
  );
  assert(fetchCalls === 0, "no fetch call occurs");
});
