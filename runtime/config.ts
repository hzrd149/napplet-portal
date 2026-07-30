export interface RuntimeConfig {
  readonly coordinate: string;
  readonly bind: "127.0.0.1" | "::1";
  readonly relays: readonly string[];
  readonly blossomServers: readonly string[];
  readonly reconnectGraceMs: number;
}

export const DEFAULT_RELAYS = Object.freeze([
  "wss://relay.damus.io/",
  "wss://nos.lol/",
]);

export const DEFAULT_BLOSSOM_SERVERS = Object.freeze([
  "https://blossom.primal.net/",
  "https://blossom.band/",
]);

type Environment = Readonly<Record<string, string | undefined>>;

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

export function loadRuntimeConfig(
  environment: Environment = Deno.env.toObject(),
  warn: (message: string) => void = console.warn,
): RuntimeConfig {
  const requestedBind = environment.PORTAL_BIND?.trim();
  const bind = requestedBind === "::1" || requestedBind === "127.0.0.1"
    ? requestedBind
    : "127.0.0.1";
  if (requestedBind && requestedBind !== bind) {
    warn(`Rejected non-loopback bind address: ${requestedBind}`);
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
    bind,
    relays: environment.NOSTR_RELAYS === undefined
      ? DEFAULT_RELAYS
      : endpoints(environment.NOSTR_RELAYS, ["ws:", "wss:"], "relay", warn),
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
