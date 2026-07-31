---
phase: 07-intent-navigation
plan: 01
subsystem: runtime
tags: [intent, catalog, nostr, generation-authority, tdd]
requires:
  - phase: 04-catalog
    provides: Accepted catalog generations and integrity-verified artifacts
provides:
  - Strict immutable canonical archetype declaration codec
  - Verified manifest declaration propagation through production and fixture resolvers
  - Generation-bound deterministic intent handler registry and selection
affects: [07-02, 07-03, intent-transport, shell-navigation]
tech-stack:
  added: []
  patterns: [signed-boundary decoding, last-good display separated from current authority]
key-files:
  created: [runtime/intent.ts, tests/intent_contract_test.ts, tests/intent_registry_test.ts]
  modified: [runtime/catalog.ts, runtime/portal_runtime.ts, tests/catalog_runtime_test.ts, tests/catalog_test.ts]
key-decisions:
  - "Decode and freeze archetype declarations only from exact signed manifest tags at verified artifact construction."
  - "Retain last-good availability during transient replacement work while current-generation selection authority is empty."
  - "Order candidates by dTag then accepted manifest event ID and deny choose or ambiguous explicit-handler requests."
patterns-established:
  - "Intent authority keys retain account, catalog event, accepted manifest, coordinate, dTag, aggregate hash, and archetype identity."
  - "Generation tokens invalidate unresolved work immediately on catalog churn."
requirements-completed: [INT-01, INT-02]
coverage:
  - id: D1
    description: "Canonical signed archetype tags propagate through verified catalog artifacts into availability."
    requirement: INT-01
    verification:
      - kind: integration
        ref: "tests/intent_contract_test.ts and tests/catalog_runtime_test.ts --filter archetype declaration"
        status: pass
    human_judgment: false
  - id: D2
    description: "Current-generation handlers select deterministically and stale authority is revoked."
    requirement: INT-02
    verification:
      - kind: unit
        ref: "tests/intent_registry_test.ts"
        status: pass
    human_judgment: false
duration: 5min
completed: 2026-07-31
status: complete
---

# Phase 7 Plan 1: Trusted Intent Registry Summary

**Strict signed-manifest archetype decoding feeds a deterministic, generation-bound intent registry without granting stale catalog authority.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-31T04:05:13Z
- **Completed:** 2026-07-31T04:09:23Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added an exact three-field, bounded, duplicate-collapsing, deeply immutable archetype declaration codec at the signed manifest verification boundary.
- Propagated declarations through both production and fixture catalog resolvers and retained exact verified artifact identity behind the CatalogService authority seam.
- Added deterministic handler availability and selection with explicit generation guards, stale-display separation, canonical failures, and account/catalog revocation.

## Task Commits

1. **Task 1 RED: archetype declaration tracer tests** - `a8534d8`
2. **Task 1 GREEN: verified archetype propagation** - `9bbd357`
3. **Task 2 RED: generation registry tests** - `b863077`
4. **Task 2 GREEN: deterministic generation-bound selection** - `7df0a0c`
5. **Task 2 gate fix: lint-clean test callback** - `6eab048`

## Files Created/Modified

- `runtime/intent.ts` - Catalog-derived registry, canonical availability, selection policy, and generation guards.
- `runtime/catalog.ts` - Strict decoder, verified declarations, and current ready-artifact authority snapshot.
- `runtime/portal_runtime.ts` - Production and fixture signed-tag propagation.
- `tests/intent_contract_test.ts` - Pinned contract and malformed tag coverage.
- `tests/intent_registry_test.ts` - Ordering, explicit/default selection, churn, and stale-authority coverage.
- `tests/catalog_runtime_test.ts` - Production resolver declaration tracer.
- `tests/catalog_test.ts` - Updated verified artifact fixture contract.

## Decisions Made

- Availability projects only pinned public candidate fields; executable bytes and account/relay internals remain private.
- A pending replacement may preserve the prior availability display, but selection reads only the empty/current verified registry.
- `choose` is denied until a later plan owns interactive policy; explicit dTag selection requires exactly one eligible current match.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prevented recursive catalog refresh during intent notifications**
- **Found during:** Task 2
- **Issue:** Reading the authority snapshot from a catalog notification refreshed pending state recursively.
- **Fix:** Made the snapshot a side-effect-free view of the already-current CatalogService projection.
- **Files modified:** `runtime/catalog.ts`
- **Verification:** Registry churn tests and full check pass.
- **Committed in:** `7df0a0c`

**2. [Rule 3 - Blocking] Corrected an intentionally unused test callback argument**
- **Found during:** Overall verification
- **Issue:** Deno lint rejected the unused coordinate argument.
- **Fix:** Prefixed only the unused callback argument with an underscore.
- **Files modified:** `tests/intent_registry_test.ts`
- **Verification:** `deno task check` passes.
- **Committed in:** `6eab048`

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking gate issue)
**Impact on plan:** Both fixes were required for correct notification behavior and a clean quality gate; no scope expansion.

## Issues Encountered

None remaining.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

The exact current handler generation, deterministic selection result, and token guard are ready for the transport and navigation settlement plans. No blockers remain.

## Self-Check: PASSED

- All seven created/modified implementation and test files exist.
- Task commits `a8534d8`, `9bbd357`, `b863077`, `7df0a0c`, and `6eab048` exist.
- Focused intent/catalog tests and `deno task check` pass.

---
*Phase: 07-intent-navigation*
*Completed: 2026-07-31*
