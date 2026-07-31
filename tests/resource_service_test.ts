import {
  type ResolveDns,
  ResourceDestinationPolicy,
} from "../runtime/resource_policy.ts";
import {
  ResourceService,
  ResourceServiceError,
} from "../runtime/resource_service.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const publicDns: ResolveDns = (_hostname, recordType) =>
  Promise.resolve(recordType === "A" ? ["93.184.216.34"] : []);

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

function publicPolicy() {
  return new ResourceDestinationPolicy({ resolveDns: publicDns });
}

Deno.test("manual redirect blocks a forbidden hop before it is requested", async () => {
  const calls: string[] = [];
  const policy = new ResourceDestinationPolicy({
    resolveDns: (hostname, recordType) => {
      if (hostname === "public.example") return publicDns(hostname, recordType);
      return Promise.resolve(recordType === "A" ? ["127.0.0.1"] : []);
    },
  });
  const service = new ResourceService({
    policy,
    fetch: (input, init) => {
      calls.push(String(input));
      assert(init?.redirect === "manual", "redirects must be manual");
      return Promise.resolve(
        new Response(null, {
          status: 302,
          headers: { location: "http://internal.example/secret" },
        }),
      );
    },
  });

  await service.bytes("https://public.example/start").then(
    () => {
      throw new Error("expected redirect to be blocked");
    },
    (error) => {
      assert(error instanceof ResourceServiceError, "service error");
      assert(error.code === "blocked-by-policy", "stable policy result");
    },
  );
  assert(calls.length === 1, "forbidden redirect target is never requested");
});

Deno.test("public redirect chains re-resolve every hop and stop after three redirects", async () => {
  const resolved: string[] = [];
  const calls: string[] = [];
  const policy = new ResourceDestinationPolicy({
    resolveDns: (hostname, recordType) => {
      if (recordType === "A") resolved.push(hostname);
      return publicDns(hostname, recordType);
    },
  });
  const service = new ResourceService({
    policy,
    fetch: (input) => {
      const url = new URL(String(input));
      calls.push(url.href);
      const hop = Number(url.pathname.slice(1) || "0");
      return Promise.resolve(
        new Response(null, {
          status: 302,
          headers: { location: `https://public.example/${hop + 1}` },
        }),
      );
    },
  });

  await service.bytes("https://public.example/0").then(
    () => {
      throw new Error("expected redirect limit");
    },
    (error) => {
      assert(error instanceof ResourceServiceError, "service error");
      assert(error.code === "blocked-by-policy", "redirect limit policy code");
    },
  );
  assert(calls.length === 4, "initial request plus three redirects only");
  assert(resolved.length === 4, "every requested hop is re-resolved");
});

Deno.test("streamed body enforces actual byte limit and cancels immediately", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([137, 80, 78, 71]));
      controller.enqueue(new Uint8Array(12));
    },
    cancel() {
      cancelled = true;
    },
  });
  const service = new ResourceService({
    policy: publicPolicy(),
    maxBytes: 8,
    fetch: () => Promise.resolve(new Response(body)),
  });
  await service.bytes("https://public.example/large.png").then(
    () => {
      throw new Error("expected size rejection");
    },
    (error) => {
      assert(error instanceof ResourceServiceError, "service error");
      assert(error.code === "too-large", "actual-byte limit code");
    },
  );
  assert(cancelled, "oversize reader must be cancelled");
});

Deno.test("observed passive bytes determine MIME and reject active or conflicting hints", async () => {
  const pngService = new ResourceService({
    policy: publicPolicy(),
    fetch: () =>
      Promise.resolve(
        new Response(PNG, {
          headers: { "content-type": "text/html" },
        }),
      ),
  });
  const result = await pngService.bytes("https://public.example/image");
  assert(result.mime === "image/png", "signature overrides hostile header");
  assert(result.blob.type === "image/png", "Blob uses observed MIME");

  for (
    const active of [
      "<!doctype html><script>alert(1)</script>",
      "<svg xmlns='http://www.w3.org/2000/svg'></svg>",
    ]
  ) {
    const service = new ResourceService({
      policy: publicPolicy(),
      fetch: () => Promise.resolve(new Response(active)),
    });
    await service.bytes("https://public.example/active").then(
      () => {
        throw new Error("expected active content rejection");
      },
      (error) => {
        assert(error instanceof ResourceServiceError, "service error");
        assert(error.code === "decode-failed", "active MIME rejection code");
      },
    );
  }
});

Deno.test("Blossom hash reads retry corrupt cache upstream and verify integrity", async () => {
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", PNG)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  const calls: string[] = [];
  const policy = new ResourceDestinationPolicy({
    resolveDns: publicDns,
    localCacheUrl: "http://127.0.0.1:24242/",
  });
  const service = new ResourceService({
    policy,
    localCacheUrl: "http://127.0.0.1:24242/",
    fetch: (input) => {
      const url = String(input);
      calls.push(url);
      return Promise.resolve(
        new Response(
          url.startsWith("http://127.0.0.1") ? "corrupt" : PNG,
        ),
      );
    },
  });
  const result = await service.bytes(`blossom:sha256:${hash}`, {
    blossomServers: ["https://one.example/"],
  });
  assert(result.mime === "image/png", "verified upstream bytes released");
  assert(calls.length === 2, "corrupt cache falls through once");
  assert(
    calls[0].includes("xs=https%3A%2F%2Fone.example%2F"),
    "BUD-10 xs hint",
  );
  assert(calls[1] === `https://one.example/${hash}`, "upstream order");
});

Deno.test("ordered bytesMany retains successful siblings and caps the envelope", async () => {
  const service = new ResourceService({
    policy: publicPolicy(),
    fetch: (input) =>
      String(input).includes("missing")
        ? Promise.resolve(new Response(null, { status: 404 }))
        : Promise.resolve(new Response(PNG)),
  });
  const items = await service.bytesMany([
    "https://public.example/first",
    "https://public.example/missing",
    "https://public.example/third",
  ]);
  assert(items.length === 3, "batch length retained");
  assert(items[0].ok && !items[1].ok && items[2].ok, "ordered settlements");
  await service.bytesMany(Array(9).fill("https://public.example/x")).then(
    () => {
      throw new Error("expected batch rejection");
    },
    (error) => {
      assert(error instanceof ResourceServiceError, "service error");
      assert(error.code === "blocked-by-policy", "batch cap policy code");
    },
  );
});
