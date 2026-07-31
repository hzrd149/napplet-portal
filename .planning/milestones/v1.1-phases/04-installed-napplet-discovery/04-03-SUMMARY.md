---
phase: 04-installed-napplet-discovery
plan: "03"
subsystem: runtime-transport
tags: [websocket, catalog, codecs, backpressure, preact]
requires:
  - phase: 04-installed-napplet-discovery
    provides: Process-owned catalog authority, projection stream, and verified launch operation
provides:
  - Exact correlated preview, approval, uninstall, and launch WebSocket commands
  - Per-socket 32-command backpressure with deterministic cleanup and recovery
  - Last-good catalog display with independent synchronization status
  - Backend-authoritative verified launch into the existing mounted iframe
affects: [04-04, catalog-ui, runtime-transport, security]
tech-stack:
  added: []
  patterns: [exact-key wire codecs, correlated bounded promises, generation-retired stream filtering]
key-files:
  created: []
  modified:
    - runtime/transport.ts
    - runtime/portal_runtime.ts
    - routes/api/runtime.ts
    - islands/NappletShell.tsx
    - components/HomeView.tsx
    - shell/connection.ts
    - tests/catalog_ui_test.tsx
key-decisions:
  - "Catalog projections contain display metadata only; executable bytes cross the WebSocket solely in a correlated successful launch result."
  - "Every socket generation shares a bounded 32-entry registry that settles on result, timeout, replacement, closure, or teardown."
  - "Catalog status is transported independently from optional data so errors preserve the last-good projection."
patterns-established:
  - "Authority commands use exact-key decoders and carry only backend-required selectors."
  - "The shell remembers retired catalog event IDs and rejects late pushes from superseded generations."
requirements-completed: [CAT-01, CAT-02, CAT-03]
coverage:
  - id: D1
    description: Strict correlated catalog commands and bounded per-socket backpressure
    requirement: CAT-02
    verification:
      - kind: integration
        ref: "tests/catalog_ui_test.tsx#catalog command codecs and registry tests"
        status: pass
    human_judgment: false
  - id: D2
    description: Verified installed-card launch is backend-authoritative and stale-safe
    requirement: CAT-03
    verification:
      - kind: e2e
        ref: "deno test -A tests/end_to_end_test.ts tests/catalog_ui_test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: Partial catalog pushes preserve last-good cards across synchronization errors
    requirement: CAT-01
    verification:
      - kind: automated_ui
        ref: "tests/catalog_ui_test.tsx#installed catalog stream states"
        status: pass
    human_judgment: false
duration: 12min
completed: 2026-07-31
status: complete
---

# Phase 4 Plan 3: Production Catalog Runtime Seam Summary

**Strict catalog codecs, correlated verified launch, 32-command WebSocket backpressure, and last-good streamed catalog retention**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-31T01:18:24Z
- **Completed:** 2026-07-31T01:30:24Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added exact bounded wire codecs and backend dispatch for preview, source-bound approval, uninstall, and exact-triple launch.
- Replaced browser-projected srcdoc opening with a correlated verified launch result while retaining one mounted `NappletFrame`.
- Added a deterministic 32-command ceiling with timeout and cleanup across close, replacement, and component teardown.
- Separated catalog status from optional projection data and rejected malformed or retired-generation pushes without erasing last-good cards.

## Task Commits

1. **Task 1: Preview, approve, and launch one installed naddr over the production runtime seam** - `efd21fb`
2. **Task 2: Push partial catalog data and synchronization status independently** - `84ca552`

## Files Created/Modified

- `runtime/transport.ts` - Exact catalog command wire decoders.
- `runtime/portal_runtime.ts` - Catalog command dispatch to the process-owned service.
- `routes/api/runtime.ts` - Correlated public results and independent catalog status/data pushes.
- `islands/NappletShell.tsx` - Bounded pending registry, strict stream acceptance, and verified launch lifecycle.
- `components/HomeView.tsx` - Server-resolution readiness and retryable capacity feedback.
- `shell/connection.ts` - Socket terminal lifecycle notification for command cleanup.
- `tests/catalog_ui_test.tsx` - Codec, capacity, recovery, launch-authority, and stream assertions.

## Decisions Made

- Executable bytes are never trusted from catalog projections; only a matching successful launch result can reset and populate the iframe.
- Capacity is checked before command registration or send, so the 33rd concurrent command remains local and immediately retryable.
- Reconnect retains last-good display for the same account, while an authoritative account identity change resets catalog display authority.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended command cleanup into the connection controller lifecycle**
- **Found during:** Task 1
- **Issue:** Socket replacement and terminal closure were owned by `shell/connection.ts`, outside the listed task files, so the island could not deterministically settle pending commands on every terminal path.
- **Fix:** Added a lifecycle callback invoked on replacement, terminal failure, and stop.
- **Files modified:** `shell/connection.ts`
- **Verification:** Focused catalog tests and `deno task check` pass.
- **Committed in:** `efd21fb`

**2. [Rule 2 - Missing Critical] Removed projected launch bytes from the card contract**
- **Found during:** Task 1
- **Issue:** `components/HomeView.tsx` treated embedded launch bytes as card readiness, preserving a browser-authoritative launch path.
- **Fix:** Cards now use backend resolution status and forward approval generation identity; launch bytes are consumed only by the shell's correlated result path.
- **Files modified:** `components/HomeView.tsx`
- **Verification:** One iframe remains mounted and catalog UI/runtime tests pass.
- **Committed in:** `efd21fb`

**Total deviations:** 2 auto-fixed (2 Rule 2)
**Impact on plan:** Both changes were required to enforce the planned security and cleanup boundaries; no feature scope was added.

## Issues Encountered

- A legacy source assertion expected catalog loading directly in `main.ts`; it was updated to assert the current `CatalogSyncOwner` production wiring established by Plan 02.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04-04 can add install-entry UX and production-path/UAT hardening on top of the complete trusted command seam.
- No blockers remain.

## Self-Check: PASSED

- All seven modified implementation/test files exist.
- Task commits `efd21fb` and `84ca552` exist.
- Focused tests and the complete Deno format/lint/type-check gate pass.

---
*Phase: 04-installed-napplet-discovery*
*Completed: 2026-07-31*
