import { define } from "../../utils.ts";

const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "connect-src 'self'",
  "frame-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

const DOCUMENT = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Opening napplet</title>
<link rel="icon" href="/logo.svg" type="image/svg+xml">
<script src="/intent-reserved.js" defer></script>
</head>
<body><p id="status" aria-live="polite">Preparing verified napplet…</p></body>
</html>`;

export function reservationResponse(): Response {
  return new Response(DOCUMENT, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": CSP,
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}

export const handler = define.handlers({
  GET: reservationResponse,
});
