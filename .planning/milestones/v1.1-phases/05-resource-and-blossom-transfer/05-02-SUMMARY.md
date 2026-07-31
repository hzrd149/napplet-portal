---
phase: 05-resource-and-blossom-transfer
plan: "02"
subsystem: resource-runtime
tags: [ssrf, dns, redirects, blossom, streaming, sha256, mime]
requires:
  - phase: 05-resource-and-blossom-transfer
    provides: owner-bound binary transport and immutable transfer policy
provides:
  - every-hop outbound destination policy with exact loopback-cache isolation
  - bounded streamed HTTP and Blossom resource reads
  - local-first hash-verified Blossom fallback and ordered batch settlement
affects: [05-03-blossom-upload, resource-dispatch, artifact-resolution]
tech-stack:
  added: []
  patterns: [manual-redirect-validation, all-answer-dns-policy, incremental-bounded-reader, observed-byte-mime]
key-files:
  created: [runtime/resource_policy.ts, runtime/resource_service.ts, tests/resource_policy_test.ts, tests/resource_service_test.ts]
  modified: [runtime/blossom_cache.ts, tests/blossom_cache_test.ts, tests/artifact_resolver_test.ts]
key-decisions:
  - "Authorize the exact 127.0.0.1 cache origin as a separate destination class; never grant a hostname or subnet exception."
  - "Treat response headers as advisory and release only passive MIME types identified from observed bytes."
  - "Retry corrupt local-cache bytes against ordered HTTPS upstreams, but never release bytes before SHA-256 verification."
patterns-established:
  - "Every outbound hop is manually redirected, reparsed, and checked against every A and AAAA answer."
  - "One streamed reader owns byte ceilings, cancellation, SHA-256, MIME classification, and Blob construction."
requirements-completed: [RES-02, RES-03]
coverage:
  - id: D1
    description: "Every initial and redirected HTTP destination is revalidated against all DNS answers and forbidden address classes."
    requirement: RES-02
    verification:
      - kind: integration
        ref: "tests/resource_policy_test.ts and tests/resource_service_test.ts#SSRF and redirect fixtures"
        status: pass
    human_judgment: false
  - id: D2
    description: "HTTP and Blossom reads enforce streamed size, timeout, passive MIME, and integrity policy before release."
    requirement: RES-02
    verification:
      - kind: integration
        ref: "tests/resource_service_test.ts#bounded reader and hash fixtures"
        status: pass
    human_judgment: false
  - id: D3
    description: "Exact-loopback Blossom cache reads fall through to ordered upstreams without becoming a trust bypass."
    requirement: RES-03
    verification:
      - kind: integration
        ref: "tests/blossom_cache_test.ts and tests/artifact_resolver_test.ts"
        status: pass
    human_judgment: false
metrics:
  duration: 11min
  completed: 2026-07-31
status: complete
---

# Phase 5 Plan 2: Bounded Resource and Blossom Reads Summary

**Every-hop DNS and redirect controls now feed one streamed 5 MiB reader with passive MIME sniffing, incremental SHA-256, and exact-loopback Blossom fallback.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-07-31T02:21:00Z
- **Completed:** 2026-07-31T02:32:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added URL, port, credential, fragment, IPv4, IPv6, all-answer DNS, and manual redirect enforcement for initial and redirected destinations.
- Added a cancellable streamed reader that enforces declared and actual size, incrementally hashes chunks, identifies passive content from bytes, and constructs a Blob only after policy succeeds.
- Refactored Blossom cache reads through the same policy, preserving BUD-10 `xs`/`as` ordering, exact local-cache isolation, upstream fallback, and artifact verification.
- Added ordered partial `bytesMany` settlements with the closed eight-URL envelope cap.

## Task Commits

1. **Task 1 RED: SSRF policy tracer tests** - `a626254`
2. **Task 1 GREEN: Every-hop destination policy** - `6689e37`
3. **Task 2 RED: Bounded resource reader tests** - `eb3ca43`
4. **Task 2 GREEN: Local-first bounded reads** - `7615bf9`
5. **Task 2 completion: Incremental stream hashing** - `17dc867`

## Files Created/Modified

- `runtime/resource_policy.ts` - URL parsing, exact cache-origin class, DNS resolution, and forbidden IPv4/IPv6 classification.
- `runtime/resource_service.ts` - Manual redirects, bounded stream consumption, SHA-256, MIME sniffing, Blossom resolution, and ordered batches.
- `runtime/blossom_cache.ts` - Artifact-compatible local discovery and bounded local-first read adapter.
- `tests/resource_policy_test.ts` - Adversarial destination and DNS policy fixtures.
- `tests/resource_service_test.ts` - Redirect, size, MIME, integrity, cache retry, and batch fixtures.
- `tests/blossom_cache_test.ts` - Strict hash and policy-aware local/upstream fixtures.
- `tests/artifact_resolver_test.ts` - Safe early rejection expectation for corrupt cache and upstream bytes.

## Decisions Made

- Ordinary fetch cannot pin the address validated by DNS policy, so code records the residual rebinding exposure and relies on deployment egress controls as defense in depth.
- Public RESOURCE inputs accept strict HTTPS only; internal HTTP is limited to exact equality with the configured fixed loopback cache origin.
- Corrupt cache bytes fall through upstream and all-corrupt candidates fail unavailable before reaching executable artifact parsing.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The final repository-wide check encountered a concurrently created, unformatted `tests/blossom_transfer_test.ts` owned by Plan 05-03. The full check had passed immediately before that concurrent change; after the final stream-hashing edit, formatting, lint, type-checking, and focused tests all passed for every 05-02 file without touching 05-03 work.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

- RESOURCE policy and bounded read primitives are ready for dispatcher wiring and the upload plan can reuse the destination and integrity boundaries.
- Deployment network egress remains defense in depth for the documented fetch/DNS rebinding gap.

## Verification

- `deno test -A tests/resource_policy_test.ts tests/resource_service_test.ts tests/blossom_cache_test.ts tests/artifact_resolver_test.ts` — 17 passed.
- Owned-file `deno fmt --check`, `deno lint`, and `deno check` — passed.
- `deno task check` — passed before the concurrent 05-03 file appeared; the later rerun stopped only on that unrelated file's formatting.

## Self-Check: PASSED

- All seven created or modified plan files exist.
- Commits `a626254`, `6689e37`, `eb3ca43`, `7615bf9`, and `17dc867` exist in git history.
- No tracked files were deleted and unrelated research-cache JSON and Phase 7 documentation were preserved.

---
*Phase: 05-resource-and-blossom-transfer*
*Completed: 2026-07-31*
