---
phase: 05-resource-and-blossom-transfer
plan: "03"
subsystem: api
tags: [blossom, upload, nostr, bud-10, deno]
requires:
  - phase: 05-resource-and-blossom-transfer
    provides: binary upload transport seam and backend transfer policy
provides:
  - Backend-authorized kind-24242 Blossom uploads through the pinned SDK
  - All-required remote settlement before optional loopback copying
  - Canonical bounded per-destination settlement tokens and owner-scoped status retention
affects: [05-04, nap-upload, blossom-transfer]
tech-stack:
  added: [blossom-client-sdk@5.0.0]
  patterns: [thin pinned-SDK adapter, bounded all-required fanout, closed canonical settlement projection]
key-files:
  created: [runtime/blossom_transfer.ts, tests/blossom_transfer_test.ts]
  modified: [deno.json, deno.lock]
key-decisions:
  - "Every configured non-loopback Blossom destination is required; local loopback copying is optional and starts only after complete remote acceptance."
  - "Canonical settlement uses ordered url/fallbackUrls plus sanitized required[N]/local tokens without extending UploadResult."
patterns-established:
  - "Upload SDK objects and signed authorization remain confined to a backend adapter."
  - "Terminal upload status is scoped by owner and retained for at most ten minutes or 64 uploads."
requirements-completed: [UPL-02, UPL-03]
coverage:
  - id: D1
    description: "Backend-owned signer authorizes hash/server-scoped Blossom uploads and rejects mismatched descriptors."
    requirement: UPL-02
    verification:
      - kind: unit
        ref: "tests/blossom_transfer_test.ts#adapter hashes bytes and scopes backend authorization to server and hash"
        status: pass
      - kind: unit
        ref: "tests/blossom_transfer_test.ts#adapter rejects a descriptor that does not match the requested bytes"
        status: pass
    human_judgment: false
  - id: D2
    description: "Required remotes settle before optional local copying with exact bounded canonical outcome exposure."
    requirement: UPL-03
    verification:
      - kind: unit
        ref: "tests/blossom_transfer_test.ts#four terminal settlement matrix tests"
        status: pass
      - kind: integration
        ref: "deno task check"
        status: pass
    human_judgment: false
duration: 14min
completed: 2026-07-31
status: complete
---

# Phase 5 Plan 03: Backend Blossom Upload Settlement Summary

**Pinned Blossom SDK uploads now use backend-only scoped authorization, strict descriptor verification, all-required remote settlement, and bounded canonical remote/local outcome tokens.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-31T02:28:17Z
- **Completed:** 2026-07-31T02:42:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Pinned `blossom-client-sdk@5.0.0` and isolated its upload, authorization, authorization-header, and BUD-10 parsing primitives behind a portal adapter.
- Sniffed, bounded, and hashed bytes before network work; used only backend `signEvent` authority; and verified returned hash, size, origin, and hash path.
- Added bounded-concurrency all-required remote settlement, post-success optional local copying, canonical ordered URLs/tokens, shared cancellation/deadline handling, and bounded owner status retention.

## Task Commits

1. **Task 1 RED: Upload tracer tests** - `2734dc1`
2. **Task 1 GREEN: Authorized Blossom adapter** - `9dc3bc6`
3. **Task 2 RED: Settlement matrix tests** - `7df94db`
4. **Task 2 GREEN: Required/local settlement service** - `7ec45e1`
5. **Task 2 refinement: Pinned BUD-10 validation** - `ac3d8e4`

## Files Created/Modified

- `runtime/blossom_transfer.ts` - Pinned SDK adapter, descriptor verification, multi-server settlement, canonical projection, and status retention.
- `tests/blossom_transfer_test.ts` - Authorization, mismatch, and four terminal settlement matrix tests.
- `deno.json` - Exact Blossom SDK import pin.
- `deno.lock` - Exact resolved SDK and hash dependency graph.

## Decisions Made

- Preserve the closed NAP 0.31 upload contract: accepted endpoints use `url` then `fallbackUrls`; every required and local outcome uses bounded sanitized `error` tokens.
- Treat all non-loopback configured servers as required and the exact loopback destination as optional, with no local attempt after required failure.
- Keep richer execution detail backend-internal and expose no hostnames, paths, response bodies, exception text, or invented fields.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Context7 was unavailable, so the reviewed installed package typings and source documented in Phase 5 research were used for exact 5.0.0 API verification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The upload dispatcher can now consume `BlossomTransferService` for canonical upload/result and owner-scoped status flows. No blockers remain for Plan 05-04 integration.

## Self-Check: PASSED

- All created and modified plan files exist.
- All five task commits are present in git history.
- `deno test -A tests/blossom_transfer_test.ts tests/accounts_test.ts` passes (13 tests).
- `deno task check` passes.

---
*Phase: 05-resource-and-blossom-transfer*
*Completed: 2026-07-31*
