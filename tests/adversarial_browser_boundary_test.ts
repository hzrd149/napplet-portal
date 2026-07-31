import {
  createIframeBridge,
  type VerifiedNappletIdentity,
} from "../components/NappletFrame.tsx";
import {
  applyBrowserSecurityHeaders,
  BROWSER_SECURITY_POLICY,
  browserContentSecurityPolicy,
} from "../runtime/security_headers.ts";
import { isCurrentTransferRecipient } from "../runtime/portal_runtime.ts";
import { THEME_BOOTSTRAP_SCRIPT } from "../shell/theme.ts";

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
  const settingsResponse = applyBrowserSecurityHeaders(new Response("ok"), {
    allowSameOriginFrame: true,
  });
  assert(
    settingsResponse.headers.get("content-security-policy")?.includes(
      "frame-ancestors 'self'",
    ),
    "the first-party settings frame must permit only the portal origin",
  );
  assert(
    settingsResponse.headers.get("x-frame-options") === "SAMEORIGIN",
    "the first-party settings frame must reject foreign ancestors",
  );
});

Deno.test("mandatory browser boundary matrix is closed", async () => {
  const frameSource = await Deno.readTextFile("components/NappletFrame.tsx");
  assert(
    /sandbox="allow-scripts"/.test(frameSource),
    "the one locked sandbox token must remain present",
  );
  for (
    const forbidden of [
      "allow-same-origin",
      "allow-top-navigation",
      "allow-popups",
      "allow-forms",
      "allow-modals",
      "allow-downloads",
    ]
  ) {
    assert(!frameSource.includes(forbidden), `${forbidden} must stay denied`);
  }

  const csp = BROWSER_SECURITY_POLICY.contentSecurityPolicy;
  for (
    const directive of [
      "default-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'none'",
      "worker-src 'none'",
      "media-src 'none'",
      "manifest-src 'none'",
    ]
  ) {
    assert(csp.includes(directive), `CSP must include ${directive}`);
  }
  const hostile = new Response("denied", {
    headers: {
      "Content-Security-Policy": "default-src *",
      "Permissions-Policy": "camera=*",
    },
  });
  applyBrowserSecurityHeaders(hostile);
  assert(
    !hostile.headers.get("content-security-policy")?.includes("default-src *"),
    "caller policy cannot weaken CSP",
  );
  assert(
    !hostile.headers.get("permissions-policy")?.includes("camera=*"),
    "caller policy cannot weaken Permissions-Policy",
  );

  const trusted = {} as Window;
  for (
    const row of [
      { source: {} as Window, origin: "null" },
      { source: trusted, origin: "https://evil.example" },
      { source: trusted, origin: "" },
    ]
  ) {
    let dispatches = 0;
    createIframeBridge({
      source: () => trusted,
      post: () => dispatches++,
      forward: () => dispatches++,
    }).receive({
      ...row,
      data: { type: "storage.keys", id: "sensitive-correlation" },
    });
    assert(dispatches === 0, "hostile frame row must stay silent");
  }

  const authority = {
    connectionId: "connection",
    windowId: "window",
    accountPubkey: "d".repeat(64),
    coordinate: "35129:" + "d".repeat(64) + ":boundary",
    manifestEventId: "e".repeat(64),
    dTag: "boundary",
    aggregateHash: "f".repeat(64),
    grantedDomains: ["storage"],
    grantedCapabilities: ["storage.keys"],
    instanceId: "instance",
    generation: 8,
  } as const;
  for (
    const candidate of [
      { connectionId: "foreign", windowId: "window" },
      { connectionId: "connection", windowId: "foreign" },
      { connectionId: "connection", windowId: "window", generation: 7 },
      {
        connectionId: "connection",
        windowId: "window",
        account: "0".repeat(64),
      },
      {
        connectionId: "connection",
        windowId: "window",
        napplet: "forged@identity",
      },
    ]
  ) {
    assert(
      !isCurrentTransferRecipient(candidate, authority),
      "foreign or stale recipient must receive zero data",
    );
  }
});

Deno.test("sandbox networking is limited to the portal WebSocket origin", () => {
  const httpPolicy = browserContentSecurityPolicy(
    "http://portal.example:8000/napplet",
  );
  assert(
    httpPolicy.includes("connect-src 'self' ws://portal.example:8000"),
    "HTTP portal must authorize only its matching WebSocket origin",
  );
  const httpConnectSources = httpPolicy
    .split("; ")
    .find((directive) => directive.startsWith("connect-src "))
    ?.split(" ").slice(1) ?? [];
  assert(
    !httpConnectSources.includes("ws:"),
    "scheme-wide ws access must be denied",
  );
  assert(
    !httpConnectSources.includes("wss:"),
    "scheme-wide wss access must be denied",
  );
  assert(
    !httpPolicy.includes("attacker.example"),
    "attacker WebSocket origin must not be authorized",
  );

  const httpsPolicy = browserContentSecurityPolicy(
    "https://portal.example/napplet",
  );
  assert(
    httpsPolicy.includes("connect-src 'self' wss://portal.example"),
    "HTTPS portal must authorize only its matching secure WebSocket origin",
  );
});

Deno.test("host scripts require same-origin files or the fixed theme hash", async () => {
  const policy = BROWSER_SECURITY_POLICY.contentSecurityPolicy;
  const scriptDirective =
    policy.split("; ").find((directive) =>
      directive.startsWith("script-src ")
    ) ?? "";
  assert(
    !scriptDirective.includes("'unsafe-inline'"),
    "host-wide CSP must reject arbitrary inline script execution",
  );
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(THEME_BOOTSTRAP_SCRIPT),
  );
  const hash = btoa(String.fromCharCode(...new Uint8Array(digest)));
  assert(
    policy.includes(`script-src 'self' 'sha256-${hash}'`),
    "CSP must authorize only the byte-stable first-paint theme bootstrap",
  );
});
