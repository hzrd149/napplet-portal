import {
  ActiveBinaryRequests,
  BinaryFrameKind,
  BinaryFrameStreamDecoder,
  decodeBinaryFrames,
  encodeBinaryFrame,
  FIXED_RESOURCE_URL,
  MAX_BINARY_PAYLOAD_BYTES,
} from "../runtime/binary_transport.ts";
import {
  FIXED_RESOURCE_BYTES,
  FIXED_RESOURCE_ID,
  handleFixedResourceFrame,
} from "../routes/api/runtime.ts";
import { decodeResourceBinaryResult } from "../islands/NappletShell.tsx";
import {
  decodeNapControlMessage,
  RESOURCE_INFO,
  TRANSFER_POLICY,
  UPLOAD_INFO,
} from "../runtime/transport.ts";

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
  assert(
    decoder.push(joined.slice(0, 7)).length === 0,
    "header fragment waits",
  );
  assert(
    decoder.push(joined.slice(7, first.length - 1)).length === 0,
    "body fragment waits",
  );
  const frames = decoder.push(joined.slice(first.length - 1));
  assert(frames.length === 2, "both concatenated frames decode");
  assert(frames[0].id === "resource-1", "first correlation retained");
  assert(frames[0].owner === owner, "owner comes from authenticated socket");
  assert(frames[1].payload.join(",") === "1,2,3", "payload remains binary");
});

Deno.test("RESOURCE and UPLOAD info are derived from one immutable policy", () => {
  assert(Object.isFrozen(TRANSFER_POLICY), "policy snapshot is immutable");
  assert(TRANSFER_POLICY.maxBytes === MAX_BINARY_PAYLOAD_BYTES, "byte cap matches codec");
  assert(TRANSFER_POLICY.maxUrls === 8, "URL count is closed");
  assert(TRANSFER_POLICY.maxActivePerWindow === 2, "active operations are bounded");
  assert(TRANSFER_POLICY.maxRedirects === 3, "redirect count is closed");
  assert(TRANSFER_POLICY.maxUrlChars === 2_048, "URL text is bounded");
  assert(TRANSFER_POLICY.resourceDeadlineMs === 10_000, "resource deadline is closed");
  assert(TRANSFER_POLICY.uploadDeadlineMs === 30_000, "upload deadline is closed");
  assert(
    JSON.stringify(RESOURCE_INFO) === JSON.stringify({
      schemes: [
        { scheme: "https", enabled: true },
        { scheme: "blossom", enabled: true },
      ],
      maxBytes: 5_242_880,
      maxUrls: 8,
    }),
    "resource.info uses pinned fields only",
  );
  assert(UPLOAD_INFO.rails.length === 1, "one upload rail advertised");
  assert(UPLOAD_INFO.rails[0].rail === "blossom", "blossom rail advertised");
  assert(UPLOAD_INFO.rails[0].enabled, "blossom rail enabled");
  assert(UPLOAD_INFO.maxBytes === 5_242_880, "upload cap advertised");
  assert(
    UPLOAD_INFO.mimeTypes?.join(",") ===
      "image/png,image/jpeg,image/gif,image/webp,image/avif,text/plain,application/json,application/pdf",
    "closed passive MIME allowlist advertised",
  );
  assert(
    UPLOAD_INFO.rails[0].returns?.join(",") ===
      "url,fallbackUrls,sha256,size,mimeType,nip94",
    "canonical return fields advertised",
  );
});

Deno.test("RESOURCE and UPLOAD controls accept only exact canonical shapes", () => {
  assert(
    decodeNapControlMessage({ type: "resource.info", id: "r-1" })?.type ===
      "resource.info",
    "resource info accepted",
  );
  assert(
    decodeNapControlMessage({ type: "upload.info", id: "u-1" })?.type ===
      "upload.info",
    "upload info accepted",
  );
  for (const malformed of [
    { type: "resource.info", id: "", extra: true },
    { type: "resource.bytes", id: "r", url: FIXED_RESOURCE_URL, extra: true },
    { type: "resource.bytesMany", id: "r", urls: [FIXED_RESOURCE_URL] },
    { type: "upload.status", id: "u", uploadId: "foreign" },
    { type: "upload.upload", id: "u", request: { rail: "nip96", data: new Blob() } },
    { type: "upload.upload", id: "u", request: { rail: "blossom", data: "base64" } },
  ]) assert(decodeNapControlMessage(malformed) === null, "malformed control denied");
});

Deno.test("binary frames fail closed for malformed headers and limits", () => {
  const valid = encodeBinaryFrame({
    kind: BinaryFrameKind.ResourceRequest,
    id: "resource-1",
    payload: new Uint8Array(),
  });
  for (
    const [name, mutate] of [
      ["magic", (bytes: Uint8Array) => bytes[0] ^= 0xff],
      ["version", (bytes: Uint8Array) => bytes[4] = 99],
      ["kind", (bytes: Uint8Array) => bytes[5] = 99],
    ] as const
  ) {
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
  assert(
    decoded.frames[0].kind === BinaryFrameKind.ResourceResult,
    "result kind",
  );
  assert(decoded.frames[0].id === FIXED_RESOURCE_ID, "correlation retained");
  assert(
    decoded.frames[0].payload.join(",") === FIXED_RESOURCE_BYTES.join(","),
    "fixed bytes returned",
  );
  assert(fetchCalls === 0, "no fetch call occurs");

  const pending = new ActiveBinaryRequests(2);
  assert(pending.open(owner, FIXED_RESOURCE_ID), "browser request is active");
  const canonical = decodeResourceBinaryResult(response, owner, pending) as {
    type: string;
    id: string;
    blob: Blob;
    mime: string;
  } | null;
  assert(canonical?.type === "resource.bytes.result", "canonical result type");
  assert(canonical.id === FIXED_RESOURCE_ID, "canonical id retained");
  assert(canonical.blob instanceof Blob, "canonical result contains a Blob");
  assert(canonical.mime === "text/plain", "bounded tracer MIME retained");
  assert(
    new Uint8Array(await canonical.blob.arrayBuffer()).join(",") ===
      FIXED_RESOURCE_BYTES.join(","),
    "Blob contains exact backend bytes",
  );
});
