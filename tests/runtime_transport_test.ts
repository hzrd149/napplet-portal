import { isSameOriginRuntimeRequest } from "../routes/api/runtime.ts";
import {
  applyBrowserSecurityHeaders,
  BROWSER_SECURITY_POLICY,
} from "../runtime/security_headers.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("runtime transport denies absent foreign and malformed origins", () => {
  for (const origin of [null, "https://evil.example", "not a url"]) {
    const headers = new Headers();
    if (origin !== null) headers.set("origin", origin);
    assert(
      !isSameOriginRuntimeRequest(
        new Request("https://portal.example/api/runtime", { headers }),
      ),
      `origin ${origin ?? "absent"} must be denied`,
    );
  }
  assert(
    isSameOriginRuntimeRequest(
      new Request("https://portal.example/api/runtime", {
        headers: { origin: "https://portal.example" },
      }),
    ),
    "exact same origin must remain available",
  );
});

Deno.test("runtime responses receive the closed browser policy", () => {
  const response = applyBrowserSecurityHeaders(
    new Response("Forbidden", {
      status: 403,
    }),
  );
  assert(
    response.headers.get("content-security-policy") ===
      BROWSER_SECURITY_POLICY.contentSecurityPolicy,
    "runtime response must carry CSP",
  );
  assert(
    response.headers.get("permissions-policy") ===
      BROWSER_SECURITY_POLICY.permissionsPolicy,
    "runtime response must carry Permissions-Policy",
  );
  assert(
    response.headers.get("referrer-policy") === "no-referrer",
    "runtime response must suppress referrers",
  );
});
