import {
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

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 ||
    status === 307 || status === 308;
}

export class ResourceService {
  readonly #policy: ResourceDestinationPolicy;
  readonly #fetch: FetchLike;
  readonly #maxRedirects: number;

  constructor(options: ResourceServiceOptions = {}) {
    this.#policy = options.policy ?? new ResourceDestinationPolicy();
    this.#fetch = options.fetch ?? fetch;
    this.#maxRedirects = options.maxRedirects ?? TRANSFER_POLICY.maxRedirects;
  }

  async bytes(
    input: string | URL,
    signal?: AbortSignal,
  ): Promise<ResourceBytes> {
    let next = String(input);
    for (let redirects = 0;; redirects++) {
      let url: URL;
      try {
        url = (await this.#policy.authorize(next)).url;
      } catch (error) {
        if (error instanceof ResourcePolicyError) {
          throw new ResourceServiceError("blocked-by-policy");
        }
        throw error;
      }

      let response: Response;
      try {
        response = await this.#fetch(url, { redirect: "manual", signal });
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") {
          throw new ResourceServiceError("timeout");
        }
        throw new ResourceServiceError("network-error");
      }
      if (isRedirect(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirects >= this.#maxRedirects) {
          response.body?.cancel().catch(() => undefined);
          throw new ResourceServiceError("blocked-by-policy");
        }
        try {
          next = new URL(location, url).href;
        } catch {
          response.body?.cancel().catch(() => undefined);
          throw new ResourceServiceError("blocked-by-policy");
        }
        response.body?.cancel().catch(() => undefined);
        continue;
      }
      if (response.status === 404) throw new ResourceServiceError("not-found");
      if (!response.ok) throw new ResourceServiceError("network-error");
      const bytes = new Uint8Array(await response.arrayBuffer());
      const mime = response.headers.get("content-type")?.split(";", 1)[0] ??
        "application/octet-stream";
      return Object.freeze({
        blob: new Blob([bytes], { type: mime }),
        bytes,
        mime,
      });
    }
  }
}
