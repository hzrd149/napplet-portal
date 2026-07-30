---
phase: 02-backend-runtime-expansion
plan: "06"
subsystem: installed-catalog-ui
tags: [fresh, preact, catalog, websocket, accessibility]
requires:
  - phase: 02-backend-runtime-expansion
    plan: "04"
    provides: accepted-manifest catalog projection and serialized mutations
  - phase: 02-backend-runtime-expansion
    plan: "05"
    provides: persistent shell navigation and signer-aware settings UI
provides:
  - Stream-updating responsive installed-napplet catalog cards
  - Accessible stale-safe update review and uninstall dialogs
  - Production WebSocket projection and correlated catalog mutation dispatch
affects: [02-07-contract-coverage, installed-catalog, runtime-transport]
tech-stack:
  added: []
  patterns: [stable coordinate keyed cards, native modal mutation review, process-owned reactive catalog]
key-files:
  created: [tests/catalog_ui_test.tsx]
  modified: [components/HomeView.tsx, islands/NappletShell.tsx, assets/styles.css, main.ts, routes/api/runtime.ts, runtime/catalog.ts, runtime/portal_runtime.ts, tests/catalog_test.ts, tests/shell_architecture_test.ts]
key-decisions:
  - "Accepted manifest event IDs remain the only launch authority; unresolved entries cannot launch."
  - "Catalog projection listeners emit from one process-owned CatalogService after verified loads or fully accepted mutations."
  - "Native dialogs close on stale catalog identity and return focus to their invoking card action."
requirements-completed: [V2-09, V2-10]
coverage:
  - id: D1
    description: "Zero, one, many, loading, stale, error, and unresolved catalog states preserve synchronized cards and exact status copy."
    requirement: V2-09
    verification:
      - kind: integration
        ref: "tests/catalog_ui_test.tsx#installed catalog covers empty, loading, stale, error, populated, and partial states"
        status: pass
    human_judgment: false
  - id: D2
    description: "Accepted verified manifest identity alone launches a persistent sandboxed frame."
    requirement: V2-09
    verification:
      - kind: integration
        ref: "tests/catalog_ui_test.tsx#accepted manifest identity is the only launch authority"
        status: pass
    human_judgment: false
  - id: D3
    description: "Update and uninstall dialogs present complete attested detail, pending/error states, stale closure, and focus restoration."
    requirement: V2-10
    verification:
      - kind: integration
        ref: "tests/catalog_ui_test.tsx#update review renders complete attested comparison and capability changes"
        status: pass
    human_judgment: false
  - id: D4
    description: "At 320px names clamp, public identifiers truncate without hiding actions, and modal content remains viewport-safe."
    requirement: V2-09
    verification:
      - kind: manual_procedural
        ref: "Open Home at 320px with long catalog metadata and inspect cards and dialogs"
        status: unknown
    human_judgment: true
duration: 13min
completed: 2026-07-30
status: complete
---

# Phase 2 Plan 6: Installed Catalog Experience Summary

**The mobile Home view now renders synchronized accepted-manifest cards and performs signer-backed update or uninstall mutations through accessible, stale-safe dialogs and the process-owned runtime.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-30T20:45:41Z
- **Completed:** 2026-07-30T20:58:40Z
- **Tasks:** 2 TDD tasks
- **Files modified:** 10

## Accomplishments

- Replaced the configured starter tile with stable coordinate-keyed cards covering empty, loading, stale, error, unresolved, one, and many catalog states.
- Kept the accepted integrity-verified manifest ID as the only launch authority while preserving the single mounted sandboxed iframe.
- Added native update and uninstall dialogs with attested identifiers, copy actions, capability diffs, pending/error states, signer gating, stale closure, Escape behavior, and focus return.
- Composed `CatalogService` into the production runtime, synchronized signed replacements from configured relays, emitted projections to browser sessions, and dispatched correlated approval/uninstall commands.
- Passed all 92 repository tests plus formatting, lint, and TypeScript checks.

## Task Commits

1. **RED: Define synchronized catalog card behavior** - `6f3b460` (test)
2. **GREEN: Render accepted catalog cards** - `bf816a0` (feat)
3. **RED: Define accessible mutation dialogs** - `2759f6c` (test)
4. **GREEN: Add stale-safe mutation dialogs** - `025f5c2` (feat)
5. **Rule 1: Preserve unconfigured setup guidance** - `e1ffa54` (fix)
6. **Rule 4: Wire catalog through production runtime** - `6de1977` (feat)

