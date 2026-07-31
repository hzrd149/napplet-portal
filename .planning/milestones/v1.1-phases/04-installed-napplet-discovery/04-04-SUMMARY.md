---
phase: 04-installed-napplet-discovery
plan: "04"
subsystem: ui
tags: [preact, accessibility, mobile, catalog, local-search]
requires:
  - phase: 04-installed-napplet-discovery
    provides: Backend-authoritative preview, approval, partial projection, and verified launch commands
provides:
  - Mobile naddr install form with immutable generation-bound trust review
  - Coordinate-keyed partial-state launcher with backend-success-only navigation
  - Query-preserving local search with accessible result and empty-state semantics
  - Auditable Phase 4 external API boundary classification
affects: [phase-05, catalog-ui, mobile-shell, runtime-security]
tech-stack:
  added: []
  patterns: [shell-owned query state, pure immediate projection filter, native generation-bound trust dialog]
key-files:
  created: [.planning/phases/04-installed-napplet-discovery/04-04-SUMMARY.md]
  modified: [components/HomeView.tsx, islands/NappletShell.tsx, assets/styles.css, tests/catalog_ui_test.tsx, .planning/phases/04-installed-napplet-discovery/COVERAGE.md]
key-decisions:
  - "Keep the raw catalog query in the shell and derive visible entries synchronously without transport work."
  - "Treat install review as immutable backend data bound to the source catalog event and clear input only after accepted approval."
  - "Navigate to the mounted napplet only after the exact accepted triple returns verified launch bytes."
patterns-established:
  - "Home filters partial projections locally while synchronization notices remain independently visible."
  - "Trust dialogs invalidate on catalog replacement and return focus to their invoking control."
requirements-completed: [CAT-01, CAT-02, CAT-03, CAT-04]
coverage:
  - id: D1
    description: "A mobile user can preview immutable trust facts and install an naddr through generation-bound backend approval."
    requirement: CAT-01
    verification:
      - kind: automated_ui
        ref: "tests/catalog_ui_test.tsx#install form and immutable review expose every trust fact with retry state"
        status: pass
    human_judgment: false
  - id: D2
    description: "Accepted entries remain coordinate-keyed and understandable across loading, ready, stale, error, pending, and unavailable states."
    requirement: CAT-02
    verification:
      - kind: automated_ui
        ref: "tests/catalog_ui_test.tsx#installed catalog covers empty, loading, stale, error, populated, and partial states"
        status: pass
    human_judgment: false
  - id: D3
    description: "Only ready accepted cards launch, and navigation occurs only after backend verification while one iframe remains mounted."
    requirement: CAT-03
    verification:
      - kind: e2e
        ref: "tests/end_to_end_test.ts and tests/catalog_ui_test.tsx#accepted manifest identity is the only launch authority"
        status: pass
    human_judgment: false
  - id: D4
    description: "Local case-insensitive search filters current partial metadata, preserves streamed query state, and announces distinct results without network work."
    requirement: CAT-04
    verification:
      - kind: automated_ui
        ref: "tests/catalog_ui_test.tsx#local catalog search matches only current public metadata"
        status: pass
    human_judgment: false
duration: 16min
completed: 2026-07-31
status: complete
---

# Phase 4 Plan 4: Mobile Installed Catalog Summary

**Accessible mobile install, partial-state search, and verified launch UX over the backend-authoritative catalog seam**

## Performance

- **Duration:** 16 min
- **Started:** 2026-07-31T01:23:00Z
- **Completed:** 2026-07-31T01:39:24Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added one prominent labeled naddr action whose input and immutable trust review survive resolution or publish failure and invalidate safely on catalog replacement.
- Completed coordinate-keyed pending, ready, unavailable, stale, error, and accepted-old-version presentation with backend-success-only launch into the existing frame.
- Added immediate case-insensitive search across only title, final coordinate identifier, version, and capabilities, with query persistence and accessible result semantics.
- Classified all touched Kehto, NAP, catalog transport, executable-byte, and sibling-source boundaries with CAT-01 through CAT-04 evidence.

## Task Commits

1. **Task 1: Install and launch one reviewed napplet from mobile Home** - `afb58bb`
2. **Task 2: Filter the live partial catalog and audit the external API surface** - `68ea204`

## Files Created/Modified

- `components/HomeView.tsx` - Install/review state, partial cards, pure filtering, accessible search, and dialogs.
- `islands/NappletShell.tsx` - Persistent query ownership and preview command dispatch through the bounded registry.
- `assets/styles.css` - Semantic mobile form/search controls and safe touch targets.
- `tests/catalog_ui_test.tsx` - Trust-fact, retry, local matching, no-match, query persistence, and no-network coverage.
- `.planning/phases/04-installed-napplet-discovery/COVERAGE.md` - External API classification, requirement traceability, and threat evidence.

## Decisions Made

- No debounce or search transport exists: installed-catalog scale is handled by a pure linear filter over the latest projection.
- Review fields come only from the correlated server preview; the browser neither derives manifest authority nor creates optimistic cards.
- Raw event IDs and aggregate hashes appear only in explicit review UI and never participate in search.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first full-suite run encountered a transient connection refusal in the existing production WebSocket smoke test. Its focused rerun passed, and the complete suite then passed 143/143 without code changes.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Verification

- `deno test -A tests/catalog_ui_test.tsx tests/end_to_end_test.ts` — 17 passed.
- `deno task test` — 143 passed.
- `deno task check` — format, lint, and type checks passed.
- `deno task build` — client and server production builds passed.

## Next Phase Readiness

- Phase 4 CAT-01 through CAT-04 and decisions D-01 through D-13 are complete and observable through the mobile Home surface.
- Later phases can add new NAP domains without changing catalog or iframe authority boundaries.

## Self-Check: PASSED

- All five implementation, test, and coverage files exist.
- Task commits `afb58bb` and `68ea204` exist.
- Full test, check, and production build gates pass.

---
*Phase: 04-installed-napplet-discovery*
*Completed: 2026-07-31*
