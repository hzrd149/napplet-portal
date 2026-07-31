export const LOCAL_BLOSSOM_URL = "http://127.0.0.1:24242/";
export const LOCAL_BLOSSOM_TIMEOUT_MS = 1_500;
import { TRANSFER_POLICY } from "./transport.ts";

export interface BlossomCacheHealth {
  readonly state: "unknown" | "available" | "degraded";
  readonly checkedAt?: number;
  readonly reason?: "unavailable" | "timeout" | "miss" | "fetch-failed";
}

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface BlossomDependencies {
  readonly fetch?: FetchLike;
  readonly timeoutMs?: number;
  readonly setTimeout?: typeof globalThis.setTimeout;
  readonly clearTimeout?: typeof globalThis.clearTimeout;
  readonly now?: () => number;
  readonly resolveDns?: ResolveDns;
}

function upstreamServers(servers: readonly string[]): readonly string[] {
  const canonical = new Set<string>();
  for (const server of servers) {
    try {
      const url = new URL(server);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      url.username = "";
      url.password = "";
      canonical.add(url.href);
    } catch {
      // Invalid configured sources are ineligible for outbound requests.
    }
  }
  return [...canonical];
}

async function boundedFetch(
  url: URL | string,
  init: RequestInit,
  dependencies: BlossomDependencies,
): Promise<Response> {
  const controller = new AbortController();
  const schedule = dependencies.setTimeout ?? globalThis.setTimeout;
  const cancel = dependencies.clearTimeout ?? globalThis.clearTimeout;
  const timer = schedule(
    () => controller.abort(),
    dependencies.timeoutMs ?? LOCAL_BLOSSOM_TIMEOUT_MS,
  );
  try {
    return await (dependencies.fetch ?? fetch)(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    cancel(timer);
  }
}

export async function discoverLocalBlossom(
  dependencies: BlossomDependencies = {},
): Promise<typeof LOCAL_BLOSSOM_URL | undefined> {
  try {
    const response = await boundedFetch(
      LOCAL_BLOSSOM_URL,
      { method: "HEAD" },
      dependencies,
    );
    return response.ok ? LOCAL_BLOSSOM_URL : undefined;
  } catch {
    return undefined;
  }
}

interface FetchWithBlossomCacheOptions extends BlossomDependencies {
  readonly hash: string;
  readonly upstreamServers: readonly string[];
  readonly authorPubkey?: string;
  readonly localUrl?: typeof LOCAL_BLOSSOM_URL;
}

export async function fetchWithBlossomCache(
  options: FetchWithBlossomCacheOptions,
): Promise<Uint8Array> {
  const eligible = upstreamServers(options.upstreamServers);
  const localCacheUrl = options.localUrl === LOCAL_BLOSSOM_URL
    ? LOCAL_BLOSSOM_URL
    : undefined;
  const policy = new ResourceDestinationPolicy({
    resolveDns: options.resolveDns,
    localCacheUrl,
  });
  const service = new ResourceService({
    policy,
    fetch: options.fetch,
    deadlineMs: options.timeoutMs ?? TRANSFER_POLICY.resourceDeadlineMs,
    localCacheUrl,
  });
  try {
    return await service.blossomBytes(
      options.hash,
      eligible,
      options.authorPubkey,
    );
  } catch (cause) {
    throw new Error("Blossom artifact unavailable", { cause });
  }
}

export class BlossomCache {
  readonly #dependencies: BlossomDependencies;
  #discovery?: Promise<typeof LOCAL_BLOSSOM_URL | undefined>;
  #health: BlossomCacheHealth = Object.freeze({ state: "unknown" });

  constructor(dependencies: BlossomDependencies = {}) {
    this.#dependencies = dependencies;
  }

  get health(): BlossomCacheHealth {
    return this.#health;
  }

  async fetch(
    hash: string,
    servers: readonly string[],
    authorPubkey?: string,
  ): Promise<Uint8Array> {
    const local = await (this.#discovery ??= discoverLocalBlossom(
      this.#dependencies,
    ));
    const now = (this.#dependencies.now ?? Date.now)();
    this.#health = Object.freeze(
      local
        ? { state: "available", checkedAt: now }
        : { state: "degraded", checkedAt: now, reason: "unavailable" },
    );
    try {
      return await fetchWithBlossomCache({
        ...this.#dependencies,
        hash,
        upstreamServers: servers,
        authorPubkey,
        localUrl: local,
      });
    } catch (error) {
      this.#health = Object.freeze({
        state: "degraded",
        checkedAt: (this.#dependencies.now ?? Date.now)(),
        reason: "fetch-failed",
      });
      throw error;
    }
  }
}
import {
  type ResolveDns,
  ResourceDestinationPolicy,
} from "./resource_policy.ts";
import { ResourceService } from "./resource_service.ts";
