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

function assertThrows(action: () => unknown, message: string): void {
  try {
    action();
  } catch {
    return;
  }
  throw new Error(message);
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

Deno.test("unsafe local artifacts are explicit and noisy on configured binds", () => {
  const warnings: string[] = [];
  const config = loadRuntimeConfig({
    PORTAL_BIND: "100.77.91.59",
    NAPPLET_UNSAFE_SKIP_VERIFICATION: "true",
    NAPPLET_UNSAFE_LOCAL_ARTIFACT_PATH: "/tmp/local-napplet.html",
  }, (warning) => warnings.push(warning));

  assertEquals(config.unsafeSkipVerification, true, "unsafe mode is explicit");
  assertEquals(
    config.bind,
    "100.77.91.59",
    "unsafe mode must retain the configured private bind",
  );
  assertEquals(
    config.unsafeLocalArtifactPath,
    "/tmp/local-napplet.html",
    "explicit local bytes path must be retained",
  );
  assertEquals(warnings.length, 1, "unsafe mode must emit one startup warning");
  assertEquals(
    warnings[0]?.includes("UNSAFE"),
    true,
    "warning must be unmistakable",
  );
});

Deno.test("normal mode stays verified and warning-free on configured binds", () => {
  const warnings: string[] = [];
  const config = loadRuntimeConfig({
    PORTAL_BIND: "100.77.91.59",
  }, (warning) => warnings.push(warning));

  assertEquals(config.bind, "100.77.91.59", "private bind must be retained");
  assertEquals(
    config.unsafeSkipVerification,
    false,
    "normal mode must remain verified",
  );
  assertEquals(
    config.unsafeLocalArtifactPath,
    undefined,
    "normal mode must own no unsafe artifact path",
  );
  assertEquals(warnings, [], "normal mode must emit no unsafe warning");
});

Deno.test("unsafe local artifact configuration fails closed", () => {
  const defaults = loadRuntimeConfig({}, () => undefined);
  assertEquals(
    defaults.unsafeSkipVerification,
    false,
    "unsafe mode must be off by default",
  );
  assertEquals(
    defaults.unsafeLocalArtifactPath,
    undefined,
    "default mode must own no local byte source",
  );
  assertThrows(
    () =>
      loadRuntimeConfig({
        NAPPLET_UNSAFE_SKIP_VERIFICATION: "true",
      }),
    "unsafe mode requires an explicit byte path",
  );
  assertThrows(
    () =>
      loadRuntimeConfig({
        NAPPLET_UNSAFE_SKIP_VERIFICATION: "yes",
        NAPPLET_UNSAFE_LOCAL_ARTIFACT_PATH: "/tmp/local-napplet.html",
      }),
    "ambiguous boolean values must be rejected",
  );
});
