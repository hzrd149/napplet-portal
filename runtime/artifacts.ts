import {
  type NappletArtifactCache,
  NappletResolutionError,
  type ResolvedNapplet,
  resolveNapplet,
  type WriteVerifiedResolutionInput,
} from "@kehto/nip/5d";
import type { NostrEvent } from "@napplet/core";
import { debug as rootDebug, shortId } from "../debug.ts";
import { BlossomCache } from "./blossom_cache.ts";

const debug = rootDebug.extend("artifacts");

export type ArtifactResolutionErrorCode =
  | "manifest-unavailable"
  | "missing-capability"
  | "invalid-signature"
  | "invalid-manifest"
  | "aggregate-mismatch"
  | "blob-hash-mismatch"
  | "blob-unavailable"
  | "missing-index";

export class ArtifactResolutionError extends Error {
  readonly executableHtml = undefined;

  constructor(
    readonly code: ArtifactResolutionErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ArtifactResolutionError";
  }
}

export class InMemoryNappletArtifactCache implements NappletArtifactCache {
  readonly #blobs = new Map<string, Uint8Array>();

  readBlob(hash: string): Promise<Uint8Array | undefined> {
    const blob = this.#blobs.get(hash)?.slice();
    debug("cache read blob hash=%s hit=%s", shortId(hash), Boolean(blob));
    return Promise.resolve(blob);
  }

  deleteBlob(hash: string): Promise<void> {
    this.#blobs.delete(hash);
    debug("cache delete blob hash=%s", shortId(hash));
    return Promise.resolve();
  }

  writeVerifiedResolution(input: WriteVerifiedResolutionInput): Promise<void> {
    for (const path of input.manifest.paths) {
      const bytes = input.files.get(path.path);
      if (bytes) this.#blobs.set(path.sha256, bytes.slice());
    }
    debug(
      "cache wrote verified resolution paths=%d blobs=%d",
      input.manifest.paths.length,
      this.#blobs.size,
    );
    return Promise.resolve();
  }

  writeCoordinate(): Promise<void> {
    return Promise.resolve();
  }

  getCoordinate(): Promise<undefined> {
    return Promise.resolve(undefined);
  }

  touchAggregate(): Promise<void> {
    return Promise.resolve();
  }

  markAggregateActive(): void {}
  releaseAggregateActive(): void {}
  prune(): Promise<void> {
    return Promise.resolve();
  }
}

export interface ArtifactAdapterOptions {
  readonly coordinate: string;
  readonly relays: readonly string[];
  readonly blossomServers: readonly string[];
  readonly resolveManifest: (
    coordinate: string,
    relays: readonly string[],
  ) => Promise<NostrEvent>;
  readonly fetchBytes?: (url: string) => Promise<Uint8Array>;
  readonly blossomFetch?: typeof fetch;
  readonly blossomCache?: BlossomCache;
  readonly cache?: NappletArtifactCache;
  readonly supportedDomains?: readonly string[];
}

export type ArtifactState =
  | { readonly state: "configured-empty" }
  | {
    readonly state: "ready";
    readonly identity: {
      readonly dTag: string;
      readonly aggregateHash: string;
    };
    readonly srcdoc: string;
    readonly resolved: ResolvedNapplet;
    readonly grantedDomains: readonly string[];
  };

function uniqueServers(
  configured: readonly string[],
  manifest: readonly string[],
): readonly string[] {
  return [...new Set([...configured, ...manifest])];
}

export class PortalArtifactResolver {
  readonly #options: ArtifactAdapterOptions;
  readonly #blossomCache: BlossomCache;
  #held?: Promise<ArtifactState>;

