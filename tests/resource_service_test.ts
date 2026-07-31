import {
  ResourceDestinationPolicy,
  type ResolveDns,
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
      return Promise.resolve(new Response(null, {
        status: 302,
        headers: { location: "http://internal.example/secret" },
      }));
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
      return Promise.resolve(new Response(null, {
        status: 302,
        headers: { location: `https://public.example/${hop + 1}` },
      }));
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
