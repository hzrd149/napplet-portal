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
  parseBlossomURI,
  type SignedEvent,
} from "blossom-client-sdk";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const AUTH_LIFETIME_SECONDS = 60;

export function parseBlossomReference(value: string): Readonly<{
  sha256: string;
  size?: number;
  servers: readonly string[];
}> {
  const parsed = parseBlossomURI(value);
  if (!/^[0-9a-f]{64}$/i.test(parsed.sha256)) {
    throw new Error("Invalid Blossom hash");
  }
  if (
    parsed.size !== undefined &&
    (!Number.isSafeInteger(parsed.size) || parsed.size < 0 ||
      parsed.size > MAX_UPLOAD_BYTES)
  ) {
    throw new Error("Invalid Blossom size");
  }
  const servers = parsed.servers.map((candidate) => {
    const server = new URL(candidate);
    if (
      !/^https?:$/.test(server.protocol) || server.username ||
      server.password || server.hash
    ) {
      throw new Error("Invalid Blossom server hint");
    }
    return server.href;
  });
  return Object.freeze({
    sha256: parsed.sha256.toLowerCase(),
    size: parsed.size,
    servers: Object.freeze(servers),
  });
}

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

type SettlementOutcome =
  | "accepted"
  | "network-error"
  | "timeout"
  | "rejected"
  | "descriptor-mismatch"
  | "cancelled";

type LocalOutcome = SettlementOutcome | "unavailable" | "not-attempted";

export interface BlossomRequiredUploader {
  readonly uploadRequired: (
    server: URL,
    blob: Blob,
    signal?: AbortSignal,
  ) => Promise<PortalBlobDescriptor & { readonly mimeType: string }>;
}

export interface BlossomUploadRequest {
  readonly owner: string;
  readonly blob: Blob;
  readonly requiredServers: readonly URL[];
  readonly localServer?: URL;
  readonly signal?: AbortSignal;
}

export interface BlossomTransferServiceOptions {
  readonly uploader: BlossomRequiredUploader;
  readonly now?: () => number;
  readonly deadlineMs?: number;
  readonly concurrency?: number;
}

interface SettledDestination {
  readonly outcome: SettlementOutcome;
  readonly descriptor?: PortalBlobDescriptor & { readonly mimeType: string };
}

function classifyFailure(error: unknown): SettlementOutcome {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "cancelled";
  }
  if (!(error instanceof Error)) return "network-error";
  if (error.message === "descriptor-mismatch") return "descriptor-mismatch";
  if (error.message === "timeout" || error.name === "TimeoutError") {
    return "timeout";
  }
  if (error.message === "rejected") return "rejected";
  if (error.message === "cancelled") return "cancelled";
  return "network-error";
}

async function mapBounded<T, R>(
  values: readonly T[],
  concurrency: number,
  fn: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  const worker = async () => {
    while (next < values.length) {
      const index = next++;
      results[index] = await fn(values[index], index);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, worker),
  );
  return results;
}

export class BlossomTransferService {
  readonly #uploader: BlossomRequiredUploader;
  readonly #now: () => number;
  readonly #deadlineMs: number;
  readonly #concurrency: number;
  readonly #statuses = new Map<string, UploadStatus[]>();

  constructor(options: BlossomTransferServiceOptions) {
    this.#uploader = options.uploader;
    this.#now = options.now ?? (() => Date.now());
    this.#deadlineMs = options.deadlineMs ?? 30_000;
    this.#concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 4));
  }

  async upload(request: BlossomUploadRequest): Promise<UploadResult> {
    if (
      request.requiredServers.length === 0 || request.requiredServers.length > 8
    ) {
      throw new Error(
        "Required Blossom server count must be between one and eight",
      );
    }
    if (request.requiredServers.some((server) => isLoopback(server.hostname))) {
      throw new Error("Required Blossom servers must be non-loopback");
    }
    const deadline = AbortSignal.timeout(this.#deadlineMs);
    const signal = request.signal
      ? AbortSignal.any([request.signal, deadline])
      : deadline;
    const settled = await mapBounded(
      request.requiredServers,
      this.#concurrency,
      async (server): Promise<SettledDestination> => {
        try {
          const descriptor = await this.#uploader.uploadRequired(
            server,
            request.blob,
            signal,
          );
          return { outcome: "accepted", descriptor };
        } catch (error) {
          return { outcome: classifyFailure(error) };
        }
      },
    );
    const requiredComplete = settled.every(({ outcome }) =>
      outcome === "accepted"
    );
    let localOutcome: LocalOutcome = "not-attempted";
    let localDescriptor: SettledDestination["descriptor"];
    if (requiredComplete) {
      if (!request.localServer) {
        localOutcome = "unavailable";
      } else {
        try {
          localDescriptor = await this.#uploader.uploadRequired(
            request.localServer,
            request.blob,
            signal,
          );
          localOutcome = "accepted";
        } catch (error) {
          localOutcome = classifyFailure(error);
        }
      }
    }
    const accepted = settled.flatMap(({ descriptor }) =>
      descriptor ? [descriptor] : []
    );
    if (localDescriptor) accepted.push(localDescriptor);
    const primary = accepted[0];
    const error = [
      ...settled.map(({ outcome }, index) => `required[${index}]=${outcome}`),
      `local=${localOutcome}`,
    ].join(";").slice(0, 512);
    const uploadId = crypto.randomUUID();
    const result: UploadResult = {
      ok: requiredComplete,
      uploadId,
      status: requiredComplete ? "complete" : "failed",
      rail: "blossom",
      ...(primary
        ? {
          url: primary.url,
          ...(accepted.length > 1
            ? { fallbackUrls: accepted.slice(1).map(({ url }) => url) }
            : {}),
          sha256: primary.sha256,
          size: primary.size,
          mimeType: primary.mimeType,
        }
        : {}),
      error,
    };
    this.#retain(request.owner, {
      ...result,
      bytesSent: requiredComplete ? request.blob.size : undefined,
      bytesTotal: request.blob.size,
      updatedAt: this.#now(),
    });
    return Object.freeze(result);
  }

  status(owner: string, uploadId: string): UploadStatus | undefined {
    this.#prune(owner);
    return this.#statuses.get(owner)?.find((status) =>
      status.uploadId === uploadId
    );
  }

  #retain(owner: string, status: UploadStatus): void {
    this.#prune(owner);
    const statuses = this.#statuses.get(owner) ?? [];
    statuses.push(Object.freeze(status));
    if (statuses.length > 64) statuses.splice(0, statuses.length - 64);
    this.#statuses.set(owner, statuses);
  }

  #prune(owner: string): void {
    const cutoff = this.#now() - 10 * 60_000;
    const live = this.#statuses.get(owner)?.filter(({ updatedAt }) =>
      updatedAt >= cutoff
    );
    if (!live?.length) this.#statuses.delete(owner);
    else this.#statuses.set(owner, live.slice(-64));
  }
}

function isLoopback(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "::1" || host.startsWith("127.");
}

export type { UploadResult, UploadStatus };
