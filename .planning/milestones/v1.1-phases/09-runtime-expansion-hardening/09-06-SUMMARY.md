---
phase: 09-runtime-expansion-hardening
plan: "06"
subsystem: browser-lifecycle-security
tags: [deno, intent, media, websocket, reconnect, tdd]
requires:
  - phase: 09-runtime-expansion-hardening
    plan: "05"
    provides: closed browser response and frame boundaries
  - phase: 07-intent-navigation
    provides: process-owned single-use intent ticket navigation
  - phase: 08-cross-tab-media-sessions
    provides: generation-reduced cross-tab media ownership
provides:
  - two-sided claim-and-commit intent terminalization with exact cleanup
  - current attachment-generation fencing across reconnect replacement
  - hostile media ordering, duplicate, shutdown, and partial-truth evidence
affects: [09-07-exhaustive-lifecycle, 09-09-final-reconciliation, QLT-02, QLT-03]
tech-stack:
  added: []
  patterns: [two-sided terminal correlation, post-await attachment revalidation, revoke-before-grant lifecycle reducer]
key-files:
  created: [tests/adversarial_browser_lifecycle_test.ts]
  modified: [runtime/intent.ts, runtime/connections.ts, routes/api/runtime.ts]
key-decisions:
  - "Terminalize successful intent navigation only after both the caller commit and exact single-use target claim; either order is valid."
  - "Treat connection attachment generation as process-owned authority and recheck it before dispatch and after signer/artifact awaits."
  - "Leave QLT ledger completion to Plan 09-09 final reconciliation."
patterns-established:
  - "Intent completion: claim plus commit succeeds once; denial, expiry, replacement, account change, closure, and shutdown fail once and erase authority."
  - "Reconnect completion: an old socket generation is inert even when its underlying browser socket remains open."
requirements-completed: []
coverage:
  - id: D1
    description: "Intent tickets remain exact-target, single-use, generation-bound, and inert after replacement or terminal completion."
    requirement: QLT-02
    verification:
      - kind: integration
        ref: "tests/adversarial_browser_lifecycle_test.ts#intent lifecycle tracer terminalizes only after claim and commit"
        status: pass
      - kind: integration
        ref: "tests/adversarial_browser_lifecycle_test.ts#intent lifecycle tracer revokes replacement before late completion"
        status: pass
    human_judgment: false
  - id: D2
    description: "Reconnect replacement rejects stale attachment generations before runtime dispatch and late artifact effects."
    requirement: QLT-03
    verification:
      - kind: integration
        ref: "tests/adversarial_browser_lifecycle_test.ts#reconnect replacement fences stale attachment generations"
        status: pass
    human_judgment: false
  - id: D3
    description: "Media ownership revokes before grant while duplicate, conflicting, stale, and shutdown work terminalizes deterministically."
    requirement: QLT-03
    verification:
      - kind: integration
        ref: "tests/adversarial_browser_lifecycle_test.ts#media lifecycle revokes before grant and terminalizes duplicate work"
        status: pass
      - kind: integration
        ref: "deno test -A tests/adversarial_browser_lifecycle_test.ts tests/media_lifecycle_test.ts tests/media_transport_test.ts tests/connection_controller_test.ts tests/runtime_transport_test.ts"
        status: pass
    human_judgment: false
duration: 7min
completed: 2026-07-31
status: complete
---

# Phase 9 Plan 6: Browser Lifecycle Adversarial Remediation Summary

**Intent navigation now requires an exact target claim plus caller commit, while reconnect generation fences and ordered media reducers make stale browser lifecycle work inert.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-31T06:41:14Z
- **Completed:** 2026-07-31T06:48:03Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Fixed the real popup ordering seam so a caller commit cannot delete the target's single-use intent ticket before it is claimed.
- Revalidated intent account and generation at terminal acknowledgement, with replacement and late completion settling once without payload leakage.
- Added an exact process-owned attachment-generation fence before runtime socket dispatch and after asynchronous signer/artifact work.
- Proved media revoke-before-grant ordering, effect-free exact replay, conflicting correlation denial, shutdown terminalization, and immediately observable partial truth.
- Passed 17 focused lifecycle tests, 11 broader intent tests, `deno task check`, and the complete 265-test repository suite with zero red rows.

## Task Commits

1. **Task 1 RED: failing intent lifecycle tracer** — `a906132`
2. **Task 1 GREEN: claim-and-commit intent terminalization** — `d0872c0`
3. **Task 2 RED: failing reconnect generation fence** — `5f3f8ff`
4. **Task 2 GREEN: current socket generation remediation** — `be73faf`

## Files Created/Modified

- `tests/adversarial_browser_lifecycle_test.ts` — intent, replacement, reconnect, media ordering, duplicate, and shutdown hostile rows.
- `runtime/intent.ts` — two-sided intent success terminalization plus account/generation revalidation and expiry cleanup.
- `runtime/connections.ts` — exact current attachment-generation authority query.
- `routes/api/runtime.ts` — stale generation rejection before dispatch and after signer/artifact awaits.

## Decisions Made

- A successful intent correlation requires both caller commit and target claim, in either arrival order; all negative terminal states still settle immediately.
- Attachment generation belongs to the backend registry, not browser input, and must be current both before work and immediately before late effects.
- Existing media reducers already satisfied the closed hostile table; focused adversarial evidence was added without duplicating reducer state.
- QLT-02 and QLT-03 remain pending in `REQUIREMENTS.md`; only Plan 09-09 performs final ledger reconciliation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None beyond the expected TDD RED gates.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. Empty arrays and null values found by the mechanical scan are test accumulators or intentional closed lifecycle state, not application stubs.

## Next Phase Readiness

- Focused intent, media, reconnect, replacement, late-completion, and shutdown rows are zero-red for the exhaustive lifecycle wave.
- The lockfile, generated output, and pre-existing research caches remain untouched.
- QLT reconciliation remains explicitly deferred to Plan 09-09.

## Self-Check: PASSED

- The new adversarial suite and all three modified owner files exist.
- All four RED/GREEN task commits exist.
- Focused tests, broader intent tests, repository check, and all 265 tests pass.

---
*Phase: 09-runtime-expansion-hardening*
*Completed: 2026-07-31*
