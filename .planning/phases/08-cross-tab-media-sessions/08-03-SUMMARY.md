---
phase: 08-cross-tab-media-sessions
plan: 03
subsystem: ui
tags: [preact, websocket, media, autoplay, production-smoke]
requires:
  - phase: 08-cross-tab-media-sessions
    provides: Snapshot-first media transport and lifecycle authority
provides:
  - Snapshot-gated accessible shell now-playing controls
  - Current-owner/current-generation iframe and playback actuation
  - Two-client production media ordering and lifecycle smoke
affects: [shell-navigation, media-runtime, production-verification]
tech-stack:
  added: []
  patterns: [immutable projection controller, truthful browser actuation, isolated production smoke]
key-files:
  created: [components/MediaControls.tsx, tests/media_shell_test.tsx, tests/media_transport_smoke_test.ts]
  modified: [islands/NappletShell.tsx, assets/styles.css]
key-decisions:
  - "Keep socket/account epoch and media generation exclusively in the shell controller while iframe messages remain canonical."
  - "Treat play promise fulfillment and rejection as the only source of browser playback truth."
  - "Run production media smoke from an isolated temporary cwd so signer and cache state never touch project data."
patterns-established:
  - "Every runtime connection resets media readiness until an explicit account-epoch snapshot arrives."
  - "Authority loss stops local playback before the newer projection renders."
requirements-completed: [MED-01, MED-02, MED-03, MED-04]
coverage:
  - id: D1
    description: "Accessible authoritative now-playing, transfer, stop, and autoplay retry controls"
    requirement: MED-03
    verification:
      - kind: unit
        ref: "tests/media_shell_test.tsx#authoritative media shell tracer"
        status: pass
    human_judgment: false
  - id: D2
    description: "Current-owner/current-generation playback, hidden truth, and stale authority fencing"
    requirement: MED-02
    verification:
      - kind: integration
        ref: "tests/media_shell_test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "Two-client production WebSocket ownership and lifecycle ordering"
    requirement: MED-04
    verification:
      - kind: e2e
        ref: "tests/media_transport_smoke_test.ts#two-client production media ownership smoke"
        status: pass
    human_judgment: false
duration: 35min
completed: 2026-07-31
status: complete
---

# Phase 8 Plan 3: Shell Media Controls and Production Smoke Summary

**Snapshot-gated mobile shell media controls with truthful autoplay and hidden-tab state, backed by a passing two-client production WebSocket lifecycle smoke.**

## Performance

- **Duration:** 35 min
- **Completed:** 2026-07-31
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added bounded, accessible now-playing controls with capability-valid transfer, stop, and user-gesture retry actions beside shell navigation.
- Added an immutable shell controller that resets on connection, validates account epochs and media generations, stops stale owners locally, and keeps portal coordination fields outside canonical iframe messages.
- Proved create/play/transfer/revoke/hidden/reconnect/expiry behavior with two real clients against an isolated production build server.

## Task Commits

1. **Task 1 RED: Authoritative media shell tracer** - `ed9e386`
2. **Task 1 GREEN: Authoritative shell controls** - `790e4d6`
3. **Task 2 RED: Production ownership smoke** - `b8bdee0`
4. **Task 2 GREEN: Two-client production ordering** - `6270521`
5. **Task 2 verification fix: Deterministic teardown** - `049069d`

## Files Created/Modified

- `components/MediaControls.tsx` - Stateless bounded now-playing and control presentation.
- `islands/NappletShell.tsx` - Snapshot gate, trusted media controller, hidden handling, iframe routing, and autoplay truth.
- `assets/styles.css` - Safe-area-aware compact media chrome and focus/mobile styles.
- `tests/media_shell_test.tsx` - Shell authority, hidden state, autoplay, and accessibility coverage.
- `tests/media_transport_smoke_test.ts` - Isolated two-client production build/server lifecycle proof.

## Decisions Made

- Browser state projects backend authority and never becomes a durable media authority store.
- Hidden current owners report paused truth without transferring or revoking ownership; stale/non-owner tabs only stop locally.
- Production smoke uses a temporary cwd and generated test signer so `.data` and project caches remain untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Test isolation] Isolated production signer and runtime data**
- **Found during:** Task 2
- **Issue:** Running the built server from project root would persist test signer state under `.data`.
- **Fix:** Symlinked production artifacts into a temporary cwd and removed it after deterministic teardown.
- **Files modified:** `tests/media_transport_smoke_test.ts`
- **Verification:** Production smoke passes and project `.data` is untouched.
- **Committed in:** `6270521`

**2. [Rule 1 - Harness teardown] Prevented server cleanup from terminating the test harness**
- **Found during:** Task 2 verification
- **Issue:** Signaling a nested task/process group truncated the test runner before its verdict.
- **Fix:** Start the built server as one direct child, close clients, kill only that child, await output, and report failures after `finally`.
- **Files modified:** `tests/media_transport_smoke_test.ts`
- **Verification:** Smoke reports `1 passed`, exit 0; lint also passes.
- **Committed in:** `049069d`

## Known Stubs

None. Null projections and empty test queues are intentional protocol/test states.

## Verification

- Phase 8 media suite — 18 passed.
- Production two-client smoke — 1 passed in 28 seconds, exit 0.
- `deno task check` — format, lint, and type-check passed.

## Self-Check: PASSED

- All five plan files exist and all five task commits exist in history.

---
*Phase: 08-cross-tab-media-sessions*
*Completed: 2026-07-31*
