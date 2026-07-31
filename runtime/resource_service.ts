import {
  type ResourceDestinationClass,
  ResourceDestinationPolicy,
  ResourcePolicyError,
} from "./resource_policy.ts";
import { TRANSFER_POLICY } from "./transport.ts";
import { pinnedFetch } from "./pinned_fetch.ts";

type FetchLike = (
  input: URL,
  init?: RequestInit,
  approvedAddresses?: readonly string[],
) => Promise<Response>;

interface ResourceServiceOptions {
  readonly policy?: ResourceDestinationPolicy;
  readonly fetch?: FetchLike;
  readonly maxRedirects?: number;
  readonly maxBytes?: number;
  readonly maxUrls?: number;
  readonly deadlineMs?: number;
  readonly localCacheUrl?: string;
}

export interface ResourceReadOptions {
  readonly signal?: AbortSignal;
  readonly blossomServers?: readonly string[];
  readonly authorPubkey?: string;
  readonly deadlineSignal?: AbortSignal;
  readonly timeoutSignal?: AbortSignal;
}

export type ResourceErrorCode =
  | "blocked-by-policy"
  | "not-found"
  | "timeout"
  | "too-large"
  | "decode-failed"
  | "network-error"
  | "cancelled";

export class ResourceServiceError extends Error {
  constructor(
    readonly code: ResourceErrorCode,
    message = "resource unavailable",
  ) {
    super(message);
    this.name = "ResourceServiceError";
  }
}

export interface ResourceBytes {
  readonly blob: Blob;
  readonly bytes: Uint8Array;
  readonly mime: string;
}

export type ResourceBatchItem =
  | { readonly ok: true; readonly value: ResourceBytes }
  | { readonly ok: false; readonly error: ResourceServiceError };

interface ReadResponse {
  readonly bytes: Uint8Array;
  readonly sha256: string;
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 ||
    status === 307 || status === 308;
}

function starts(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return new TextDecoder().decode(bytes.subarray(start, start + length));
}

