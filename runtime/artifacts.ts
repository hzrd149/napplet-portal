import {
  type NappletArtifactCache,
  NappletResolutionError,
  type ResolvedNapplet,
  resolveNapplet,
  type WriteVerifiedResolutionInput,
} from "@kehto/nip/5d";
import type { NostrEvent } from "@napplet/core";

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
    return Promise.resolve(this.#blobs.get(hash)?.slice());
  }

  deleteBlob(hash: string): Promise<void> {
    this.#blobs.delete(hash);
    return Promise.resolve();
  }

  writeVerifiedResolution(input: WriteVerifiedResolutionInput): Promise<void> {
    for (const path of input.manifest.paths) {
      const bytes = input.files.get(path.path);
      if (bytes) this.#blobs.set(path.sha256, bytes.slice());
    }
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
  #held?: Promise<ArtifactState>;

  constructor(options: ArtifactAdapterOptions) {
    this.#options = options;
  }

  resolve(): Promise<ArtifactState> {
    if (!this.#options.coordinate) {
      return Promise.resolve({ state: "configured-empty" });
    }
    return this.#held ??= this.#resolveOnce();
  }

  retry(): Promise<ArtifactState> {
    this.#held = undefined;
    return this.resolve();
  }

  async #resolveOnce(): Promise<ArtifactState> {
    let event: NostrEvent;
    try {
      event = await this.#options.resolveManifest(
        this.#options.coordinate,
        this.#options.relays,
      );
    } catch (cause) {
      throw new ArtifactResolutionError(
        "manifest-unavailable",
        "configured napplet manifest is unavailable",
        { cause },
      );
    }

    try {
      const resolved = await resolveNapplet({
        event,
        cache: this.#options.cache,
        fetchBlob: async (hash, manifestServers) => {
          const servers = uniqueServers(
            this.#options.blossomServers,
            manifestServers,
          );
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
              if (this.#options.fetchBytes) {
                return await this.#options.fetchBytes(url);
              }
              const response = await fetch(url);
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              return new Uint8Array(await response.arrayBuffer());
            } catch (error) {
              lastError = error;
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
        throw new ArtifactResolutionError(
          "missing-capability",
          `napplet requires unsupported capabilities: ${missing.join(", ")}`,
        );
      }

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
        throw new ArtifactResolutionError(cause.code, cause.message, { cause });
      }
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
): Promise<ResolvedNapplet> {
  const resolver = new PortalArtifactResolver({
    coordinate: "fixture",
    relays: [],
    blossomServers: fixture.artifact.servers,
    resolveManifest: () => Promise.resolve(fixture.manifestEvent),
    fetchBytes: async (url) => {
      const response = await fetcher(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    },
  });
  const result = await resolver.resolve();
  if (result.state !== "ready") throw new Error("fixture coordinate is empty");
  return result.resolved;
}
