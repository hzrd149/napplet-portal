function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("operator documentation covers configuration security and exact scope", async () => {
  const readme = await Deno.readTextFile("README.md");
  const prose = readme.replace(/\s+/g, " ");
  for (
    const required of [
      "NAPPLET_COORDINATE",
      "NOSTR_RELAYS",
      "BLOSSOM_SERVERS",
      "PORTAL_RECONNECT_GRACE_MS",
      "PORTAL_BIND",
      "127.0.0.1",
      "host filesystem permissions",
      "unbounded",
      "SHELL",
      "IDENTITY",
      "RELAY",
      "OUTBOX",
      "no EOSE",
      "one-day checkpoint",
      "no one-day deadline",
    ]
  ) assert(prose.includes(required), `README missing ${required}`);
  for (
    const deferred of [
      "catalog",
      "durable event/blob caches",
      "multi-user",
      "approval UI",
      "read-only account mode",
      "example napplets",
      "production network hardening",
    ]
  ) assert(prose.includes(deferred), `README missing deferral ${deferred}`);
  assert(
    !/nsec1[023456789acdefghjklmnpqrstuvwxyz]{20}/.test(readme),
    "README must contain no secret example",
  );
  assert(
    readme.includes("deno task check") && readme.includes("deno task test"),
    "quality commands required",
  );
});
