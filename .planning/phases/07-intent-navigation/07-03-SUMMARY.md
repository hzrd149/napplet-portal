---
phase: 07-intent-navigation
plan: 03
subsystem: ui
tags: [intent, popup, iframe, sandbox, history]
requires:
  - phase: 07-intent-navigation
    provides: Backend-authorized reservations, exact navigation codecs, and single-use launch tickets
provides:
  - Same-origin synchronous inert popup reservation with opener severing
  - Exact-account and exact-verified-identity surface reuse
  - Sandboxed multi-frame stack with opaque browser history and exact-once closure
affects: [07-04, shell-navigation, intent-runtime]
tech-stack:
  added: []
  patterns: [source-bound surface registry, synchronous popup reservation, exact-once browser settlement]
key-files:
  created: [tests/intent_navigation_test.tsx, routes/intent/reserved.tsx, static/intent-reserved.js]
  modified: [islands/NappletShell.tsx, routes/api/runtime.ts]
key-decisions:
  - "Retain a popup WindowProxy only while a fixed same-origin reservation is pending, then sever opener in an external inert bootstrap before launch navigation."
  - "Store only opaque surface IDs in browser history and require account plus exact verified aggregate identity for reuse."
patterns-established:
  - "Browser navigation outcomes settle through one bounded reservation controller with replay-safe terminal acknowledgements."
  - "Stack entries retain mounted srcdoc frames while Back and Close remove only the active shell-owned surface."
requirements-completed: [INT-02, INT-03]
coverage:
  - id: D1
    description: "Same-origin popup reservation opens synchronously, severs opener, and settles commit, block, close, or failure exactly once."
    requirement: INT-02
    verification:
      - kind: unit
        ref: "tests/intent_navigation_test.tsx#new-tab reservation opens synchronously and settles exactly once"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sandboxed handler surfaces stack, restore through opaque history, and reuse only for the same account and exact verified identity."
    requirement: INT-03
    verification:
      - kind: unit
        ref: "tests/intent_navigation_test.tsx#stack keeps mounted surfaces and browser history contains opaque IDs"
        status: pass
    human_judgment: false
duration: 6min
completed: 2026-07-31
status: complete
---

# Phase 7 Plan 3: Secure Shell Navigation Summary

**Same-origin inert popup reservations, exact-identity surface reuse, and opaque-history sandboxed frame stacks now execute through shell-owned browser controls.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-31T04:19:15Z
- **Completed:** 2026-07-31T04:25:15Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added a reusable shell surface controller that retains unrelated frames, stores opaque IDs in history, and settles Back/Close once.
- Added activation-safe fixed-route popup reservation with a bounded generated name, retained handle, timeout cleanup, and exact-once acknowledgements.
- Added an inert external reservation bootstrap that severs opener before any launch navigation and accepts no caller content or destination.
- Connected reserve/invoke/ack/ticket messages to the runtime bridge so backend authorization remains authoritative.

## Task Commits

1. **Task 1 RED: stack navigation tests** - `0c6fb47`
2. **Task 1 GREEN: sandboxed surface stack navigation** - `45b139d`
3. **Task 2 RED: popup reservation tests** - `c4c0cf0`
4. **Task 2 GREEN: secure popup reservation and runtime dispatch** - `7addb41`

## Files Created/Modified

- `islands/NappletShell.tsx` - Surface stack and popup reservation controllers plus production browser wiring.
- `routes/api/runtime.ts` - Exact reserve/invoke/ack/claim pairing at the authenticated runtime boundary.
- `routes/intent/reserved.tsx` - Fixed same-origin inert reservation document.
- `static/intent-reserved.js` - Opener-sever-first external bootstrap and reservation ID validation.
- `tests/intent_navigation_test.tsx` - Stack, reuse, popup, failure, sandbox, history, and opener-order coverage.

## Decisions Made

- The reservation open call deliberately omits `noopener` so the shell can commit or close the retained handle; the fixed target severs opener immediately through an external CSP-compatible bootstrap.
- Reuse requires the same account, dTag, and aggregate hash. A dTag-only or cross-account match is never sufficient.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wired the existing intent codecs into the runtime endpoint**
- **Found during:** Task 2
- **Issue:** The 07-02 bridge exposed reserve, acknowledgement, claim, and query methods, but the WebSocket endpoint did not dispatch the decoded messages, blocking the production popup seam.
- **Fix:** Added exact reserve/invoke pairing plus acknowledgement, claim, and query dispatch, including early blocked-ack ordering.
- **Files modified:** `routes/api/runtime.ts`
- **Verification:** Focused navigation/architecture/bridge/resilience tests and `deno task check` pass.
- **Committed in:** `7addb41`

**2. [Rule 2 - Missing Critical] Added the fixed inert reservation route and external opener bootstrap**
- **Found during:** Task 2
- **Issue:** No same-origin target existed to sever opener before launch navigation.
- **Fix:** Added a caller-content-free route and external script that severs opener before validating the bounded hash identifier.
- **Files modified:** `routes/intent/reserved.tsx`, `static/intent-reserved.js`
- **Verification:** Opener-order and inert-route tests pass; full check accepts the route and script.
- **Committed in:** `7addb41`

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 3).
**Impact on plan:** Both changes are required to make the planned secure popup seam operational; no later-plan features were added.

## Issues Encountered

None after the required transport and route seams were added.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

The shell owns secure reuse, popup, and stack browser behavior and is ready for Phase 7 Plan 04 integration verification.

## Self-Check: PASSED

- All six created/modified implementation and test files exist.
- Task commits `0c6fb47`, `45b139d`, `c4c0cf0`, and `7addb41` exist.
- Focused 30-test navigation suite and full format, lint, and type-check gate pass.

---
*Phase: 07-intent-navigation*
*Completed: 2026-07-31*
