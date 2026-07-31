import {
  type NappletArtifactCache,
  type NappletManifest,
  NappletResolutionError,
  parseNappletManifest,
  type ResolvedNapplet,
  resolveNapplet,
  type WriteVerifiedResolutionInput,
} from "@kehto/nip/5d";
import type { NostrEvent } from "@napplet/core";
import { debug as rootDebug, shortId } from "../debug.ts";
import { BlossomCache } from "./blossom_cache.ts";
import { MAX_BINARY_PAYLOAD_BYTES } from "./binary_transport.ts";

const debug = rootDebug.extend("artifacts");

export type ArtifactResolutionErrorCode =
  | "manifest-unavailable"
  | "invalid-signature"
  | "invalid-manifest"
  | "aggregate-mismatch"
  | "blob-hash-mismatch"
  | "blob-unavailable"
  | "missing-index"
  | "invalid-mime"
  | "artifact-too-large";

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

export interface UnsafeLocalArtifact {
  readonly verification: "unsafe-local";
  readonly dTag: string;
  readonly aggregateHash: string;
  readonly files: Map<string, Uint8Array>;
  readonly indexHtml: string;
  readonly manifest: NappletManifest;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/** Loads an explicitly configured local HTML file without claiming verification. */
export async function loadUnsafeLocalArtifact(
  fixture: { readonly manifestEvent: NostrEvent },
  path: string,
): Promise<UnsafeLocalArtifact> {
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = await Deno.readFile(path);
  } catch (cause) {
    throw new ArtifactResolutionError(
      "blob-unavailable",
      "unsafe local napplet artifact is unavailable",
      { cause },
    );
  }
  if (bytes.byteLength > MAX_BINARY_PAYLOAD_BYTES) {
    throw new ArtifactResolutionError(
      "artifact-too-large",
      "unsafe local napplet artifact exceeds the byte limit",
    );
  }
  if (!/\.html?$/i.test(path)) {
    throw new ArtifactResolutionError(
      "invalid-mime",
      "unsafe local napplet artifact must use an HTML filename",
    );
  }
  let indexHtml: string;
  try {
    indexHtml = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (cause) {
    throw new ArtifactResolutionError(
      "invalid-mime",
      "unsafe local napplet artifact must be UTF-8 HTML",
      { cause },
    );
  }
  const start = indexHtml.trimStart().toLowerCase();
  const hasForbiddenControl = [...indexHtml].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 && code !== 9 && code !== 10 && code !== 13;
  });
  if (
    !indexHtml || hasForbiddenControl ||
    (!start.startsWith("<!doctype html") && !start.startsWith("<html"))
  ) {
    throw new ArtifactResolutionError(
      "invalid-mime",
      "unsafe local napplet artifact must be HTML",
    );
  }

  let declared: NappletManifest;
  try {
    declared = parseNappletManifest(fixture.manifestEvent);
  } catch (cause) {
    throw new ArtifactResolutionError(
      "invalid-manifest",
      "unsafe local napplet metadata is invalid",
      { cause },
    );
  }
  const aggregateHash = hex(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  );
  const pathEntry = Object.freeze({
    path: "/index.html",
    sha256: aggregateHash,
  });
  const manifest: NappletManifest = Object.freeze({
    ...declared,
    paths: Object.freeze([pathEntry]) as unknown as NappletManifest["paths"],
    aggregateHash,
    servers: Object.freeze([]) as unknown as string[],
    requires: Object.freeze([...declared.requires]) as unknown as string[],
    archetypes: Object.freeze([
      ...declared.archetypes,
    ]) as unknown as NappletManifest["archetypes"],
  });
  return Object.freeze({
    verification: "unsafe-local" as const,
    dTag: declared.dTag,
    aggregateHash,
    files: new Map([["/index.html", bytes.slice()]]),
    indexHtml,
    manifest,
  });
}

export interface ArtifactAdapterOptions {
  readonly coordinate: string;
  readonly manifestEventId?: string;
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
      if (
        this.#options.manifestEventId &&
        event.id !== this.#options.manifestEventId
      ) {
        throw new Error("resolved manifest does not match accepted event ID");
      }
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
          debug(
            "fetch blob sources hash=%s configured=%d manifest=%d merged=%d",
            shortId(hash),
            this.#options.blossomServers.length,
            manifestServers.length,
            servers.length,
          );
          if (!this.#options.fetchBytes) {
            const bytes = await this.#blossomCache.fetch(
              hash,
              servers,
              event.pubkey,
            );
            debug(
              "fetch blob complete hash=%s bytes=%d source=blossom-cache",
              shortId(hash),
              bytes.byteLength,
            );
            return bytes;
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

      debug(
        "resolve complete dTag=%s aggregate=%s domains=%d",
        resolved.dTag,
        shortId(resolved.aggregateHash),
        resolved.manifest.requires.length,
      );
      return {
        state: "ready",
        identity: {
          dTag: resolved.dTag,
          aggregateHash: resolved.aggregateHash,
        },
        srcdoc: resolved.indexHtml,
        resolved,
        grantedDomains: Object.freeze([...resolved.manifest.requires]),
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
