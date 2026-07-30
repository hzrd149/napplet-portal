export interface RuntimeConfig {
  readonly coordinate: string;
  readonly bind: string;
  readonly relays: readonly string[];
  readonly remoteSignerRelays: readonly string[];
  readonly blossomServers: readonly string[];
  readonly reconnectGraceMs: number;
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
  environment: Environment = { PORTAL_BIND: Deno.env.get("PORTAL_BIND") },
  warn: (message: string) => void = console.warn,
): RuntimeConfig["bind"] {
  return loadRuntimeConfig({ PORTAL_BIND: environment.PORTAL_BIND }, warn).bind;
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
  });
}
