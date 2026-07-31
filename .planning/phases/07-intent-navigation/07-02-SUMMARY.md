---
phase: 07-intent-navigation
plan: 02
subsystem: runtime
tags: [intent, dispatcher, launch-ticket, strict-json, lifecycle]
requires:
  - phase: 07-intent-navigation
    provides: Generation-bound exact verified intent handler registry
provides:
  - Exact pinned INTENT and navigation transport codecs
  - Backend-authorized reservation and acknowledgement state machine
  - Private account and target-bound single-use launch tickets
affects: [07-03, 07-04, shell-navigation, intent-transport]
tech-stack:
  added: []
  patterns: [exact-key boundary decoding, opaque single-use capability tickets, idempotent terminal settlement]
key-files:
  created: [tests/intent_runtime_test.ts]
  modified: [runtime/intent.ts, runtime/transport.ts, runtime/portal_runtime.ts]
key-decisions:
  - "Accept navigation authority only through an authenticated source-bound reservation and backend policy check."
  - "Release payload only through an expiring exact-target single-use ticket after exact catalog launch verification."
  - "Revoke unresolved reservations and tickets on account, generation, window, timeout, or terminal acknowledgement changes."
patterns-established:
  - "Public navigation commands contain opaque ticket authority but never intent payload data."
  - "Malformed envelopes fail at the envelope boundary while valid invocations settle with canonical IntentResult outcomes."
requirements-completed: [INT-01, INT-02, INT-03]
coverage:
  - id: D1
    description: "Authenticated exact-handler invocation verifies launch, authorizes navigation, claims one private ticket, and settles once."
    requirement: INT-02
    verification:
      - kind: integration
        ref: "tests/intent_runtime_test.ts#authenticated invocation verifies, tickets, acknowledges, and settles once"
        status: pass
    human_judgment: false
  - id: D2
    description: "Strict 64 KiB payload and lifecycle bounds revoke stale or cross-identity authority."
    requirement: INT-03
    verification:
      - kind: unit
        ref: "tests/intent_runtime_test.ts#intent lifecycle bounds payloads and revokes stale reservations"
        status: pass
    human_judgment: false
duration: 12min
completed: 2026-07-31
status: complete
---

# Phase 7 Plan 2: Authenticated Intent Dispatcher Summary

**Exact verified intent dispatch now uses backend-owned navigation reservations and private expiring single-use payload tickets with idempotent settlement.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-31T04:11:00Z
- **Completed:** 2026-07-31T04:23:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added exact-key codecs for pinned INTENT queries/invocation plus reserve, authorized, acknowledgement, and ticket-claim messages while retaining the 256 KiB frame ceiling.
- Added strict finite, acyclic, plain-own JSON payload validation with a 64 KiB serialized ceiling, bounded depth, keys, arrays, names, and IDs.
- Added exact catalog launch re-verification, generation/account rechecks, backend mode policy, bounded pending work, private ticket claim, and once-only lifecycle settlement.
- Wired per-window availability queries, change notifications, reservations, acknowledgements, claims, and cleanup into the runtime service seams.

## Task Commits

1. **Task 1 RED: authenticated invocation tracer tests** - `86499be`
2. **Task 1 GREEN: verified reservation and ticket tracer** - `49f256c`
3. **Task 2 RED: payload and stale lifecycle tests** - `9daf035`
4. **Task 2 GREEN: lifecycle cleanup and runtime dispatch** - `e62fcd1`

## Files Created/Modified

- `runtime/transport.ts` - Exact pinned codecs and strict bounded JSON payload validation.
- `runtime/intent.ts` - Reservation, verification, ticket, claim, acknowledgement, and terminal settlement state machine.
- `runtime/portal_runtime.ts` - Per-window intent query, notification, dispatch, claim, and lifecycle cleanup seams.
- `tests/intent_runtime_test.ts` - Authenticated tracer, codec, payload, policy, replay, and account-generation revocation coverage.

## Decisions Made

- Shell hints do not grant navigation authority: backend policy allows reuse by default, requires an explicit new-window request for new-tab, and denies incompatible modes.
- Tickets bind the active account, caller connection, exact target window, verified catalog/coordinate/manifest handler identity, generation, convention, payload, and expiry.
- Generation churn immediately settles unresolved work as failed and deletes associated private tickets.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

A runtime-object method insertion initially landed outside the intended object during implementation; it was corrected before commit and all gates pass.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

The backend exact-protocol seam is ready for the 07-03 shell navigation surfaces. No later-plan UI or history work was included here.

## Self-Check: PASSED

- All four created/modified implementation and test files exist.
- Task commits `86499be`, `49f256c`, `9daf035`, and `e62fcd1` exist.
- Focused intent/runtime tests and the full format, lint, and type-check gate pass.

---
*Phase: 07-intent-navigation*
*Completed: 2026-07-31*