## Files Created/Modified

- `components/HomeView.tsx` - Catalog grid, cards, exact stream states, update comparison, uninstall confirmation, and accessible status behavior.
- `islands/NappletShell.tsx` - Projection state, accepted-entry launch, correlated commands, Back ordering, and persistent iframe integration.
- `assets/styles.css` - Responsive auto-fit cards, overflow containment, modal comparison layout, truncation, and accessible targets.
- `main.ts`, `runtime/catalog.ts`, `runtime/portal_runtime.ts` - Process catalog composition, relay synchronization, verified projection notifications, and mutation lifecycle.
- `routes/api/runtime.ts` - WebSocket catalog projection emission and direct correlated command dispatch.
- `tests/catalog_ui_test.tsx`, `tests/catalog_test.ts`, `tests/shell_architecture_test.ts` - UI, listener, production wiring, signer, and iframe-authority coverage.

## Decisions Made

- Preserved card identity by coordinate while launch identity remains the accepted manifest event ID and verified artifact projection.
- Kept catalog signing, publication, relay synchronization, and verification behind the WebSocket boundary; the island only presents public projection and dispatches typed commands.
- Used native dialogs for focus trapping and Escape semantics, with explicit stale-catalog invalidation keyed to the replacement event ID.

## Deviations from Plan

### Authorized Architectural Deviation

**1. [Rule 4 - Architecture] Composed CatalogService into the production runtime**
- **Found during:** Task 2 stub and threat-surface scan
- **Issue:** The existing `/api/runtime` still used the Phase 1 tracer and neither emitted catalog projections nor dispatched catalog commands; completing the UI alone would leave every operation non-functional.
- **Authorization:** User explicitly approved the narrow runtime-composition expansion.
- **Fix:** Configured one process-owned `CatalogService`, synchronized signed replacements through the shared relay/event runtime, added projection listeners, and routed correlated commands/results through the existing same-origin WebSocket.
- **Files modified:** `main.ts`, `routes/api/runtime.ts`, `runtime/catalog.ts`, `runtime/portal_runtime.ts`, focused tests
- **Verification:** Focused 19-test catalog/transport suite, full 92-test suite, and `deno task check`
- **Commit:** `6de1977`

### Auto-fixed Issues

**2. [Rule 1 - Bug] Preserved unconfigured setup guidance**
- **Found during:** Full-suite verification after Task 2
- **Issue:** Replacing the configured tile also removed the required setup view when no coordinate exists.
- **Fix:** Kept setup guidance as the outer Home state and rendered the synchronized catalog only for configured portals.
- **Files modified:** `components/HomeView.tsx`, `islands/NappletShell.tsx`
- **Verification:** `tests/setup_visibility_test.tsx`, focused UI suite, and full suite
- **Commit:** `e1ffa54`

**Total deviations:** 1 authorized architectural expansion and 1 auto-fixed bug. **Impact:** The UI is backed by real process-owned catalog transport without weakening signer, artifact, or iframe trust boundaries.

## Issues Encountered

None remaining.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None - projection-to-browser, iframe/card-to-command, stale mutation, and destructive confirmation surfaces are covered by T-02-14 through T-02-16 and retain same-origin WebSocket and backend verification boundaries.

## Verification

- `deno test -A tests/catalog_ui_test.tsx tests/shell_architecture_test.ts tests/end_to_end_test.ts` — 22 passed, 0 failed after final catalog listener addition (covered within focused/full reruns).
- `deno test -A tests/catalog_test.ts tests/catalog_ui_test.tsx tests/websocket_session_test.ts tests/end_to_end_test.ts` — 19 passed, 0 failed.
- `deno task test` — 92 passed, 0 failed.
- `deno task check` — formatting, lint, and TypeScript checks passed.
- 320px responsive layout remains an explicit end-of-phase human backstop.

## Self-Check: PASSED

- Created test artifact and every modified production file exist.
- Commits `6f3b460`, `bf816a0`, `2759f6c`, `025f5c2`, `e1ffa54`, and `6de1977` exist.
- All task acceptance suites, plan verification commands, and the complete repository suite pass.

## Next Phase Readiness

- Plan 02-07 can exercise the catalog WebSocket frames alongside the pinned Kehto/Napplet dispatch lifecycle.
- Browser UAT remains appropriate for the 320px card/dialog overflow and target-size backstop.

---
*Phase: 02-backend-runtime-expansion*
*Completed: 2026-07-30*
