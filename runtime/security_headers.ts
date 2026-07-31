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
    "connect-src 'self' ws: wss:",
    "frame-src 'self' blob:",
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

export function applyBrowserSecurityHeaders(response: Response): Response {
  response.headers.set(
    "Content-Security-Policy",
    BROWSER_SECURITY_POLICY.contentSecurityPolicy,
  );
  response.headers.set(
    "Permissions-Policy",
    BROWSER_SECURITY_POLICY.permissionsPolicy,
  );
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}
