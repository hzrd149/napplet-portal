import type {
  CommonNip19EncodeInput,
  EventTemplate,
  NostrEvent,
} from "@napplet/core";
import { nip19 } from "nostr-tools";
import { bech32 } from "npm:@scure/base@1.1.1";
import type { IdentitySnapshot } from "./accounts.ts";
import type { EventRuntime } from "./event_runtime.ts";

const HEX = /^[0-9a-f]{64}$/;
const PUBLIC_TYPES = new Set([
  "npub",
  "note",
  "nprofile",
  "nevent",
  "naddr",
  "nrelay",
]);
const PROFILE_FIELDS = [
  "name",
  "display_name",
  "about",
  "picture",
  "banner",
  "nip05",
  "lud16",
  "website",
] as const;

export interface CommonPublishPort {
  publish(id: string, template: EventTemplate): Promise<
    | { readonly ok: true; readonly event: NostrEvent }
    | { readonly ok: false; readonly error: string }
  >;
}

export interface CommonServiceOptions {
  readonly eventRuntime: EventRuntime;
  readonly identity: () => IdentitySnapshot;
  readonly relays: () => readonly string[];
  readonly publisher?: CommonPublishPort;
}

export class CommonService {
  readonly #options: CommonServiceOptions;
  readonly #loads = new Map<string, Set<() => void>>();
  #destroyed = false;

  constructor(options: CommonServiceOptions) {
    this.#options = options;
  }

  async execute(
    message: Record<string, unknown>,
    owner = "default",
  ): Promise<Record<string, unknown>> {
    if (this.#destroyed) return { ok: false, error: "not-authorized" };
    try {
      switch (message.type) {
        case "common.encodeNip19":
          return encode(message.input);
        case "common.decodeNip19":
          return decode(message.value);
        case "common.getProfile":
          return this.#profile(message.target, owner);
        case "common.follows":
          return this.#follows(owner);
        default:
          return { ok: false, error: "invalid-request" };
      }
    } catch {
      return { ok: false, error: "invalid-request" };
    }
  }

  cancel(owner: string): void {
    for (const cleanup of this.#loads.get(owner) ?? []) cleanup();
    this.#loads.delete(owner);
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    for (const owner of [...this.#loads.keys()]) this.cancel(owner);
  }

  #profile(target: unknown, owner: string): Record<string, unknown> {
    const resolved = profileTarget(target);
    const event = this.#options.eventRuntime.eventStore.getReplaceable(
      0,
      resolved.pubkey,
    );
    this.#track(
      owner,
      this.#options.eventRuntime.refreshReplaceable(0, resolved.pubkey, [
        ...new Set([...resolved.relays, ...this.#options.relays()]),
      ]),
    );
    let profile: Record<string, string> | null = null;
    if (event) {
      const parsed = JSON.parse(event.content) as Record<string, unknown>;
      profile = {};
      for (const field of PROFILE_FIELDS) {
        if (typeof parsed[field] === "string") {
          profile[field === "display_name" ? "displayName" : field] =
            parsed[field] as string;
        }
      }
    }
    return {
      ok: true,
      pubkey: resolved.pubkey,
      profile,
      ...(event ? { result: { event } } : {}),
    };
  }

  #follows(owner: string): Record<string, unknown> {
    const identity = this.#options.identity();
    if (!identity.pubkey) {
      return { ok: false, pubkeys: [], error: "not-authorized" };
    }
    const event = this.#options.eventRuntime.eventStore.getReplaceable(
      3,
      identity.pubkey,
    );
    this.#track(
      owner,
      this.#options.eventRuntime.refreshReplaceable(
        3,
        identity.pubkey,
        this.#options.relays(),
      ),
    );
    const pubkeys = [
      ...new Set(
        (event?.tags ?? []).filter((tag) =>
          tag[0] === "p" && HEX.test(tag[1] ?? "")
        ).map((tag) => tag[1]),
      ),
    ].sort();
    return { ok: true, pubkeys };
  }

  #track(owner: string, cleanup: () => void): void {
    const loads = this.#loads.get(owner) ?? new Set<() => void>();
    loads.add(cleanup);
    this.#loads.set(owner, loads);
  }
}

function encode(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") throw new Error("invalid");
  const input = value as CommonNip19EncodeInput;
  let encoded: string;
  switch (input.type) {
    case "npub":
      encoded = nip19.npubEncode(input.hex);
      break;
    case "note":
      encoded = nip19.noteEncode(input.hex);
      break;
    case "nprofile":
      encoded = nip19.nprofileEncode(input);
      break;
    case "nevent":
      encoded = nip19.neventEncode({
        id: input.eventId,
        relays: input.relays,
        author: input.author,
        kind: input.kind,
      });
      break;
    case "naddr":
      encoded = nip19.naddrEncode(input);
      break;
    case "nrelay": {
      const bytes = new TextEncoder().encode(input.relay);
      if (bytes.length === 0 || bytes.length > 255) throw new Error("invalid");
      encoded = bech32.encode(
        "nrelay",
        bech32.toWords(new Uint8Array([0, bytes.length, ...bytes])),
        4096,
      );
      break;
    }
    default:
      throw new Error("invalid");
  }
  return { ok: true, value: encoded, nip19Type: input.type };
}

function decode(value: unknown): Record<string, unknown> {
  if (
    typeof value !== "string" || value.length > 4096 ||
    value.startsWith("nsec1")
  ) throw new Error("invalid");
  if (value.startsWith("nrelay1")) {
    const raw = bech32.fromWords(bech32.decode(value, 4096).words);
    if (raw[0] !== 0 || raw[1] !== raw.length - 2) throw new Error("invalid");
    return {
      ok: true,
      nip19Type: "nrelay",
      relay: new TextDecoder().decode(new Uint8Array(raw.slice(2))),
    };
  }
  const decoded = nip19.decode(value);
  if (!PUBLIC_TYPES.has(decoded.type)) throw new Error("invalid");
  const data = decoded.data as unknown;
  if (decoded.type === "npub" || decoded.type === "note") {
    return { ok: true, nip19Type: decoded.type, hex: data };
  }
  const object = data as Record<string, unknown>;
  const result: Record<string, unknown> = { ok: true, nip19Type: decoded.type };
  for (
    const key of [
      "pubkey",
      "eventId",
      "identifier",
      "relays",
      "author",
      "kind",
    ] as const
  ) {
    const source = key === "eventId" ? "id" : key;
    if (object[source] !== undefined) result[key] = object[source];
  }
  return result;
}

function profileTarget(value: unknown): { pubkey: string; relays: string[] } {
  if (typeof value !== "string" || value.length > 4096) {
    throw new Error("invalid");
  }
  if (HEX.test(value)) return { pubkey: value, relays: [] };
  const decoded = nip19.decode(value);
  if (decoded.type === "npub") return { pubkey: decoded.data, relays: [] };
  if (decoded.type === "nprofile") {
    return { pubkey: decoded.data.pubkey, relays: decoded.data.relays ?? [] };
  }
  throw new Error("invalid");
}
