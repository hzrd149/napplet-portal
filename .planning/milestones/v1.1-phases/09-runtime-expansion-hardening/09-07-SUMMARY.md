---
phase: 09-runtime-expansion-hardening
plan: "07"
subsystem: testing
tags: [deno, websocket, lifecycle, reconnect, coverage, production-smoke]
requires:
  - phase: 09-runtime-expansion-hardening
    plans: ["02", "03", "04", "05", "06"]
    provides: hardened transport, authority, persistence, browser, and async lifecycle seams
provides:
  - deterministic ten-domain lifecycle evidence join
  - built Fresh two-client ownership and reconnect smoke entry point
  - deterministic pending-correlation shutdown cleanup
  - release check, full-test, coverage, build, and production-smoke evidence
affects: [09-08, 09-09, release-quality, runtime-transport]
tech-stack:
  added: []
  patterns: [injected-clock lifecycle proofs, registry-to-evidence joins, composed built-server smoke entry point]
key-files:
  created: [tests/lifecycle_matrix_test.ts, tests/production_multiclient_smoke_test.ts]
  modified: [runtime/connections.ts, deno.json, .gitignore]
key-decisions:
  - "Use the process-owned connection registry and injected timers for deterministic reconnect, replacement, expiry, and shutdown evidence."
  - "Compose the existing built two-client media and reconnect processes behind one production smoke task rather than replace real transport with mocks."
  - "Leave QLT-03 ledger completion to Plan 09-09 final reconciliation."
patterns-established:
  - "Every supported contract domain joins normal, empty, partial, stale, denied, timeout, reconnect, replacement, shutdown, and mixed-settlement evidence."
  - "Pending timer registries expose bounded ownership and cancel all work synchronously on destroy."
requirements-completed: []
coverage:
  - id: D1
    description: "Every supported runtime contract row joins complete deterministic lifecycle evidence."
    requirement: QLT-03
    verification:
      - kind: integration
        ref: "tests/lifecycle_matrix_test.ts#every supported contract row joins complete lifecycle evidence"
        status: pass
    human_judgment: false
  - id: D2
    description: "Built Fresh transport preserves two-client ordering, ownership, reconnect grace, stale fencing, and teardown."
    requirement: QLT-03
    verification:
      - kind: e2e
        ref: "deno task test:production-multiclient"
        status: pass
    human_judgment: false
  - id: D3
    description: "Release check, 271-test suite, coverage report, and production build pass."
    requirement: QLT-03
    verification:
      - kind: integration
        ref: "deno task check && deno task test && deno test -A --coverage=.coverage && deno coverage .coverage && deno task build"
        status: pass
    human_judgment: false
duration: 14min
completed: 2026-07-31
status: complete
---

# Phase 09 Plan 07: Deterministic Lifecycle and Production Multi-Client Summary

**A ten-domain lifecycle matrix and built Fresh multi-client transport now prove ordered streaming, ownership fencing, reconnect grace, expiry, and shutdown under the complete release gate.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-31T06:50:05Z
- **Completed:** 2026-07-31T07:04:05Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Proved immediate partial truth, ordered reconnect updates, stale-generation rejection, subscription replacement, grace expiry, and correlation shutdown with injected deterministic clocks.
- Joined all supported rows in the pinned ten-domain contract registry to normal, empty, partial, stale, denied, timeout, reconnect, replacement, shutdown, and mixed-settlement evidence.
- Added one production smoke task that runs the real built Fresh two-client media ownership and reconnect namespace scenarios with bounded readiness and `finally` teardown.
- Passed 271 tests, produced a coverage report at 81.5% branch / 77.7% function / 72.6% line, and completed the production build.

## Task Commits

1. **Task 1: Trace one partial stream through reconnect, replacement, and shutdown deterministically** - `dbc9ed7` (RED), `d873156` (GREEN)
2. **Task 2: Exhaust lifecycle rows and run a two-plus-client built-server scenario** - `711637b` (RED), `d949f49` (GREEN)

Additional release hygiene: `4a37dbe` (generated coverage ignore).

## Files Created/Modified

- `tests/lifecycle_matrix_test.ts` - Injected-clock tracer and exhaustive domain/lifecycle evidence join.
- `tests/production_multiclient_smoke_test.ts` - Unified real-production multi-client and reconnect smoke entry point.
- `runtime/connections.ts` - Observable pending-correlation count and deterministic shutdown cancellation.
- `deno.json` - Dedicated `test:production-multiclient` release command.
- `.gitignore` - Generated Deno coverage output exclusion.

## Decisions Made

- Used existing process-owned connection and correlation owners for lifecycle assertions so the tracer tests production semantics without a parallel test-only state machine.
- Kept real process smoke polling bounded; deterministic unit and integration lifecycle tests contain no wall-clock sleeps.
- Deferred the QLT-03 checkbox and requirement ledger mutation to Plan 09-09, which owns final reconciliation across all Phase 09 evidence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added deterministic pending-correlation shutdown**
- **Found during:** Task 1
- **Issue:** Pending correlations exposed no bounded ownership count or process-shutdown cancellation, so late timers could remain after teardown.
- **Fix:** Added `pendingCount` and synchronous `destroy()` timer cancellation.
- **Files modified:** `runtime/connections.ts`
- **Verification:** Lifecycle tracer passes with zero pending correlations and zero fake-clock timers.
- **Committed in:** `d873156`

**2. [Rule 3 - Blocking generated output] Ignored coverage artifacts**
- **Found during:** Overall verification
- **Issue:** The mandatory coverage gate left `.coverage/` as untracked generated output.
- **Fix:** Added `.coverage/` to `.gitignore` while preserving the generated report locally.
- **Files modified:** `.gitignore`
- **Verification:** `git status --short` no longer reports coverage output.
- **Committed in:** `4a37dbe`

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 3)
**Impact on plan:** Both changes are required for deterministic teardown and clean release-gate operation; no feature scope was added.

## Issues Encountered

`deno coverage` emitted non-fatal warnings for source maps created inside isolated build processes and five transpiled modules unavailable after subprocess teardown. It exited successfully and produced the complete aggregate report; behavioral gates remain the release authority rather than a percentage threshold.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All lifecycle and real-transport evidence is available for Phase 09 final reconciliation. QLT-03 remains intentionally unmarked until Plan 09-09 evaluates the complete phase ledger.

## Self-Check: PASSED

- Created lifecycle and production smoke files exist.
- RED/GREEN commits `dbc9ed7`, `d873156`, `711637b`, and `d949f49` exist.
- `deno task check`, 271 full tests, coverage collection/report, production build, and the dedicated four-test production smoke all pass.
- Research cache files were preserved and QLT requirements were not marked early.

---
*Phase: 09-runtime-expansion-hardening*
*Completed: 2026-07-31*
