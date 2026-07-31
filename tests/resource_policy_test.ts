import {
  ResourceDestinationPolicy,
  ResourcePolicyError,
} from "../runtime/resource_policy.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function resolver(records: Record<string, readonly string[]>) {
  return async (hostname: string, recordType: "A" | "AAAA") => {
    const values = records[`${hostname}:${recordType}`] ?? [];
    return await Promise.resolve([...values]);
  };
}

Deno.test("destination policy rejects every forbidden address class and mixed DNS answers", async () => {
  const forbidden = [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.0.1",
    "169.254.169.254",
    "0.0.0.0",
    "224.0.0.1",
    "192.0.2.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "::",
    "2001:db8::1",
  ];
  for (const address of forbidden) {
    const policy = new ResourceDestinationPolicy({
      resolveDns: resolver({
        "blocked.example:A": address.includes(":") ? [] : [address],
        "blocked.example:AAAA": address.includes(":") ? [address] : [],
      }),
    });
    try {
      await policy.authorize("https://blocked.example/file");
      throw new Error(`expected ${address} to be blocked`);
    } catch (error) {
      assert(error instanceof ResourcePolicyError, `${address} policy error`);
      assert(error.code === "blocked-by-policy", `${address} stable code`);
    }
  }

  const mixed = new ResourceDestinationPolicy({
    resolveDns: resolver({
      "mixed.example:A": ["93.184.216.34", "10.0.0.2"],
    }),
  });
  await mixed.authorize("https://mixed.example/").then(
    () => {
      throw new Error("mixed DNS answer must be blocked");
    },
    (error) => assert(error instanceof ResourcePolicyError, "policy error"),
  );
});

Deno.test("destination policy rejects ambiguous URLs and permits only exact cache origin", async () => {
  const policy = new ResourceDestinationPolicy({
    resolveDns: resolver({ "public.example:A": ["93.184.216.34"] }),
    localCacheUrl: "http://127.0.0.1:24242/",
  });
  const invalid = [
    "ftp://public.example/x",
    "https://user:pass@public.example/x",
    "https://public.example/x#fragment",
    "https://public.example:444/x",
    "https://2130706433/x",
    "https://[::ffff:127.0.0.1]/x",
    `https://public.example/${"x".repeat(2_100)}`,
  ];
  for (const value of invalid) {
    await policy.authorize(value).then(
      () => {
        throw new Error(`expected blocked URL: ${value}`);
      },
      (error) => assert(error instanceof ResourcePolicyError, "policy error"),
    );
  }

  const cache = await policy.authorize(
    "http://127.0.0.1:24242/deadbeef",
    "local-cache",
  );
  assert(cache.destinationClass === "local-cache", "cache class retained");
  await policy.authorize("http://localhost:24242/deadbeef", "local-cache")
    .then(
      () => {
        throw new Error("hostname cache alias must not be accepted");
      },
      (error) => assert(error instanceof ResourcePolicyError, "policy error"),
    );
});

Deno.test("destination policy accepts public A and AAAA answers", async () => {
  const policy = new ResourceDestinationPolicy({
    resolveDns: resolver({
      "public.example:A": ["93.184.216.34"],
      "public.example:AAAA": ["2606:2800:220:1:248:1893:25c8:1946"],
    }),
  });
  const result = await policy.authorize("https://public.example/file");
  assert(result.url.href === "https://public.example/file", "canonical URL");
  assert(result.addresses.length === 2, "all answers retained");
});
