import type { MessageOwner } from "./transport.ts";

const MAGIC = new Uint8Array([0x4e, 0x41, 0x50, 0x42]); // NAPB
const VERSION = 1;
const HEADER_BYTES = 12;
export const MAX_BINARY_ID_BYTES = 128;
export const MAX_BINARY_PAYLOAD_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_METADATA_BYTES = 16 * 1024;
export const FIXED_RESOURCE_URL =
  "https://napplet.invalid/__portal_resource_tracer__";
export const FIXED_RESOURCE_ID = "portal-fixed-resource";

export enum BinaryFrameKind {
  ResourceRequest = 1,
  ResourceResult = 2,
  UploadRequest = 3,
  UploadResult = 4,
}

export interface BinaryFrame {
  readonly kind: BinaryFrameKind;
  readonly id: string;
  readonly payload: Uint8Array;
  readonly owner: MessageOwner;
}

interface EncodableFrame {
  readonly kind: BinaryFrameKind;
  readonly id: string;
  readonly payload: Uint8Array;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function validKind(value: number): value is BinaryFrameKind {
  return value === BinaryFrameKind.ResourceRequest ||
    value === BinaryFrameKind.ResourceResult ||
    value === BinaryFrameKind.UploadRequest ||
    value === BinaryFrameKind.UploadResult;
}

export function encodeBinaryFrame(frame: EncodableFrame): Uint8Array {
  const id = encoder.encode(frame.id);
  if (!id.length || id.length > MAX_BINARY_ID_BYTES) {
    throw new TypeError("invalid binary correlation id");
  }
  if (!validKind(frame.kind)) throw new TypeError("invalid binary frame kind");
  const upload = frame.kind === BinaryFrameKind.UploadRequest
    ? decodeUploadPayload(frame.payload)
    : null;
  if (
    frame.kind === BinaryFrameKind.UploadRequest &&
    (!upload || upload.data.length > MAX_BINARY_PAYLOAD_BYTES)
  ) {
    throw new RangeError("invalid upload payload");
  }
  const payloadLimit = frame.kind === BinaryFrameKind.UploadRequest
    ? MAX_BINARY_PAYLOAD_BYTES + MAX_UPLOAD_METADATA_BYTES + 4
    : MAX_BINARY_PAYLOAD_BYTES;
  if (frame.payload.length > payloadLimit) {
    throw new RangeError("binary payload too large");
  }
  const bytes = new Uint8Array(HEADER_BYTES + id.length + frame.payload.length);
  bytes.set(MAGIC, 0);
  bytes[4] = VERSION;
  bytes[5] = frame.kind;
  const view = new DataView(bytes.buffer);
  view.setUint16(6, id.length, false);
  view.setUint32(8, frame.payload.length, false);
  bytes.set(id, HEADER_BYTES);
  bytes.set(frame.payload, HEADER_BYTES + id.length);
  return bytes;
}

export function encodeUploadPayload(
  metadata: Record<string, unknown>,
  data: Uint8Array,
): Uint8Array {
  const header = encoder.encode(JSON.stringify(metadata));
  if (header.length > MAX_UPLOAD_METADATA_BYTES) {
    throw new RangeError("upload metadata too large");
  }
  const payload = new Uint8Array(4 + header.length + data.length);
  new DataView(payload.buffer).setUint32(0, header.length, false);
  payload.set(header, 4);
  payload.set(data, 4 + header.length);
  return payload;
}

export function decodeUploadPayload(
  payload: Uint8Array,
): { metadata: Record<string, unknown>; data: Uint8Array } | null {
  if (payload.length < 4) return null;
  const length = new DataView(
    payload.buffer,
    payload.byteOffset,
    payload.byteLength,
  ).getUint32(0, false);
  if (length > MAX_UPLOAD_METADATA_BYTES || 4 + length > payload.length) {
    return null;
  }
  try {
    const metadata = JSON.parse(
      decoder.decode(payload.subarray(4, 4 + length)),
    );
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return null;
    }
    return { metadata, data: payload.slice(4 + length) };
  } catch {
    return null;
  }
}

function frameLength(bytes: Uint8Array, offset: number): number | null {
  if (bytes.length - offset < HEADER_BYTES) return null;
  for (let index = 0; index < MAGIC.length; index++) {
    if (bytes[offset + index] !== MAGIC[index]) {
      throw new TypeError("invalid binary frame");
    }
  }
  if (bytes[offset + 4] !== VERSION || !validKind(bytes[offset + 5])) {
    throw new TypeError("invalid binary frame");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset);
  const idLength = view.getUint16(6, false);
  const payloadLength = view.getUint32(8, false);
  if (
    !idLength || idLength > MAX_BINARY_ID_BYTES ||
    payloadLength >
      (bytes[offset + 5] === BinaryFrameKind.UploadRequest
        ? MAX_BINARY_PAYLOAD_BYTES + MAX_UPLOAD_METADATA_BYTES + 4
        : MAX_BINARY_PAYLOAD_BYTES)
  ) throw new TypeError("invalid binary frame");
  return HEADER_BYTES + idLength + payloadLength;
}

