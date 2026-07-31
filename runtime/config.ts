export interface RuntimeConfig {
  readonly coordinate: string;
  readonly bind: string;
  readonly relays: readonly string[];
  readonly remoteSignerRelays: readonly string[];
  readonly blossomServers: readonly string[];
  readonly reconnectGraceMs: number;
  readonly unsafeSkipVerification: boolean;
  readonly unsafeLocalArtifactPath?: string;
}

export const DEFAULT_RELAYS = Object.freeze([
  "wss://relay.damus.io/",
  "wss://nos.lol/",
]);

export const DEFAULT_REMOTE_SIGNER_RELAYS = Object.freeze([
  "wss://bucket.coracle.social/",
]);

export const DEFAULT_BLOSSOM_SERVERS = Object.freeze([
  "https://blossom.primal.net/",
  "https://blossom.band/",
]);

type Environment = Readonly<Record<string, string | undefined>>;
const DEFAULT_BIND = "127.0.0.1";

function endpoints(
  value: string | undefined,
  schemes: readonly string[],
  label: string,
  warn: (message: string) => void,
): readonly string[] {
  const unique = new Set<string>();
  for (const candidate of value?.split(",") ?? []) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    try {
      const url = new URL(trimmed);
      if (!schemes.includes(url.protocol)) throw new Error("invalid scheme");
      url.username = "";
      url.password = "";
      unique.add(url.href);
    } catch {
      warn(`Rejected ${label} endpoint: ${trimmed}`);
    }
  }
  return Object.freeze([...unique]);
}

/**
 * Resolve only the bind address. `deno serve` and the Vite dev server both take
 * the address before the app loads, so they resolve it here instead of reading
 * `PORTAL_BIND` directly: the same host validation applies, and no unrelated
 * configuration warning is duplicated ahead of the startup summary.
 */
export function loadBindAddress(
  environment: Environment = {
    PORTAL_BIND: Deno.env.get("PORTAL_BIND"),
    NAPPLET_UNSAFE_SKIP_VERIFICATION: Deno.env.get(
      "NAPPLET_UNSAFE_SKIP_VERIFICATION",
    ),
    NAPPLET_UNSAFE_LOCAL_ARTIFACT_PATH: Deno.env.get(
      "NAPPLET_UNSAFE_LOCAL_ARTIFACT_PATH",
    ),
  },
  warn: (message: string) => void = console.warn,
): RuntimeConfig["bind"] {
  return loadRuntimeConfig({
    PORTAL_BIND: environment.PORTAL_BIND,
    NAPPLET_UNSAFE_SKIP_VERIFICATION:
      environment.NAPPLET_UNSAFE_SKIP_VERIFICATION,
    NAPPLET_UNSAFE_LOCAL_ARTIFACT_PATH:
      environment.NAPPLET_UNSAFE_LOCAL_ARTIFACT_PATH,
  }, warn).bind;
}

function unsafeFlag(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "false") return false;
  if (normalized === "true") return true;
  throw new Error(
    "NAPPLET_UNSAFE_SKIP_VERIFICATION must be exactly true or false",
  );
}

function validBindAddress(value: string): string | undefined {
  if (/[\s/@?#]/.test(value)) return undefined;

  const bracketedIpv6 = value.startsWith("[") && value.endsWith("]");
  if (value.includes("[") || value.includes("]")) {
    if (!bracketedIpv6) return undefined;
  }

  const host = bracketedIpv6 ? value.slice(1, -1) : value;
  if (!host) return undefined;

  const href = host.includes(":") ? `http://[${host}]/` : `http://${host}/`;
  try {
    const parsed = new URL(href);
    return parsed.hostname ? host : undefined;
  } catch {
    return undefined;
  }
}

export function loadRuntimeConfig(
  environment: Environment = Deno.env.toObject(),
  warn: (message: string) => void = console.warn,
): RuntimeConfig {
  const requestedBind = environment.PORTAL_BIND?.trim();
  const bind = requestedBind ? validBindAddress(requestedBind) : DEFAULT_BIND;
  if (!bind) {
    warn(`Rejected invalid bind address: ${requestedBind}`);
  }

  const unsafeSkipVerification = unsafeFlag(
    environment.NAPPLET_UNSAFE_SKIP_VERIFICATION,
  );
  const unsafeLocalArtifactPath =
    environment.NAPPLET_UNSAFE_LOCAL_ARTIFACT_PATH?.trim() || undefined;
  if (unsafeSkipVerification) {
    if (!unsafeLocalArtifactPath) {
      throw new Error(
        "Unsafe local artifact mode requires NAPPLET_UNSAFE_LOCAL_ARTIFACT_PATH",
      );
    }
    warn(
      "UNSAFE local artifact mode enabled: napplet verification is disabled for local testing",
    );
  } else if (unsafeLocalArtifactPath) {
    warn(
      "Ignored NAPPLET_UNSAFE_LOCAL_ARTIFACT_PATH because unsafe mode is disabled",
    );
  }

  const reconnectCandidate = Number(environment.PORTAL_RECONNECT_GRACE_MS);
  const reconnectGraceMs = Number.isSafeInteger(reconnectCandidate) &&
      reconnectCandidate >= 1_000 && reconnectCandidate <= 120_000
    ? reconnectCandidate
    : 10_000;
  if (environment.PORTAL_RECONNECT_GRACE_MS && reconnectGraceMs === 10_000) {
    warn("Rejected reconnect grace; expected 1000-120000 milliseconds");
  }

  return Object.freeze({
    coordinate: environment.NAPPLET_COORDINATE?.trim() ?? "",
    bind: bind ?? DEFAULT_BIND,
    relays: environment.NOSTR_RELAYS === undefined
      ? DEFAULT_RELAYS
      : endpoints(environment.NOSTR_RELAYS, ["ws:", "wss:"], "relay", warn),
    remoteSignerRelays: environment.REMOTE_SIGNER_RELAYS === undefined
      ? DEFAULT_REMOTE_SIGNER_RELAYS
      : endpoints(
        environment.REMOTE_SIGNER_RELAYS,
        ["ws:", "wss:"],
        "remote signer relay",
        warn,
      ),
    blossomServers: endpoints(
      environment.BLOSSOM_SERVERS === undefined
        ? DEFAULT_BLOSSOM_SERVERS.join(",")
        : environment.BLOSSOM_SERVERS,
      ["http:", "https:"],
      "Blossom",
      warn,
    ),
    reconnectGraceMs,
    unsafeSkipVerification,
    unsafeLocalArtifactPath: unsafeSkipVerification
      ? unsafeLocalArtifactPath
      : undefined,
  });
}