function sniffMime(bytes: Uint8Array): string | undefined {
  if (starts(bytes, [137, 80, 78, 71, 13, 10, 26, 10])) return "image/png";
  if (starts(bytes, [255, 216, 255])) return "image/jpeg";
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") {
    return "image/gif";
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }
  if (
    ascii(bytes, 4, 4) === "ftyp" &&
    ["avif", "avis"].includes(ascii(bytes, 8, 4))
  ) return "image/avif";
  if (ascii(bytes, 0, 5) === "%PDF-") return "application/pdf";

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
  const trimmed = text.trim();
  const hasForbiddenControl = [...text].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 && code !== 9 && code !== 10 && code !== 13;
  });
  if (!trimmed || hasForbiddenControl) {
    return undefined;
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return "application/json";
    } catch {
      return undefined;
    }
  }
  const active = trimmed.toLowerCase();
  if (
    active.startsWith("<") || active.includes("<script") ||
    active.includes("javascript:") ||
    /\b(?:eval|function|import|export)\s*(?:\(|\{|["'])/.test(active)
  ) return undefined;
  return "text/plain";
}

function canonicalBlossomServers(values: readonly string[]): readonly string[] {
  const result = new Set<string>();
  for (const value of values) {
    try {
      const url = new URL(value);
      if (
        url.protocol !== "https:" || url.username || url.password || url.hash ||
        (url.port && url.port !== "443")
      ) continue;
      result.add(url.href);
    } catch {
      // Invalid settings never become outbound candidates.
    }
  }
  return [...result];
}

function blossomHash(input: string): string | undefined {
  return /^blossom:sha256:([0-9a-f]{64})(?:\?.*)?$/.exec(input)?.[1];
}

function errorFrom(cause: unknown): ResourceServiceError {
  return cause instanceof ResourceServiceError
    ? cause
    : new ResourceServiceError("network-error");
}

const SHA256_K = new Uint32Array([
  0x428a2f98,
  0x71374491,
  0xb5c0fbcf,
  0xe9b5dba5,
  0x3956c25b,
  0x59f111f1,
  0x923f82a4,
  0xab1c5ed5,
  0xd807aa98,
  0x12835b01,
  0x243185be,
  0x550c7dc3,
  0x72be5d74,
  0x80deb1fe,
  0x9bdc06a7,
  0xc19bf174,
  0xe49b69c1,
  0xefbe4786,
  0x0fc19dc6,
  0x240ca1cc,
  0x2de92c6f,
  0x4a7484aa,
  0x5cb0a9dc,
  0x76f988da,
  0x983e5152,
  0xa831c66d,
  0xb00327c8,
  0xbf597fc7,
  0xc6e00bf3,
  0xd5a79147,
  0x06ca6351,
  0x14292967,
  0x27b70a85,
  0x2e1b2138,
  0x4d2c6dfc,
  0x53380d13,
  0x650a7354,
  0x766a0abb,
  0x81c2c92e,
  0x92722c85,
  0xa2bfe8a1,
  0xa81a664b,
  0xc24b8b70,
  0xc76c51a3,
  0xd192e819,
  0xd6990624,
  0xf40e3585,
  0x106aa070,
  0x19a4c116,
  0x1e376c08,
  0x2748774c,
  0x34b0bcb5,
  0x391c0cb3,
  0x4ed8aa4a,
  0x5b9cca4f,
  0x682e6ff3,
  0x748f82ee,
  0x78a5636f,
  0x84c87814,
  0x8cc70208,
  0x90befffa,
  0xa4506ceb,
  0xbef9a3f7,
  0xc67178f2,
]);

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

class IncrementalSha256 {
  readonly #state = new Uint32Array([
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19,
  ]);
  readonly #buffer = new Uint8Array(64);
  #bufferLength = 0;
  #byteLength = 0;

  update(bytes: Uint8Array): void {
    this.#byteLength += bytes.byteLength;
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = Math.min(
        64 - this.#bufferLength,
        bytes.byteLength - offset,
      );
      this.#buffer.set(
        bytes.subarray(offset, offset + count),
        this.#bufferLength,
      );
      this.#bufferLength += count;
      offset += count;
      if (this.#bufferLength === 64) {
        this.#compress(this.#buffer);
        this.#bufferLength = 0;
      }
    }
  }

  digestHex(): string {
    const tail = new Uint8Array(128);
    tail.set(this.#buffer.subarray(0, this.#bufferLength));
    tail[this.#bufferLength] = 0x80;
    const paddedLength = this.#bufferLength < 56 ? 64 : 128;
    const bitLength = BigInt(this.#byteLength) * 8n;
    new DataView(tail.buffer).setBigUint64(paddedLength - 8, bitLength, false);
    this.#compress(tail.subarray(0, 64));
    if (paddedLength === 128) this.#compress(tail.subarray(64));
    return [...this.#state].map((word) => word.toString(16).padStart(8, "0"))
      .join("");
  }

  #compress(block: Uint8Array): void {
    const words = new Uint32Array(64);
    const view = new DataView(block.buffer, block.byteOffset, block.byteLength);
    for (let index = 0; index < 16; index++) {
      words[index] = view.getUint32(index * 4, false);
    }
    for (let index = 16; index < 64; index++) {
      const a = words[index - 15];
      const b = words[index - 2];
      const s0 = rotateRight(a, 7) ^ rotateRight(a, 18) ^ (a >>> 3);
      const s1 = rotateRight(b, 17) ^ rotateRight(b, 19) ^ (b >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = this.#state;
    for (let index = 0; index < 64; index++) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 =
        (h + sum1 + choice + SHA256_K[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    for (const [index, value] of [a, b, c, d, e, f, g, h].entries()) {
      this.#state[index] = (this.#state[index] + value) >>> 0;
    }
  }
}

export class ResourceService {
  readonly #policy: ResourceDestinationPolicy;
  readonly #fetch: FetchLike;
  readonly #maxRedirects: number;
  readonly #maxBytes: number;
  readonly #maxUrls: number;
  readonly #deadlineMs: number;
  readonly #localCacheUrl?: string;

  constructor(options: ResourceServiceOptions = {}) {
    this.#policy = options.policy ?? new ResourceDestinationPolicy();
    this.#fetch = options.fetch ?? pinnedFetch;
    this.#maxRedirects = options.maxRedirects ?? TRANSFER_POLICY.maxRedirects;
    this.#maxBytes = options.maxBytes ?? TRANSFER_POLICY.maxBytes;
    this.#maxUrls = options.maxUrls ?? TRANSFER_POLICY.maxUrls;
    this.#deadlineMs = options.deadlineMs ?? TRANSFER_POLICY.resourceDeadlineMs;
    this.#localCacheUrl = options.localCacheUrl;
  }

  async bytes(
    input: string | URL,
    options: ResourceReadOptions | AbortSignal = {},
  ): Promise<ResourceBytes> {
    const readOptions = options instanceof AbortSignal
      ? { signal: options }
      : options;
    return await this.#withDeadline(readOptions, async (bounded) => {
      const source = String(input);
      const hash = blossomHash(source);
      if (hash) return this.#release(await this.#blossomRead(hash, bounded));
      let parsed: URL;
      try {
        parsed = new URL(source);
      } catch {
        throw new ResourceServiceError("blocked-by-policy");
      }
      if (parsed.protocol !== "https:") {
        throw new ResourceServiceError("blocked-by-policy");
      }
      return this.#release(
        await this.#fetchBytes(
          parsed,
          "public",
          bounded.deadlineSignal!,
          bounded.signal,
        ),
      );
    });
  }

  async bytesMany(
    inputs: readonly (string | URL)[],
    options: ResourceReadOptions = {},
  ): Promise<readonly ResourceBatchItem[]> {
    if (inputs.length > this.#maxUrls) {
      throw new ResourceServiceError("blocked-by-policy");
    }
    return await this.#withDeadline(
      options,
      async (bounded) =>
        await Promise.all(
          inputs.map(async (input): Promise<ResourceBatchItem> => {
            try {
              return { ok: true, value: await this.bytes(input, bounded) };
            } catch (cause) {
              return { ok: false, error: errorFrom(cause) };
            }
          }),
        ),
    );
  }

  async blossom(
    hash: string,
    servers: readonly string[],
    authorPubkey?: string,
    signal?: AbortSignal,
  ): Promise<ResourceBytes> {
    if (!/^[0-9a-f]{64}$/.test(hash)) {
      throw new ResourceServiceError("blocked-by-policy");
    }
    return await this.#withDeadline({
      blossomServers: servers,
      authorPubkey,
      signal,
    }, async (bounded) =>
      this.#release(
        await this.#blossomRead(hash, bounded),
      ));
  }

  async blossomBytes(
    hash: string,
    servers: readonly string[],
    authorPubkey?: string,
    signal?: AbortSignal,
  ): Promise<Uint8Array> {
    if (!/^[0-9a-f]{64}$/.test(hash)) {
      throw new ResourceServiceError("blocked-by-policy");
    }
    return await this.#withDeadline({
      blossomServers: servers,
      authorPubkey,
      signal,
    }, async (bounded) => (await this.#blossomRead(hash, bounded)).bytes);
  }

  async #blossomRead(
    hash: string,
    options: ResourceReadOptions,
  ): Promise<ReadResponse> {
    const servers = canonicalBlossomServers(options.blossomServers ?? []);
    const candidates: Array<
      { url: URL; destinationClass: ResourceDestinationClass }
    > = [];
    if (this.#localCacheUrl) {
      const local = new URL(encodeURIComponent(hash), this.#localCacheUrl);
      for (const server of servers) local.searchParams.append("xs", server);
      if (options.authorPubkey) {
        local.searchParams.set("as", options.authorPubkey);
      }
      candidates.push({ url: local, destinationClass: "local-cache" });
    }
    for (const server of servers) {
      candidates.push({
        url: new URL(
          encodeURIComponent(hash),
          server.endsWith("/") ? server : `${server}/`,
        ),
        destinationClass: "public",
      });
    }

    let lastError: ResourceServiceError | undefined;
    for (const candidate of candidates) {
      try {
        const read = await this.#fetchBytes(
          candidate.url,
          candidate.destinationClass,
          options.deadlineSignal ?? options.signal ??
            new AbortController().signal,
          options.signal,
        );
        if (read.sha256 !== hash) {
          lastError = new ResourceServiceError("decode-failed");
          continue;
        }
        return read;
      } catch (cause) {
        lastError = errorFrom(cause);
      }
    }
    throw lastError ?? new ResourceServiceError("not-found");
  }

  #release(read: ReadResponse): ResourceBytes {
    const mime = sniffMime(read.bytes);
    if (!mime || !TRANSFER_POLICY.mimeTypes.includes(mime)) {
      throw new ResourceServiceError("decode-failed");
    }
    return Object.freeze({
      blob: new Blob([read.bytes.slice().buffer], { type: mime }),
      bytes: read.bytes,
      mime,
    });
  }

  async #fetchBytes(
    input: string | URL,
    destinationClass: ResourceDestinationClass,
    signal: AbortSignal,
    externalSignal?: AbortSignal,
  ): Promise<ReadResponse> {
    {
      let next = String(input);
      for (let redirects = 0;; redirects++) {
        let url: URL;
        let addresses: readonly string[];
        try {
          const destination = await this.#policy.authorize(
            next,
            destinationClass,
          );
          url = destination.url;
          addresses = destination.addresses;
        } catch (error) {
          if (error instanceof ResourcePolicyError) {
            throw new ResourceServiceError("blocked-by-policy");
          }
          throw error;
        }

        let response: Response;
        try {
          response = await this.#fetch(
            url,
            { redirect: "manual", signal },
            addresses,
          );
        } catch (cause) {
          if (
            signal.aborted ||
            (cause instanceof DOMException && cause.name === "AbortError")
          ) {
            throw new ResourceServiceError(
              externalSignal?.aborted ? "cancelled" : "timeout",
            );
          }
          throw new ResourceServiceError("network-error");
        }
        if (isRedirect(response.status)) {
          const location = response.headers.get("location");
          if (!location || redirects >= this.#maxRedirects) {
            await response.body?.cancel().catch(() => undefined);
            throw new ResourceServiceError("blocked-by-policy");
          }
          try {
            next = new URL(location, url).href;
          } catch {
            await response.body?.cancel().catch(() => undefined);
            throw new ResourceServiceError("blocked-by-policy");
          }
          await response.body?.cancel().catch(() => undefined);
          continue;
        }
        if (response.status === 404) {
          throw new ResourceServiceError("not-found");
        }
        if (!response.ok) throw new ResourceServiceError("network-error");
        const declared = response.headers.get("content-length");
        if (declared && Number(declared) > this.#maxBytes) {
          await response.body?.cancel().catch(() => undefined);
          throw new ResourceServiceError("too-large");
        }
        return await this.#read(response, signal, externalSignal);
      }
    }
  }

  async #withDeadline<T>(
    options: ResourceReadOptions,
    run: (bounded: ResourceReadOptions) => Promise<T>,
  ): Promise<T> {
    if (options.deadlineSignal) return await run(options);
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), this.#deadlineMs);
    const signal = options.signal
      ? AbortSignal.any([options.signal, deadline.signal])
      : deadline.signal;
    try {
      return await run({
        ...options,
        deadlineSignal: signal,
        timeoutSignal: deadline.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async #read(
    response: Response,
    signal: AbortSignal,
    externalSignal?: AbortSignal,
  ): Promise<ReadResponse> {
    if (!response.body) {
      const bytes = new Uint8Array();
      const hash = new IncrementalSha256();
      return {
        bytes,
        sha256: hash.digestHex(),
      };
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    const hash = new IncrementalSha256();
    let total = 0;
    const abort = () => reader.cancel().catch(() => undefined);
    signal.addEventListener("abort", abort, { once: true });
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > this.#maxBytes) {
          await reader.cancel();
          throw new ResourceServiceError("too-large");
        }
        chunks.push(value);
        hash.update(value);
      }
    } catch (cause) {
      if (cause instanceof ResourceServiceError) throw cause;
      if (signal.aborted) {
        throw new ResourceServiceError(
          externalSignal?.aborted ? "cancelled" : "timeout",
        );
      }
      throw new ResourceServiceError("network-error");
    } finally {
      signal.removeEventListener("abort", abort);
      reader.releaseLock();
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { bytes, sha256: hash.digestHex() };
  }
}