function decodeOne(
  bytes: Uint8Array,
  offset: number,
  length: number,
  owner: MessageOwner,
): BinaryFrame {
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset);
  const idLength = view.getUint16(6, false);
  let id: string;
  try {
    id = decoder.decode(
      bytes.subarray(offset + HEADER_BYTES, offset + HEADER_BYTES + idLength),
    );
  } catch {
    throw new TypeError("invalid binary frame");
  }
  if (
    !id || [...id].some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 32 || code === 127;
    })
  ) {
    throw new TypeError("invalid binary frame");
  }
  return {
    kind: bytes[offset + 5] as BinaryFrameKind,
    id,
    payload: bytes.slice(offset + HEADER_BYTES + idLength, offset + length),
    owner,
  };
}

export class BinaryFrameStreamDecoder {
  #buffer = new Uint8Array();

  constructor(readonly owner: MessageOwner) {}

  push(chunk: Uint8Array): BinaryFrame[] {
    if (chunk.length) {
      const combined = new Uint8Array(this.#buffer.length + chunk.length);
      combined.set(this.#buffer);
      combined.set(chunk, this.#buffer.length);
      this.#buffer = combined;
    }
    const frames: BinaryFrame[] = [];
    let offset = 0;
    while (offset < this.#buffer.length) {
      const length = frameLength(this.#buffer, offset);
      if (length === null || this.#buffer.length - offset < length) break;
      frames.push(decodeOne(this.#buffer, offset, length, this.owner));
      offset += length;
    }
    this.#buffer = this.#buffer.slice(offset);
    return frames;
  }

  get pendingBytes(): number {
    return this.#buffer.length;
  }
}

export type DecodeBinaryResult =
  | { readonly ok: true; readonly frames: readonly BinaryFrame[] }
  | { readonly ok: false; readonly error: "invalid-binary-frame" };

export function decodeBinaryFrames(
  bytes: Uint8Array,
  owner: MessageOwner,
): DecodeBinaryResult {
  try {
    const stream = new BinaryFrameStreamDecoder(owner);
    const frames = stream.push(bytes);
    if (stream.pendingBytes || !frames.length) {
      return { ok: false, error: "invalid-binary-frame" };
    }
    return { ok: true, frames };
  } catch {
    return { ok: false, error: "invalid-binary-frame" };
  }
}

function requestKey(owner: MessageOwner, id: string): string {
  const generation = owner.generation === undefined
    ? "legacy"
    : String(owner.generation);
  return `${owner.connectionId.length}:${owner.connectionId}${owner.windowId.length}:${owner.windowId}${generation.length}:${generation}${id}`;
}

function validRequestIdentity(owner: MessageOwner, id: string): boolean {
  const idBytes = encoder.encode(id);
  return idBytes.length > 0 && idBytes.length <= MAX_BINARY_ID_BYTES &&
    ![...id].some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 32 || code === 127;
    }) &&
    (owner.generation === undefined ||
      (Number.isSafeInteger(owner.generation) && owner.generation >= 0));
}

// Not folded into runtime/expiring_registry.ts's ExpiringRegistry: this is
// a bounded-concurrency admission guard backed by a plain Set<string> with
// a hard limit and no TTL, no timers, and no stored value. Entries are
// settled explicitly by their owner rather than expiring, its key is a
// length-prefixed owner+generation composite validated by
// validRequestIdentity, and it is additionally consumed by browser code in
// islands/NappletShell.tsx. It shares the words "keyed" and "limit" with
// the expiring registry and nothing else.
export class ActiveBinaryRequests {
  readonly #active = new Set<string>();

  constructor(readonly limit: number) {}

  open(owner: MessageOwner, id: string): boolean {
    if (!validRequestIdentity(owner, id)) return false;
    const key = requestKey(owner, id);
    if (this.#active.has(key) || this.#active.size >= this.limit) return false;
    this.#active.add(key);
    return true;
  }

  settle(owner: MessageOwner, id: string): boolean {
    if (!validRequestIdentity(owner, id)) return false;
    return this.#active.delete(requestKey(owner, id));
  }

  clear(): void {
    this.#active.clear();
  }
}