  constructor(options: ArtifactAdapterOptions) {
    this.#options = options;
    this.#blossomCache = options.blossomCache ?? new BlossomCache({
      fetch: options.blossomFetch,
    });
  }

  resolve(): Promise<ArtifactState> {
    if (!this.#options.coordinate) {
      debug("resolve skipped empty coordinate");
      return Promise.resolve({ state: "configured-empty" });
    }
    debug(
      "resolve requested coordinate=%s held=%s",
      this.#options.coordinate,
      Boolean(this.#held),
    );
    return this.#held ??= this.#resolveOnce();
  }

  retry(): Promise<ArtifactState> {
    debug("retry requested coordinate=%s", this.#options.coordinate);
    this.#held = undefined;
    return this.resolve();
  }

  async #resolveOnce(): Promise<ArtifactState> {
    debug(
      "resolve manifest started coordinate=%s relays=%d",
      this.#options.coordinate,
      this.#options.relays.length,
    );
    let event: NostrEvent;
    try {
      event = await this.#options.resolveManifest(
        this.#options.coordinate,
        this.#options.relays,
      );
    } catch (cause) {
      debug("resolve manifest failed coordinate=%s", this.#options.coordinate);
      throw new ArtifactResolutionError(
        "manifest-unavailable",
        "configured napplet manifest is unavailable",
        { cause },
      );
    }

    try {
      debug(
        "resolve artifact started manifest=%s blossom=%d",
        shortId(event.id),
        this.#options.blossomServers.length,
      );
      const resolved = await resolveNapplet({
        event,
        cache: this.#options.cache,
        fetchBlob: async (hash, manifestServers) => {
          const servers = uniqueServers(
            this.#options.blossomServers,
            manifestServers,
          );
          if (!this.#options.fetchBytes) {
            return await this.#blossomCache.fetch(hash, servers, event.pubkey);
          }
          if (servers.length === 0) {
            throw new ArtifactResolutionError(
              "blob-unavailable",
              `no artifact source configured for ${hash}`,
            );
          }
          let lastError: unknown;
          for (const server of servers) {
            const url = `${server.replace(/\/$/, "")}/${hash}`;
            try {
              debug(
                "fetch blob started hash=%s server=%s",
                shortId(hash),
                server,
              );
              if (this.#options.fetchBytes) {
                const bytes = await this.#options.fetchBytes(url);
                debug(
                  "fetch blob complete hash=%s bytes=%d",
                  shortId(hash),
                  bytes.byteLength,
                );
                return bytes;
              }
              const response = await fetch(url);
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              const bytes = new Uint8Array(await response.arrayBuffer());
              debug(
                "fetch blob complete hash=%s bytes=%d",
                shortId(hash),
                bytes.byteLength,
              );
              return bytes;
            } catch (error) {
              lastError = error;
              debug(
                "fetch blob failed hash=%s server=%s",
                shortId(hash),
                server,
              );
            }
          }
          throw lastError ?? new Error("artifact unavailable");
        },
      });

      const supported = this.#options.supportedDomains ??
        resolved.manifest.requires;
      const missing = resolved.manifest.requires.filter((domain) =>
        !supported.includes(domain)
      );
      if (missing.length > 0) {
        debug("resolve failed missing capabilities=%s", missing.join(","));
        throw new ArtifactResolutionError(
          "missing-capability",
          `napplet requires unsupported capabilities: ${missing.join(", ")}`,
        );
      }

      debug(
        "resolve complete dTag=%s aggregate=%s domains=%d",
        resolved.dTag,
        shortId(resolved.aggregateHash),
        supported.length,
      );
      return {
        state: "ready",
        identity: {
          dTag: resolved.dTag,
          aggregateHash: resolved.aggregateHash,
        },
        srcdoc: resolved.indexHtml,
        resolved,
        grantedDomains: Object.freeze([...supported]),
      };
    } catch (cause) {
      if (cause instanceof ArtifactResolutionError) throw cause;
      if (cause instanceof NappletResolutionError) {
        debug("resolve failed code=%s", cause.code);
        throw new ArtifactResolutionError(cause.code, cause.message, { cause });
      }
      debug("resolve failed blob unavailable");
      throw new ArtifactResolutionError(
        "blob-unavailable",
        "verified napplet artifact is unavailable",
        { cause },
      );
    }
  }
}

interface ArtifactFixture {
  readonly manifestEvent: NostrEvent;
  readonly artifact: { readonly servers: readonly string[] };
}

export async function resolveVerifiedArtifact(
  fixture: ArtifactFixture,
  fetcher: typeof fetch = fetch,
  blossomServers: readonly string[] = fixture.artifact.servers,
  blossomCache = new BlossomCache({ fetch: fetcher }),
): Promise<ResolvedNapplet> {
  debug("resolve fixture artifact started");
  const resolver = new PortalArtifactResolver({
    coordinate: "fixture",
    relays: [],
    blossomServers,
    resolveManifest: () => Promise.resolve(fixture.manifestEvent),
    blossomCache,
  });
  const result = await resolver.resolve();
  if (result.state !== "ready") throw new Error("fixture coordinate is empty");
  debug(
    "resolve fixture artifact complete dTag=%s aggregate=%s",
    result.resolved.dTag,
    shortId(result.resolved.aggregateHash),
  );
  return result.resolved;
}
