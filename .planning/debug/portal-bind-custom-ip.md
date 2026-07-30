---
status: investigating
trigger: "Figure out and fix why setting the custom ip in .env on PORTAL_BIND does not make the deno fresh server bind to that ip address"
created: 2026-07-30
updated: 2026-07-30
---

# Debug Session: portal-bind-custom-ip

## Symptoms

- Expected behavior: `PORTAL_BIND` in `.env` controls the bind address used by
  `deno task dev` and `deno task start`.
- Actual behavior: Custom IP values do not cause the Fresh server to bind to
  that address.
- Error messages: No reported runtime error; current code warns and falls back
  for non-loopback values.
- Timeline: Present in current runtime config.
- Reproduction: Set `PORTAL_BIND` in `.env` to a custom/non-loopback IP and
  start the server.

## Current Focus

- hypothesis: `runtime/config.ts` rejects every `PORTAL_BIND` value except
  `127.0.0.1` and `::1`, so the tasks never receive the requested host.
- test: Update focused bind resolver coverage and run the project verification
  gate.
- expecting: Valid custom IP addresses are preserved and malformed bind
  addresses fall back with a warning.
- next_action: patch bind validation, docs, and tests

## Evidence

- 2026-07-30: `runtime/config.ts` narrows `RuntimeConfig.bind` to
  `"127.0.0.1" | "::1"` and falls back to `127.0.0.1` for any other value.
- 2026-07-30: `tests/env_test.ts` explicitly asserts `PORTAL_BIND=0.0.0.0` must
  fall back to `127.0.0.1`.

## Eliminated

## Resolution

- root_cause: `runtime/config.ts` treated `PORTAL_BIND` as loopback-only
  configuration and returned `127.0.0.1` for valid custom IPs before Vite or
  `deno serve --host` saw the requested address.
- fix: Preserve valid bind hosts, including custom IPv4, IPv6, wildcard, and
  hostname values; reject URL-shaped and host-port values with a warning and
  fallback.
- verification: `deno task check`; `deno task test` passed after rerunning with
  network access for artifact fetch tests.
- files_changed: `runtime/config.ts`, `tests/env_test.ts`,
  `tests/config_test.ts`, `README.md`, `.env.example`
