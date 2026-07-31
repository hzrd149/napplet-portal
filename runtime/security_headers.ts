export const BROWSER_SECURITY_POLICY = Object.freeze({
  contentSecurityPolicy: [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
    "script-src 'self' 'sha256-6LnFsWJcjPnwz0LHARVaKU7rY2XZo0ToRHaMKKBdNG8='",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'self' blob:",
    "worker-src 'none'",
    "media-src 'none'",
    "manifest-src 'none'",
  ].join("; "),
  permissionsPolicy: [
    "accelerometer=()",
    "ambient-light-sensor=()",
    "camera=()",
    "display-capture=()",
    "geolocation=()",
    "gyroscope=()",
    "magnetometer=()",
    "microphone=()",
    "midi=()",
    "payment=()",
    "publickey-credentials-get=()",
    "screen-wake-lock=()",
    "serial=()",
    "usb=()",
    "xr-spatial-tracking=()",
  ].join(", "),
});

interface BrowserSecurityHeaderOptions {
  readonly allowSameOriginFrame?: boolean;
  readonly requestUrl?: string;
  readonly scriptNonce?: string;
}

export function browserContentSecurityPolicy(
  requestUrl?: string,
  scriptNonce?: string,
): string {
  let policy = BROWSER_SECURITY_POLICY.contentSecurityPolicy;
  if (requestUrl) {
    const portal = new URL(requestUrl);
    const websocketProtocol = portal.protocol === "https:" ? "wss:" : "ws:";
    const websocketSource = `${websocketProtocol}//${portal.host}`;
    policy = policy.replace(
      "connect-src 'self'",
      `connect-src 'self' ${websocketSource}`,
    );
  }
  if (scriptNonce && /^[A-Za-z0-9+/_-]+={0,2}$/.test(scriptNonce)) {
    policy = policy.replace(
      "script-src 'self'",
      `script-src 'self' 'nonce-${scriptNonce}'`,
    );
  }
  return policy;
}

export function applyBrowserSecurityHeaders(
  response: Response,
  options: BrowserSecurityHeaderOptions = {},
): Response {
  const basePolicy = browserContentSecurityPolicy(
    options.requestUrl,
    options.scriptNonce,
  );
  const contentSecurityPolicy = options.allowSameOriginFrame
    ? basePolicy.replace(
      "frame-ancestors 'none'",
      "frame-ancestors 'self'",
    )
    : basePolicy;
  response.headers.set(
    "Content-Security-Policy",
    contentSecurityPolicy,
  );
  response.headers.set(
    "Permissions-Policy",
    BROWSER_SECURITY_POLICY.permissionsPolicy,
  );
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set(
    "X-Frame-Options",
    options.allowSameOriginFrame ? "SAMEORIGIN" : "DENY",
  );
  return response;
}

export async function applyFreshBrowserSecurityHeaders(
  response: Response,
  options: Omit<BrowserSecurityHeaderOptions, "scriptNonce"> = {},
): Promise<Response> {
  const contentType = response.headers.get("content-type") ?? "";
  let scriptNonce: string | undefined;
  if (contentType.toLowerCase().includes("text/html")) {
    const html = await response.clone().text();
    scriptNonce = /<script\b[^>]*\bnonce="([A-Za-z0-9+/_-]+={0,2})"/i
      .exec(html)?.[1];
  }
  return applyBrowserSecurityHeaders(response, { ...options, scriptNonce });
}
