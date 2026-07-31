---
phase: 06-common-data-and-durable-storage
plan: "03"
subsystem: runtime
tags: [nap-common, nip19, applesauce, outbox, relay-policy]
requires:
  - phase: 06-common-data-and-durable-storage
    plan: "01"
    provides: backend-minted immutable window capability authority
  - phase: 06-common-data-and-durable-storage
    plan: "02"
    provides: completed exact STORAGE dispatcher surface
provides:
  - Exact eight-operation NAP-COMMON request and response surface
  - Shared EventStore-backed partial profile and follows projections
  - Backend signer and required-relay publication for social actions
affects: [common-runtime, social-actions, phase-07]
tech-stack:
  added: []
  patterns: [cached-first bounded refresh, launch-bound common authority, required-relay settlement]
key-files:
  created: [runtime/common.ts, tests/common_test.ts, tests/common_runtime_integration_test.ts]
  modified: [runtime/event_runtime.ts, runtime/nap_dispatcher.ts, runtime/portal_runtime.ts, routes/api/runtime.ts, main.ts]
key-decisions:
  - "Return current shared EventStore truth before starting bounded profile and contact refresh work."
  - "Use one OutboxAdapter over PortalAccounts and the process RelayPool for every COMMON mutation."
patterns-established:
  - "COMMON reads: project cached replaceable events immediately and feed bounded relay observations into the process EventStore."
  - "COMMON writes: recheck active identity immediately before backend publication and expose only stable redacted outcomes."
requirements-completed: [COM-01, COM-02]
coverage:
  - id: D1
    description: "Exactly six public NIP-19 forms and all eight pinned COMMON operations are correlated and contract-shaped."
    requirement: COM-01
    verification:
      - kind: unit
        ref: "tests/common_test.ts#NIP-19 and exact eight-operation parity"
        status: pass
    human_judgment: false
  - id: D2
    description: "Profiles and follows return partial cached Applesauce truth while bounded refresh updates the shared EventStore."
    requirement: COM-02
    verification:
      - kind: unit
        ref: "tests/common_test.ts#profile follows generation and expiry"
        status: pass
    human_judgment: false
  - id: D3
    description: "Verified launch authority gates production signer and required-relay COMMON publication."
    requirement: COM-01
    verification:
      - kind: integration
        ref: "tests/common_runtime_integration_test.ts#authorized success denied publication failure"
        status: pass
    human_judgment: false
duration: 10min
completed: 2026-07-31
status: complete
---

# Phase 6 Plan 3: Complete COMMON Runtime Summary

**Eight canonical COMMON operations now combine public NIP-19 codecs, cached-first Applesauce projections, and launch-bound backend signing with required-relay settlement.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-31T03:36:49Z
- **Completed:** 2026-07-31T03:46:38Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Added exactly encodeNip19, decodeNip19, getProfile, follows, follow, unfollow, react, and report with matching correlated results and no unsolicited profile envelope.
- Implemented public-only npub, note, nprofile, nevent, naddr, and nrelay codecs while rejecting nsec and malformed input.
- Wired cached-first profile/contact projections and backend-authorized kind 3, kind 7, and kind 1984 publication through the process EventStore, PortalAccounts, RelayPolicy, and RelayPool.

## Task Commits

1. **Task 1 RED: codec and projection behavior** - `0a7c5fb` (test)
2. **Task 1 GREEN: public codecs and shared-store reads** - `5d08b57` (feat)
3. **Task 2 RED: action and parity behavior** - `2a42a64` (test)
4. **Task 2 GREEN: backend social actions** - `464acdb` (feat)
5. **Task 3 RED: production composition behavior** - `2037dbc` (test)
6. **Task 3 GREEN: launch-bound signer/outbox wiring** - `421aa5f` (feat)

## Files Created/Modified

- `runtime/common.ts` - Exact COMMON decoder, sanitized projections, event construction, and stable result mapping.
- `runtime/event_runtime.ts` - Policy-aware bounded kind 0 and kind 3 refresh seam feeding the shared EventStore.
- `runtime/nap_dispatcher.ts` - Authority-first routing for every exact COMMON request.
- `runtime/portal_runtime.ts` - One verified-launch registration path for immutable window authority.
- `routes/api/runtime.ts` - Registers the backend-verified legacy artifact through the same launch authority path.
- `main.ts` - Production CommonService and OutboxAdapter composition using PortalAccounts and the process relay pool.
- `tests/common_test.ts` - Codec, projection, mutation, parity, generation, and teardown coverage.
- `tests/common_runtime_integration_test.ts` - Launch authorization, success, denial, and publication-failure coverage.

## Decisions Made

- Nrelay is encoded and decoded as its canonical type-0 TLV because the installed nostr-tools NIP-19 helper predates direct nrelay support.
- Successful COMMON mutations enter the shared EventStore only after the required publisher reports success.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking dependency API gap] Implemented canonical nrelay TLV locally**
- **Found during:** Task 1
- **Issue:** The pinned nostr-tools version supports the other public forms but exposes no nrelay helper.
- **Fix:** Used its already-locked `@scure/base` dependency to encode and decode the canonical bounded nrelay TLV.
- **Files modified:** `runtime/common.ts`
- **Verification:** Six-form round-trip and nsec rejection test passes.
- **Committed in:** `5d08b57`

**Total deviations:** 1 auto-fixed (1 Rule 3)
**Impact on plan:** The fix completes the required pinned public surface without installing or upgrading any package.

## Issues Encountered

- Deno's pipe-delimited `--filter` expression selected no tests, so the complete focused test files were run; all focused and full-suite tests passed.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

Phase 6 now exposes the complete locked COMMON and durable STORAGE surfaces through one backend-owned runtime. Phase 7 can build on their established capability and lifecycle boundaries.

## Self-Check: PASSED

- All eight created or modified implementation/test files exist.
- All six TDD commits exist in git history.
- Focused 16-test coverage, full 189-test suite, formatting/lint/type checks, and production build pass.

---
*Phase: 06-common-data-and-durable-storage*
*Completed: 2026-07-31*
