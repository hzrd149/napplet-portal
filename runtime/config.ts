export interface RuntimeConfig {
  readonly coordinate: string;
  readonly bind: "127.0.0.1" | "::1";
  readonly relays: readonly string[];
  readonly blossomServers: readonly string[];
}

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

  return Object.freeze({
    coordinate: environment.NAPPLET_COORDINATE?.trim() ?? "",
    bind,
    relays: endpoints(environment.NOSTR_RELAYS, ["ws:", "wss:"], "relay", warn),
    blossomServers: endpoints(
      environment.BLOSSOM_SERVERS,
      ["http:", "https:"],
      "Blossom",
      warn,
    ),
  });
}
