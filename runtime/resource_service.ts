import {
  type ResourceDestinationClass,
  ResourceDestinationPolicy,
  ResourcePolicyError,
} from "./resource_policy.ts";
import { TRANSFER_POLICY } from "./transport.ts";

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
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
}

export type ResourceErrorCode =
  | "blocked-by-policy"
  | "not-found"
  | "timeout"
  | "too-large"
  | "decode-failed"
  | "network-error";

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

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice().buffer)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
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
    this.#fetch = options.fetch ?? fetch;
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
    const source = String(input);
    const hash = blossomHash(source);
    if (hash) return this.#release(await this.#blossomRead(hash, readOptions));
    let parsed: URL;
    try {
      parsed = new URL(source);
    } catch {
      throw new ResourceServiceError("blocked-by-policy");
    }
    if (parsed.protocol !== "https:") {
      throw new ResourceServiceError("blocked-by-policy");
    }
    const read = await this.#fetchBytes(parsed, "public", readOptions.signal);
    return this.#release(read);
  }

  async bytesMany(
    inputs: readonly (string | URL)[],
    options: ResourceReadOptions = {},
  ): Promise<readonly ResourceBatchItem[]> {
    if (inputs.length > this.#maxUrls) {
      throw new ResourceServiceError("blocked-by-policy");
    }
    return await Promise.all(
      inputs.map(async (input): Promise<ResourceBatchItem> => {
        try {
          return { ok: true, value: await this.bytes(input, options) };
        } catch (cause) {
          return { ok: false, error: errorFrom(cause) };
        }
      }),
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
    return this.#release(
      await this.#blossomRead(hash, {
        blossomServers: servers,
        authorPubkey,
        signal,
      }),
    );
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
    return (await this.#blossomRead(hash, {
      blossomServers: servers,
      authorPubkey,
      signal,
    })).bytes;
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
    externalSignal?: AbortSignal,
  ): Promise<ReadResponse> {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), this.#deadlineMs);
    const signal = externalSignal
      ? AbortSignal.any([externalSignal, timeout.signal])
      : timeout.signal;
    try {
      let next = String(input);
      for (let redirects = 0;; redirects++) {
        let url: URL;
        try {
          url = (await this.#policy.authorize(next, destinationClass)).url;
        } catch (error) {
          if (error instanceof ResourcePolicyError) {
            throw new ResourceServiceError("blocked-by-policy");
          }
          throw error;
        }

        let response: Response;
        try {
          // Deno fetch cannot pin the address authorized above. Every hop and every
          // DNS answer is revalidated, but deployment egress policy remains required
          // as defense in depth against DNS rebinding between lookup and connection.
          response = await this.#fetch(url, { redirect: "manual", signal });
        } catch (cause) {
          if (
            signal.aborted ||
            (cause instanceof DOMException && cause.name === "AbortError")
          ) {
            throw new ResourceServiceError("timeout");
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
        return await this.#read(response, signal);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async #read(response: Response, signal: AbortSignal): Promise<ReadResponse> {
    if (!response.body) {
      const bytes = new Uint8Array();
      return {
        bytes,
        sha256: await sha256Hex(bytes),
      };
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
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
      }
    } catch (cause) {
      if (cause instanceof ResourceServiceError) throw cause;
      if (signal.aborted) throw new ResourceServiceError("timeout");
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
    return { bytes, sha256: await sha256Hex(bytes) };
  }
}
