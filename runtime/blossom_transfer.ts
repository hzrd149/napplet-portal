import type {
  EventTemplate,
  NostrEvent,
  UploadResult,
  UploadStatus,
} from "@napplet/core";
import {
  Actions,
  type BlobDescriptor,
  computeBlobSha256,
  createUploadAuth,
  encodeAuthorizationHeader,
  type SignedEvent,
} from "blossom-client-sdk";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const AUTH_LIFETIME_SECONDS = 60;

export interface PortalBlobDescriptor {
  readonly sha256: string;
  readonly size: number;
  readonly type?: string;
  readonly url: string;
}

interface UploadSdkOptions {
  readonly authorization: string;
  readonly authorizationEvent: unknown;
  readonly signal: AbortSignal;
}

export interface BlossomUploadSdk {
  readonly sniffMimeType: (bytes: Uint8Array, hint?: string) => string;
  readonly sha256: (blob: Blob) => Promise<string>;
  readonly createUploadAuth: (
    signer: (template: EventTemplate) => Promise<NostrEvent>,
    sha256: string,
    options: {
      readonly servers: readonly string[];
      readonly expiration: number;
    },
  ) => Promise<unknown>;
  readonly encodeAuthorizationHeader: (event: unknown) => string;
  readonly uploadBlob: (
    server: URL,
    blob: Blob,
    options: UploadSdkOptions,
  ) => Promise<unknown>;
  readonly parseUploadResponse: (value: unknown) => PortalBlobDescriptor;
}

function sniffMimeType(bytes: Uint8Array, hint?: string): string {
  if (
    bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 &&
    bytes[2] === 0x4e && bytes[3] === 0x47
  ) return "image/png";
  if (
    bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) return "image/jpeg";
  if (
    bytes.length >= 6 &&
    new TextDecoder().decode(bytes.subarray(0, 6)).startsWith("GIF8")
  ) return "image/gif";
  if (
    bytes.length >= 12 &&
    new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP"
  ) return "image/webp";
  const sample = new TextDecoder().decode(bytes.subarray(0, 512));
  if (sample.length > 0 && !sample.includes("\u0000")) {
    return hint?.startsWith("text/") ? hint : "text/plain";
  }
  return "application/octet-stream";
}

const DEFAULT_SDK: BlossomUploadSdk = {
  sniffMimeType,
  sha256: computeBlobSha256,
  createUploadAuth: (signer, sha256, options) =>
    createUploadAuth(
      signer as (template: EventTemplate) => Promise<SignedEvent>,
      sha256,
      { servers: [...options.servers], expiration: options.expiration },
    ),
  encodeAuthorizationHeader: (event) =>
    encodeAuthorizationHeader(event as SignedEvent),
  uploadBlob: (server, blob, options) =>
    Actions.uploadBlob(server, blob, {
      auth: options.authorizationEvent as SignedEvent,
      signal: options.signal,
      timeout: 30_000,
    }),
  parseUploadResponse: (value) => value as BlobDescriptor,
};

function validateDescriptor(
  server: URL,
  descriptor: PortalBlobDescriptor,
  sha256: string,
  size: number,
): PortalBlobDescriptor {
  let url: URL;
  try {
    url = new URL(descriptor.url);
  } catch {
    throw new Error("descriptor-mismatch");
  }
  const hashPath = url.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
  if (
    descriptor.sha256.toLowerCase() !== sha256 || descriptor.size !== size ||
    url.origin !== server.origin || hashPath !== sha256
  ) throw new Error("descriptor-mismatch");
  return Object.freeze({ ...descriptor, sha256, url: url.href });
}

export interface BlossomTransferAdapterOptions {
  readonly signEvent: (template: EventTemplate) => Promise<NostrEvent>;
  readonly sdk?: BlossomUploadSdk;
  readonly now?: () => number;
}

export class BlossomTransferAdapter {
  readonly #signEvent: (template: EventTemplate) => Promise<NostrEvent>;
  readonly #sdk: BlossomUploadSdk;
  readonly #now: () => number;

  constructor(options: BlossomTransferAdapterOptions) {
    this.#signEvent = options.signEvent;
    this.#sdk = options.sdk ?? DEFAULT_SDK;
    this.#now = options.now ?? (() => Date.now());
  }

  async uploadRequired(
    server: URL,
    input: Blob,
    signal: AbortSignal = new AbortController().signal,
  ): Promise<PortalBlobDescriptor & { readonly mimeType: string }> {
    if (input.size > MAX_UPLOAD_BYTES) throw new Error("rejected");
    signal.throwIfAborted();
    const bytes = new Uint8Array(await input.slice(0, 512).arrayBuffer());
    const mimeType = this.#sdk.sniffMimeType(bytes, input.type);
    const blob = input.type === mimeType
      ? input
      : new Blob([input], { type: mimeType });
    const sha256 = (await this.#sdk.sha256(blob)).toLowerCase();
    const auth = await this.#sdk.createUploadAuth(this.#signEvent, sha256, {
      servers: [server.hostname],
      expiration: Math.floor(this.#now() / 1000) + AUTH_LIFETIME_SECONDS,
    });
    signal.throwIfAborted();
    const raw = await this.#sdk.uploadBlob(server, blob, {
      authorization: this.#sdk.encodeAuthorizationHeader(auth),
      authorizationEvent: auth,
      signal,
    });
    const descriptor = validateDescriptor(
      server,
      this.#sdk.parseUploadResponse(raw),
      sha256,
      blob.size,
    );
    return Object.freeze({ ...descriptor, mimeType });
  }
}

export type { UploadResult, UploadStatus };
