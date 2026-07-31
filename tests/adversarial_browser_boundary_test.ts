import {
  createIframeBridge,
  type VerifiedNappletIdentity,
} from "../components/NappletFrame.tsx";
import {
  applyBrowserSecurityHeaders,
  BROWSER_SECURITY_POLICY,
} from "../runtime/security_headers.ts";
import { isCurrentTransferRecipient } from "../runtime/portal_runtime.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const identity: VerifiedNappletIdentity = {
  dTag: "boundary-tracer",
  aggregateHash: "a".repeat(64),
};

Deno.test("browser boundary tracer denies a forged frame and closes response policy", () => {
  const trusted = {} as Window;
  const foreign = {} as Window;
  const posted: Record<string, unknown>[] = [];
  const forwarded: Record<string, unknown>[] = [];
  const bridge = createIframeBridge({
    source: () => trusted,
    post: (message) => posted.push(message),
    forward: (message) => forwarded.push(message),
  });

  bridge.receive({
    source: foreign,
    origin: "null",
    data: { type: "shell.ready" },
  });
  bridge.receive({
    source: trusted,
    origin: "https://evil.example",
    data: { type: "outbox.query", id: "secret" },
  });
  assert(posted.length === 0, "foreign source must receive no initialization");
  assert(forwarded.length === 0, "foreign origin must dispatch no command");

  const current = {
    connectionId: "connection-current",
    windowId: "window-current",
    accountPubkey: "b".repeat(64),
    coordinate: "35129:" + "b".repeat(64) + ":boundary-tracer",
    manifestEventId: "c".repeat(64),
    dTag: identity.dTag,
    aggregateHash: identity.aggregateHash,
    grantedDomains: ["storage"],
    grantedCapabilities: ["storage.get"],
    instanceId: "instance-current",
    generation: 4,
  } as const;
  assert(
    !isCurrentTransferRecipient({
      connectionId: current.connectionId,
      windowId: current.windowId,
      generation: 3,
    }, current),
    "stale generation must receive no runtime data",
  );

  const response = applyBrowserSecurityHeaders(new Response("ok"));
  assert(
    response.headers.get("content-security-policy") ===
      BROWSER_SECURITY_POLICY.contentSecurityPolicy,
    "closed CSP must be present",
  );
  assert(
    response.headers.get("permissions-policy") ===
      BROWSER_SECURITY_POLICY.permissionsPolicy,
    "closed Permissions-Policy must be present",
  );
});
