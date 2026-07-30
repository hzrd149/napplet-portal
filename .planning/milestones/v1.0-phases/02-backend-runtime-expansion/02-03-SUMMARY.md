---
phase: 02-backend-runtime-expansion
plan: "03"
subsystem: runtime
tags: [deno, blossom, bud-10, artifact-cache, integrity]
requires:
  - phase: 01-03
    provides: verified NIP-5D artifact resolver and fail-closed executable boundary
  - phase: 02-01
    provides: persisted operator Blossom endpoint settings
provides:
  - Fixed-loopback local Blossom discovery with bounded HEAD probing
  - BUD-10 xs/as proxy routing with deterministic upstream fallback
  - Verified executable artifact resolution across local and upstream sources
affects: [02-04, 02-05, artifact-loading, local-cache-health]
tech-stack:
  added: []
  patterns: [fixed-loopback-discovery, cache-as-transport-not-authority, bounded-read-through]
key-files:
  created: [runtime/blossom_cache.ts, tests/blossom_cache_test.ts]
  modified: [runtime/artifacts.ts, runtime/portal_runtime.ts, tests/artifact_resolver_test.ts]
key-decisions:
  - "Local Blossom discovery is fixed to http://127.0.0.1:24242/ and bounded to 1,500 ms; configured upstream hints accept only canonical HTTP(S) URLs."
  - "The verified manifest signer supplies the BUD-10 as hint, while arbitrary browser hints never enter cache routing."
  - "Local cache bytes remain untrusted transport input and always pass existing signature, aggregate, and content-hash verification before srcdoc exposure."
patterns-established:
  - "Optional local cache failures immediately fall through to upstream sources without changing resolver integrity semantics."
requirements-completed: [V2-05, V2-10]
duration: 3min
completed: 2026-07-30
status: complete
---

# Phase 2 Plan 3: Local Blossom Read-Through Summary

**Fixed-loopback Blossom discovery and BUD-10 proxy hints now accelerate artifact reads while the existing NIP-5D signature, aggregate, and blob verification remains the only authority for executable HTML.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-30T20:27:34Z
- **Completed:** 2026-07-30T20:30:24Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- Added a process-owned `BlossomCache` with fixed loopback discovery, bounded abort handling, sanitized health state, and HTTP(S)-only upstream normalization.
- Added repeated `xs` hints plus a verified-manifest `as` hint to local proxy URLs, with fallback for unhealthy probes, timeouts, misses, and fetch failures.
- Integrated the cache into `PortalArtifactResolver` and the portal runtime while retaining all Phase 1 signature, aggregate, capability, and blob hash checks.
- Added deterministic routing, failure, SSRF-scheme rejection, malformed-byte, and successful executable tracer coverage.

## Task Commits

Each TDD gate was committed separately:

1. **RED: Local Blossom routing and integrity contracts** - `42ec4c2` (test)
2. **GREEN: Verified local Blossom read-through** - `5d045f7` (feat)

## Files Created/Modified

- `runtime/blossom_cache.ts` - Fixed discovery, proxy URL construction, bounded fetch, health projection, and upstream fallback.
- `runtime/artifacts.ts` - BlossomCache-backed blob retrieval beneath the existing verified resolver.
- `runtime/portal_runtime.ts` - Process-owned cache integration using live operator Blossom settings.
- `tests/blossom_cache_test.ts` - Discovery, hint encoding, degradation, fallback, and scheme-policy tests.
- `tests/artifact_resolver_test.ts` - Valid local executable tracer and malformed local byte rejection.

## Decisions Made

- Kept local discovery non-configurable and loopback-only; operator settings contribute upstream hints but cannot replace the discovery origin.
- Derived `as` exclusively from the signature-verified manifest event pubkey.
- Treated local cache health as availability information, never as artifact trust or execution authorization.

## Deviations from Plan

None - plan executed exactly as written.

## Authentication Gates

None.

## Known Stubs

None.

## Verification

- `deno test -A tests/blossom_cache_test.ts tests/artifact_resolver_test.ts` — 8 passed, 0 failed.
- `deno task check` — formatting, lint, and type checks passed for all project files.
- Tracer feedback gate re-ran the focused suite — 8 passed, 0 failed.

## Self-Check: PASSED

- All five created/modified implementation and test files exist.
- RED commit `42ec4c2` and GREEN commit `5d045f7` are present in git history.
- All task acceptance criteria and plan-level verification commands pass.

## Next Phase Readiness

- Artifact and media consumers can share the process-owned read-through cache without coupling launch availability to local service health.
- Later diagnostics may expose the sanitized health projection without exposing URLs, bytes, or signer details.

---
*Phase: 02-backend-runtime-expansion*
*Completed: 2026-07-30*
