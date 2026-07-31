export const BROWSER_SECURITY_POLICY = Object.freeze({
  contentSecurityPolicy: [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
    "script-src 'self' 'unsafe-inline'",
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
}

export function browserContentSecurityPolicy(requestUrl?: string): string {
  if (!requestUrl) return BROWSER_SECURITY_POLICY.contentSecurityPolicy;
  const portal = new URL(requestUrl);
  const websocketProtocol = portal.protocol === "https:" ? "wss:" : "ws:";
  const websocketSource = `${websocketProtocol}//${portal.host}`;
  return BROWSER_SECURITY_POLICY.contentSecurityPolicy.replace(
    "connect-src 'self'",
    `connect-src 'self' ${websocketSource}`,
  );
}

export function applyBrowserSecurityHeaders(
  response: Response,
  options: BrowserSecurityHeaderOptions = {},
): Response {
  const basePolicy = browserContentSecurityPolicy(options.requestUrl);
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
