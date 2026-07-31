---
phase: 04-installed-napplet-discovery
plan: "02"
subsystem: runtime
tags: [nostr, catalog, applesauce, rxjs, blossom, integrity]
requires:
  - phase: 04-installed-napplet-discovery
    provides: CatalogService accepted-manifest authority and bounded relay preview policy
provides:
  - Arbitrary kind-35129 production manifest resolution through exact relay loads
  - Verified preview-to-approval-to-launch path with no fixture-coordinate gate
  - Generation-guarded account, settings, EOSE, error, and reconnect catalog synchronization
affects: [04-03, 04-04, catalog-ui, runtime-transport]
tech-stack:
  added: []
  patterns: [exact-event artifact boundary, unsubscribe-before-replace synchronization]
key-files:
  created: [tests/catalog_runtime_test.ts]
  modified: [main.ts, runtime/event_runtime.ts, runtime/portal_runtime.ts, runtime/catalog.ts]
key-decisions:
  - "Load preview manifests by exact coordinate filter and accepted launches by exact event ID before applying the shared artifact verifier."
  - "Serialize catalog network ownership through one generation-guarded owner driven by combined account and settings streams."
patterns-established:
  - "Request-scoped naddr hints are bounded by RelayPolicy and never written into runtime settings."
  - "Relay errors and reconnects change status while retaining last-good catalog truth; account changes alone clear authority."
requirements-completed: [CAT-01, CAT-02, CAT-03]
coverage:
  - id: D1
    description: Arbitrary non-fixture napplets complete verified preview, approval, and exact-selector launch through production composition.
    requirement: CAT-01
    verification:
      - kind: integration
        ref: tests/catalog_runtime_test.ts#production resolver previews, approves, and launches an arbitrary exact manifest
        status: pass
    human_judgment: false
  - id: D2
    description: Manifest identity, signature, aggregate, and blob mismatches fail closed without executable bytes.
    requirement: CAT-02
    verification:
      - kind: integration
        ref: tests/catalog_runtime_test.ts#production resolver rejects exact identity and integrity mismatches without bytes
        status: pass
    human_judgment: false
  - id: D3
    description: Account, relay settings, EOSE, error, reconnect, and teardown drive one generation-safe catalog subscription.
    requirement: CAT-03
    verification:
      - kind: integration
        ref: tests/catalog_runtime_test.ts#catalog sync replaces account and settings work, preserves last-good state, and rejects late generations
        status: pass
    human_judgment: false
duration: 7min
completed: 2026-07-31
status: complete
---

# Phase 4 Plan 02: Production Catalog Runtime Summary

**Arbitrary kind-35129 napplets now traverse policy-bounded relay discovery, exact manifest identity checks, Blossom integrity verification, and generation-safe catalog synchronization.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-31T01:16:00Z
- **Completed:** 2026-07-31T01:23:05Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Removed the production fixture-coordinate gate for normalized kind-35129 catalog coordinates while preserving the legacy startup tracer.
- Verified event ID, kind, publisher, d-tag, signature, aggregate, and every artifact blob before review facts or executable srcdoc are returned.
- Added one process-owned synchronization owner that replaces account/settings work deterministically, rejects late generations, and preserves last-good state on transient failures.

## Task Commits

1. **TDD RED: production runtime coverage** - `abb9721` (test)
2. **Task 1: Preview and launch one non-fixture napplet through production composition** - `2fc7348` (feat)
3. **Task 2: Drive catalog synchronization from account, settings, and relay lifecycle** - `5e0b40e` (feat)

## Files Created/Modified

- `tests/catalog_runtime_test.ts` - Non-fixture production integration and synchronization lifecycle coverage.
- `runtime/event_runtime.ts` - Exact coordinate/event loading and generation-guarded catalog subscription owner.
- `runtime/portal_runtime.ts` - Production resolver composed with the established artifact verification boundary.
- `runtime/catalog.ts` - Explicit loading/ready/stale/error/account-reset signals and null-safe preview generation comparison.
- `main.ts` - Production RelayPolicy, preview resolver, and reactive catalog owner composition.

## Decisions Made

- Preview uses the coordinate filter because no accepted immutable ID exists yet; approval and launch always reload the exact selected event ID.
- Settings replacement and reconnect unsubscribe before resubscribing, and callbacks are additionally guarded by generation to reject non-cooperative late sources.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Normalized empty-catalog generation comparison**
- **Found during:** Task 1 production preview-to-approval tracer
- **Issue:** Preview correctly represented an absent source catalog as `null`, but approval compared it to the store's `undefined`, rejecting an unchanged empty generation.
- **Fix:** Normalize the current absent event ID to `null` before comparison.
- **Files modified:** `runtime/catalog.ts`
- **Verification:** Non-fixture preview-to-approval-to-launch integration test passes.
- **Committed in:** `2fc7348`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** The fix is required for first-install correctness and does not broaden catalog ownership.

## Issues Encountered

None beyond the auto-fixed empty-generation mismatch.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Production catalog authority is ready for Plan 03 native discovery and review UI wiring. No blockers remain.

## Self-Check: PASSED

- All five created/modified implementation files exist.
- Commits `abb9721`, `2fc7348`, and `5e0b40e` exist in git history.
- Overall verification passed: 15 tests plus `deno task check`.

---
*Phase: 04-installed-napplet-discovery*
*Completed: 2026-07-31*
