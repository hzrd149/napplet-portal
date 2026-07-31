---
phase: 03-mobile-shell-resilience
plan: "01"
subsystem: ui
tags: [websocket, lifecycle, reconnect, accessibility, preact, fresh]
requires:
  - phase: 01-one-day-napplet-runtime-mvp
    provides: reconnect token and ConnectionRegistry grace namespace
provides:
  - Serialized lifecycle-aware browser WebSocket controller
  - Semantic constellation connection ritual and persistent status grammar
  - Minimal accessible connection sheet with policy-gated manual retry
  - Unattended production Fresh WebSocket reconnect smoke
affects: [03-mobile-shell-resilience, shell-navigation, account-chrome]
tech-stack:
  added: []
  patterns: [generation-guarded transport ownership, injected deterministic clocks, geometry-first status semantics]
key-files:
  created: [shell/connection.ts, components/ConnectionConstellation.tsx, components/ConnectionSheet.tsx, tests/connection_controller_test.ts, tests/shell_resilience_test.tsx, tests/runtime_reconnect_smoke_test.ts]
  modified: [islands/NappletShell.tsx, assets/styles.css, deno.json, runtime/port.ts, tests/setup_visibility_test.tsx, tests/shell_architecture_test.ts]
key-decisions:
  - "Reset retry failures only after a fully validated runtime.artifact crosses the controller boundary."
  - "Keep signer identity independent from backend transport recovery; a lost portal socket does not label the signer offline."
  - "Use a validated PORTAL_PORT only for production-server binding so integration tests can own an ephemeral loopback port."
patterns-established:
  - "Connection ownership: one generation-guarded requestConnect path owns at most one socket and one timer."
  - "Connection presentation: pure snapshot-to-copy/SVG projection contains no reconnect identifiers or timing detail."
requirements-completed: [CON-01, CON-02, CON-03, CON-04]
coverage:
  - id: D1
    description: "Lifecycle-aware recovery preserves the runtime namespace without duplicate sockets or retry timers."
    requirement: CON-03
    verification:
      - kind: unit
        ref: "tests/connection_controller_test.ts"
        status: pass
      - kind: e2e
        ref: "tests/runtime_reconnect_smoke_test.ts#built Fresh server resumes one runtime WebSocket namespace"
        status: pass
    human_judgment: false
  - id: D2
    description: "Connection truth is readable through semantic cold, reconnect, dormant, and failed constellation states."
    requirement: CON-01
    verification:
      - kind: unit
        ref: "tests/shell_resilience_test.tsx#constellation exposes non-color geometry for every truth state"
        status: pass
    human_judgment: false
  - id: D3
    description: "The status control opens one minimal plain-language disclosure with Retry only after repeated failures."
    requirement: CON-02
    verification:
      - kind: unit
        ref: "tests/shell_resilience_test.tsx#status sheet has one sentence, no operational disclosure, and contextual Retry"
        status: pass
    human_judgment: false
  - id: D4
    description: "Reduced motion preserves state geometry while disabling continuous animation and transitions."
    requirement: CON-04
    verification:
      - kind: unit
        ref: "tests/shell_resilience_test.tsx#reduced motion disables continuous constellation motion"
        status: pass
    human_judgment: false
duration: 12min
completed: 2026-07-31
status: complete
---

# Phase 3 Plan 1: Connection Resilience and Constellation Summary

**A generation-guarded WebSocket controller now preserves backend runtime continuity while an accessible constellation projects cold start, reconnect, offline, and actionable failure truth.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-31T00:00:24Z
- **Completed:** 2026-07-31T00:12:30Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Serialized all connection triggers through one controller with capped full jitter, visibility/offline suppression, quiet 60-second recovery, stale-generation rejection, and intentional teardown.
- Preserved the opaque reconnect token and proved a forced production WebSocket drop resumes the same connection/window namespace with one live client socket.
- Added the semantic seed/link/cluster/gate constellation, abbreviated fracture/rebuild grammar, bounded cold ritual, slow-start escape, accessible status control, minimal sheet, and reduced-motion parity.

