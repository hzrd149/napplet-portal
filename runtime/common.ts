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
const REPORT_REASONS = new Set([
  "nudity",
  "malware",
  "profanity",
  "illegal",
  "spam",
  "impersonation",
  "other",
]);

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
          return encodePublicNip19(message.input);
        case "common.decodeNip19":
          return decode(message.value);
        case "common.getProfile":
          return this.#profile(message.target, owner);
        case "common.follows":
          return this.#follows(owner);
        case "common.follow":
          return await this.#contacts(message, true);
        case "common.unfollow":
          return await this.#contacts(message, false);
        case "common.react":
          return await this.#react(message);
        case "common.report":
          return await this.#report(message);
        default:
          return { ok: false, error: "invalid-request" };
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof CommonDenied
          ? "not-authorized"
          : "invalid-request",
      };
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

  async #contacts(
    message: Record<string, unknown>,
    follow: boolean,
  ): Promise<Record<string, unknown>> {
    if (
      !Array.isArray(message.pubkeys) || message.pubkeys.length < 1 ||
      message.pubkeys.length > 64
    ) throw new Error("invalid");
    const targets = message.pubkeys.map(decodeNpub);
    const identity = this.#activeIdentity();
    const current = this.#options.eventRuntime.eventStore.getReplaceable(
      3,
      identity.pubkey,
    );
    const targetSet = new Set(targets);
    const tags = (current?.tags ?? []).filter((tag) =>
      tag[0] !== "p" || (follow || !targetSet.has(tag[1] ?? ""))
    ).map((tag) => [...tag]);
    if (follow) {
      const existing = new Set(
        tags.filter((tag) => tag[0] === "p").map((tag) => tag[1]),
      );
      for (const target of [...targetSet].sort()) {
        if (!existing.has(target)) tags.push(["p", target]);
      }
    }
    return await this.#publish(message.id, {
      kind: 3,
      created_at: Math.floor(Date.now() / 1000),
      content: current?.content ?? "",
      tags,
    }, identity.pubkey);
  }

  async #react(
    message: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (
      !HEX.test(String(message.targetEventId ?? "")) ||
      typeof message.reaction !== "string" || message.reaction.length < 1 ||
      message.reaction.length > 64
    ) throw new Error("invalid");
    if (message.customEmojiHref !== undefined) {
      if (
        typeof message.customEmojiHref !== "string" ||
        message.customEmojiHref.length > 2048 ||
        new URL(message.customEmojiHref).protocol !== "https:"
      ) throw new Error("invalid");
    }
    const identity = this.#activeIdentity();
    const targetId = String(message.targetEventId);
    const target = this.#options.eventRuntime.eventStore.getEvent(targetId);
    const tags: string[][] = [["e", targetId]];
    if (target) tags.push(["p", target.pubkey]);
    if (message.customEmojiHref) {
      tags.push(["emoji", message.reaction, String(message.customEmojiHref)]);
    }
    return await this.#publish(message.id, {
      kind: 7,
      created_at: Math.floor(Date.now() / 1000),
      content: message.reaction,
      tags,
    }, identity.pubkey);
  }

  async #report(
    message: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (
      !message.target || typeof message.target !== "object" ||
      !REPORT_REASONS.has(String(message.reason)) ||
      typeof message.text !== "string" || message.text.length > 1000
    ) throw new Error("invalid");
    const target = message.target as Record<string, unknown>;
    const reason = String(message.reason);
    let tag: string[];
    if (target.type === "event" && HEX.test(String(target.id ?? ""))) {
      tag = ["e", String(target.id), String(target.relay ?? ""), reason];
    } else if (target.type === "pubkey") {
      tag = [
        "p",
        decodePublicKey(target.pubkey),
        String(target.relay ?? ""),
        reason,
      ];
    } else throw new Error("invalid");
    const identity = this.#activeIdentity();
    return await this.#publish(message.id, {
      kind: 1984,
      created_at: Math.floor(Date.now() / 1000),
      content: message.text,
      tags: [tag],
    }, identity.pubkey);
  }

  #activeIdentity(): { pubkey: string } {
    const identity = this.#options.identity();
    if (identity.status !== "active" || !identity.pubkey) {
      throw new CommonDenied();
    }
    return { pubkey: identity.pubkey };
  }

  async #publish(
    id: unknown,
    template: EventTemplate,
    expectedPubkey: string,
  ): Promise<Record<string, unknown>> {
    if (typeof id !== "string" || !this.#options.publisher) {
      return { ok: false, error: "publication-failed" };
    }
    const current = this.#options.identity();
    if (current.status !== "active" || current.pubkey !== expectedPubkey) {
      return { ok: false, error: "not-authorized" };
    }
    const result = await this.#options.publisher.publish(id, template);
    if (!result.ok) return { ok: false, error: "publication-failed" };
    this.#options.eventRuntime.eventStore.add(result.event);
    return { ok: true, eventId: result.event.id, event: result.event };
  }
}

class CommonDenied extends Error {}

export function encodePublicNip19(value: unknown): Record<string, unknown> {
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

function decodeNpub(value: unknown): string {
  if (typeof value !== "string" || value.length > 4096) {
    throw new Error("invalid");
  }
  const decoded = nip19.decode(value);
  if (decoded.type !== "npub") throw new Error("invalid");
  return decoded.data;
}

function decodePublicKey(value: unknown): string {
  return typeof value === "string" && HEX.test(value)
    ? value
    : decodeNpub(value);
}
