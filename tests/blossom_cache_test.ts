import {
  BlossomCache,
  discoverLocalBlossom,
  fetchWithBlossomCache,
  LOCAL_BLOSSOM_URL,
} from "../runtime/blossom_cache.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const HASH = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const publicDns = (_hostname: string, recordType: "A" | "AAAA") =>
  Promise.resolve(recordType === "A" ? ["93.184.216.34"] : []);

Deno.test("discovers the fixed loopback endpoint with a bounded HEAD", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const discovered = await discoverLocalBlossom({
    fetch: (input, init) => {
      calls.push({ url: String(input), init });
      return Promise.resolve(new Response(null, { status: 204 }));
    },
    timeoutMs: 25,
  });

  assert(discovered === LOCAL_BLOSSOM_URL, "healthy loopback must be found");
  assert(calls.length === 1, "discovery must make one request");
  assert(calls[0].url === LOCAL_BLOSSOM_URL, "discovery URL must be fixed");
  assert(calls[0].init?.method === "HEAD", "discovery must use HEAD");
  assert(calls[0].init?.signal instanceof AbortSignal, "probe must be bounded");
});

Deno.test("local proxy receives repeated xs and attested as hints", async () => {
  const calls: string[] = [];
  const bytes = await fetchWithBlossomCache({
    hash: HASH,
    upstreamServers: ["https://one.example/", "https://two.example/cache"],
    authorPubkey: "author",
    localUrl: LOCAL_BLOSSOM_URL,
    fetch: (input) => {
      calls.push(String(input));
      return Promise.resolve(new Response("abc"));
    },
    resolveDns: publicDns,
  });

  assert(
    new TextDecoder().decode(bytes) === "abc",
    "cache hit must return bytes",
  );
  const url = new URL(calls[0]);
  assert(
    url.origin === "http://127.0.0.1:24242",
    "only fixed local origin is used",
  );
  assert(url.pathname === `/${HASH}`, "hash must be the local path");
  assert(
    url.searchParams.getAll("xs").join(",") ===
      "https://one.example/,https://two.example/cache",
    "all upstream hints must be encoded",
  );
  assert(
    url.searchParams.get("as") === "author",
    "attested author must be encoded",
  );
});

Deno.test("unhealthy, timeout, miss, and proxy failure fall through upstream", async () => {
  for (
    const localResult of ["unhealthy", "timeout", "miss", "failure"] as const
  ) {
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(localResult),
        ),
      ),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    const calls: string[] = [];
    const cache = new BlossomCache({
      timeoutMs: 5,
      fetch: (input, init) => {
        const url = String(input);
        calls.push(`${init?.method ?? "GET"} ${url}`);
        if (init?.method === "HEAD") {
          if (localResult === "unhealthy") {
            return Promise.resolve(new Response(null, { status: 503 }));
          }
          if (localResult === "timeout") {
            return new Promise((_resolve, reject) =>
              init.signal?.addEventListener(
                "abort",
                () => reject(new DOMException("aborted", "AbortError")),
              )
            );
          }
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        if (url.startsWith(LOCAL_BLOSSOM_URL)) {
          if (localResult === "miss") {
            return Promise.resolve(new Response(null, { status: 404 }));
          }
          return Promise.reject(new Error("proxy failed"));
        }
        return Promise.resolve(new Response(localResult));
      },
      resolveDns: publicDns,
    });

    const bytes = await cache.fetch(hash, ["https://upstream.example/"]);
    assert(
      new TextDecoder().decode(bytes) === localResult,
      `${localResult} must use upstream`,
    );
    assert(
      calls.at(-1) === `GET https://upstream.example/${hash}`,
      `${localResult} must reach upstream`,
    );
  }
});

Deno.test("invalid upstream schemes are never requested", async () => {
  const calls: string[] = [];
  const cache = new BlossomCache({
    fetch: (input, init) => {
      calls.push(String(input));
      if (init?.method === "HEAD") {
        return Promise.resolve(new Response(null, { status: 503 }));
      }
      return Promise.resolve(new Response("unexpected"));
    },
    resolveDns: publicDns,
  });

  try {
    await cache.fetch(HASH, ["file:///secret", "javascript:alert(1)"]);
    throw new Error("expected unavailable error");
  } catch (error) {
    assert(
      error instanceof Error && error.message.includes("unavailable"),
      "must fail unavailable",
    );
  }
  assert(calls.length === 1, "only fixed discovery may be requested");
});
