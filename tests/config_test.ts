import { loadRuntimeConfig } from "../runtime/config.ts";

function assertEquals(
  actual: unknown,
  expected: unknown,
  message: string,
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`,
    );
  }
}

Deno.test("runtime config is immutable, normalized, deduplicated, and bind-aware", () => {
  const warnings: string[] = [];
  const config = loadRuntimeConfig({
    NAPPLET_COORDINATE:
      "naddr1qvzqqqyf8ypzpem34u9stj8ftlxldl4n2qz5f5hmrnxns3uga86fpwe7u28ga4n0qqx8xetrw4exjare94kxzcsuktmwx",
    NOSTR_RELAYS:
      "wss://relay.example/, wss://relay.example, ftp://bad.example",
    BLOSSOM_SERVERS: "https://blssm.us/,https://blssm.us",
    PORTAL_BIND: "0.0.0.0",
  }, (warning) => warnings.push(warning));

  assertEquals(config.bind, "0.0.0.0", "custom bind must be preserved");
  assertEquals(
    config.relays,
    ["wss://relay.example/"],
    "relays should normalize",
  );
  assertEquals(
    config.remoteSignerRelays,
    ["wss://bucket.coracle.social/"],
    "remote signer must use the dedicated Coracle bucket relay by default",
  );
  assertEquals(
    config.blossomServers,
    ["https://blssm.us/"],
    "servers should dedupe",
  );
  assertEquals(Object.isFrozen(config), true, "config should be frozen");
  assertEquals(warnings.length, 1, "invalid endpoint should warn");
});
