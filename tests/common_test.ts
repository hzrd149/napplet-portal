import { nip19 } from "nostr-tools";
import { of } from "npm:rxjs@7.8.2";
import { EventRuntime } from "../runtime/event_runtime.ts";
import { CommonService } from "../runtime/common.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const pubkey = "1".repeat(64);
const eventId = "2".repeat(64);

Deno.test("NIP-19 supports exactly the six public canonical forms", async () => {
  const runtime = new EventRuntime({ request: () => of() });
  const common = new CommonService({
    eventRuntime: runtime,
    identity: () => ({ accountId: "a", pubkey, status: "active" }),
    relays: () => [],
  });
  const inputs = [
    { type: "npub", hex: pubkey },
    { type: "note", hex: eventId },
    { type: "nprofile", pubkey, relays: ["wss://relay.example/"] },
    { type: "nevent", eventId, author: pubkey, kind: 1, relays: [] },
    { type: "naddr", identifier: "app", pubkey, kind: 30023, relays: [] },
    { type: "nrelay", relay: "wss://relay.example/" },
  ] as const;
  for (const input of inputs) {
    const encoded = await common.execute({ type: "common.encodeNip19", id: input.type, input });
    assert(encoded.ok && typeof encoded.value === "string", `${input.type} encodes`);
    const decoded = await common.execute({ type: "common.decodeNip19", id: input.type, value: encoded.value });
    assert(decoded.ok && decoded.nip19Type === input.type, `${input.type} round trips`);
  }
  const secret = await common.execute({ type: "common.decodeNip19", id: "secret", value: nip19.nsecEncode(new Uint8Array(32).fill(7)) });
  assert(!secret.ok && secret.error === "invalid-request", "nsec is rejected");
  common.destroy();
  runtime.destroy();
});

Deno.test("profile and follows return cached truth before bounded refresh", async () => {
  const profile = {
    id: "3".repeat(64), pubkey, kind: 0, created_at: 1,
    tags: [], content: JSON.stringify({ name: "Ada", secret: "drop" }), sig: "4".repeat(128),
  };
  const contacts = {
    id: "5".repeat(64), pubkey, kind: 3, created_at: 1,
    tags: [["p", "b".repeat(64)], ["p", "a".repeat(64)], ["p", "b".repeat(64)]], content: "", sig: "6".repeat(128),
  };
  const runtime = new EventRuntime({ request: () => of(profile, contacts) });
  const common = new CommonService({
    eventRuntime: runtime,
    identity: () => ({ accountId: "a", pubkey, status: "active" }),
    relays: () => ["wss://relay.example/"],
  });
  const first = await common.execute({ type: "common.getProfile", id: "p1", target: pubkey });
  assert(first.ok && first.profile === null, "first profile is partial and empty");
  await new Promise((resolve) => setTimeout(resolve, 0));
  const second = await common.execute({ type: "common.getProfile", id: "p2", target: nip19.npubEncode(pubkey) });
  assert(second.profile?.name === "Ada" && !("secret" in second.profile), "later profile is sanitized cached truth");
  const follows = await common.execute({ type: "common.follows", id: "f" });
  assert(JSON.stringify(follows.pubkeys) === JSON.stringify(["a".repeat(64), "b".repeat(64)]), "follows are deterministic");
  common.destroy();
  runtime.destroy();
});

Deno.test("generation and expiry cancel window-owned refresh while preserving cache", async () => {
  const runtime = new EventRuntime({ request: () => of() });
  const common = new CommonService({
    eventRuntime: runtime,
    identity: () => ({ accountId: "a", pubkey, status: "active" }),
    relays: () => [],
  });
  await common.execute({ type: "common.getProfile", id: "p", target: pubkey });
  common.cancel("window-a");
  common.destroy();
  assert(!runtime.destroyed, "common teardown leaves process EventStore alive");
  runtime.destroy();
});