## Task Commits

1. **Task 1 RED: Connection recovery tests** - `39beaac`
2. **Task 1 GREEN: Serialized runtime connection recovery** - `a7674b4`
3. **Task 2 RED: Connection presentation tests** - `13ab3a9`
4. **Task 2 GREEN: Constellation ritual and status sheet** - `f097570`
5. **Task 2 regression assertion alignment** - `f9a6384`

## Files Created/Modified

- `shell/connection.ts` - Discriminated truth snapshot, deterministic retry policy, and serialized controller.
- `components/ConnectionConstellation.tsx` - Semantic geometry and plain-language connection projection.
- `components/ConnectionSheet.tsx` - Minimal contextual status disclosure and retry action.
- `islands/NappletShell.tsx` - Controller lifecycle integration, ritual timing, and persistent status target.
- `assets/styles.css` - Constellation state grammar, sheet presentation, and reduced-motion rules.
- `tests/connection_controller_test.ts` - Fake socket/clock storm, lifecycle, jitter, and teardown coverage.
- `tests/shell_resilience_test.tsx` - State, copy, accessibility, disclosure, timing, and motion coverage.
- `tests/runtime_reconnect_smoke_test.ts` - Production build/start and real WebSocket namespace-resume smoke.
- `runtime/port.ts`, `deno.json` - Validated ephemeral production port support for unattended testing.

## Decisions Made

- A `runtime.connected` message starts the runtime once per socket generation; only a fully shaped verified artifact resets failure policy and marks readiness.
- Backend connection recovery and signer availability remain separate projections, preventing a transport drop from falsely changing identity state.
- The status sheet intentionally contains no token, identifier, retry interval, telemetry, or history detail.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added validated production port selection**
- **Found during:** Task 1 production reconnect smoke
- **Issue:** `deno task start` was fixed to port 8000, so an unattended test could not safely allocate its own free port.
- **Fix:** Added `runtime/port.ts` and wired `PORTAL_PORT` into the production serve task with validation and an 8000 default.
- **Files modified:** `runtime/port.ts`, `deno.json`
- **Verification:** Production reconnect smoke passes on an ephemeral loopback port.
- **Committed in:** `a7674b4`

**2. [Rule 1 - Bug] Updated architecture assertions for controller-owned recovery**
- **Found during:** Task 2 regression verification
- **Issue:** Legacy source assertions required the removed ad-hoc socket timeout and incorrectly coupled backend connection loss to signer-offline state.
- **Fix:** Pointed assertions at the controller timeout/recovery path and preserved the separate signer projection required by D-27.
- **Files modified:** `tests/setup_visibility_test.tsx`, `tests/shell_architecture_test.ts`
- **Verification:** Both focused suites and `deno task check` pass.
- **Committed in:** `f097570`, `f9a6384`

**Total deviations:** 2 auto-fixed (1 blocking issue, 1 regression bug)
**Impact on plan:** Both changes were required to exercise the planned production seam and retain truthful state ownership; no feature scope was added.

## Issues Encountered

- Deno's browser-compatible `WebSocket` client does not provide a matching browser Origin header. The smoke uses a bounded raw RFC 6455 loopback handshake so the production endpoint's same-origin policy remains intact.
- Killing `deno task start` alone leaves its serve child alive. The smoke launches a dedicated process group and terminates/drains it in `finally`.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The three-target navigation/status seam is ready for the remaining Phase 3 navigation, account chrome, and theme plans.
- No blockers remain.

## Self-Check: PASSED

- All created files exist.
- All five task/TDD commits exist.
- The required 20-test verification and `deno task check` pass.

---
*Phase: 03-mobile-shell-resilience*
*Completed: 2026-07-31*
