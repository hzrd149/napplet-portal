---
phase: 08-cross-tab-media-sessions
plan: 02
subsystem: runtime
tags: [deno, websocket, media, reconnect, tdd]
requires:
  - phase: 08-cross-tab-media-sessions
    provides: Exact canonical MEDIA codecs and serialized media authority coordinator
provides:
  - Strict disjoint portal media snapshot, transfer, stop, and result protocol
  - Snapshot-first authenticated WebSocket media dispatch with server-bound actor identity
  - Immediate owner revoke, reconnect-grace origin expiry, and stale socket generation guards
affects: [08-03, media-shell-controls, runtime-websocket]
tech-stack:
  added: []
  patterns: [snapshot-before-input gate, outer generation fencing, lifecycle authority callbacks]
key-files:
  created: [tests/media_transport_test.ts, tests/media_lifecycle_test.ts]
  modified: [runtime/connections.ts, runtime/media_sessions.ts, runtime/media_reducer.ts, runtime/portal_runtime.ts, runtime/transport.ts, routes/api/runtime.ts]
key-decisions:
  - "Keep portal media controls top-level and exact-key decoded; canonical media remains inside runtime.forward/runtime.event only."
  - "Carry account eligibility only on the server and expose sanitized snapshots with an account epoch instead of accountId."
  - "Fence close events with attachment generations so a replaced socket cannot detach its resumed successor."
patterns-established:
  - "Every socket receives runtime.connected then runtime.media.snapshot before media input is enabled."
  - "Detach revokes ownership immediately while destroyWindow remains the authoritative post-grace origin expiry seam."
requirements-completed: [MED-01, MED-02, MED-03, MED-04]
coverage:
  - id: D1
    description: Snapshot-first disjoint authenticated media transport
    requirement: MED-03
    verification:
      - kind: integration
        ref: 'tests/media_transport_test.ts#snapshot-first two socket tracer'
        status: pass
    human_judgment: false
  - id: D2
    description: Generation-bearing correlated transfer and stop controls remain outside canonical MEDIA
    requirement: MED-02
    verification:
      - kind: unit
        ref: 'tests/media_transport_test.ts#snapshot-first two socket tracer validates disjoint portal controls'
        status: pass
    human_judgment: false
  - id: D3
    description: Detach, grace expiry, account change, delivery failure, and shutdown preserve single-owner authority
    requirement: MED-04
    verification:
      - kind: integration
        ref: 'tests/media_lifecycle_test.ts'
        status: pass
      - kind: e2e
        ref: 'tests/runtime_reconnect_smoke_test.ts'
        status: pass
    human_judgment: false
duration: 7min
completed: 2026-07-31
status: complete
---

# Phase 8 Plan 2: Media Transport and Lifecycle Summary

**Snapshot-first WebSocket media coordination with exact portal controls, server-bound account authority, immediate owner revocation, and generation-safe reconnect grace.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-31T05:06:23Z
- **Completed:** 2026-07-31T05:13:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added strict top-level `runtime.media.*` snapshot/control/result decoding while rejecting portal envelopes from the canonical napplet MEDIA channel.
- Wired authenticated actor identity and trusted outer generations through snapshot-first production WebSocket dispatch, with browser projections omitting account identity.
- Integrated immediate detach/send-failure owner revocation, grace-scoped origin expiry, stop-before-terminal account/shutdown handling, and stale attachment close guards.

## Task Commits

1. **Task 1 RED: Media transport tracer tests** - `4e30445`
2. **Task 1 GREEN: Snapshot-first media transport** - `727125b`
3. **Task 1 formatting: Deno-formatted tracer tests** - `3470340`
4. **Task 2 RED: Media lifecycle tests** - `41815ea`
5. **Task 2 GREEN: Lifecycle authority integration** - `b78f7f5`
6. **Task 2 verification fix: Lint-clean lifecycle fixture** - `bbb902c`

## Files Created/Modified

- `runtime/transport.ts` - Strict portal control decoder and outer media generation validation.
- `runtime/connections.ts` - Immediate detach/send-failure callbacks and current attachment generation fencing.
- `runtime/media_sessions.ts` - Current active-account snapshot lookup.
- `runtime/media_reducer.ts` - Ordered stop effects for loss, expiry, account change, and shutdown.
- `runtime/portal_runtime.ts` - Account epoch, snapshot/control bridge, and ordered lifecycle authority APIs.
- `routes/api/runtime.ts` - Snapshot-first production socket protocol and authenticated media dispatch.
- `tests/media_transport_test.ts` - Portal/canonical protocol separation and generation tests.
- `tests/media_lifecycle_test.ts` - Deterministic detach, resume, expiry, isolation, account, shutdown, and failure tests.

## Decisions Made

- Portal coordination messages are top-level WebSocket envelopes; canonical MEDIA messages remain napplet-scoped events.
- Snapshot account identity never crosses the browser boundary; `accountEpoch` invalidates stale browser projections without disclosing the account.
- Reconnect attachment generation is authoritative for close handling, preventing a stale socket close from revoking its replacement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical lifecycle correctness] Added stale attachment close fencing**
- **Found during:** Task 2
- **Issue:** A replaced socket could close after resume and detach the current sender sharing its connection namespace.
- **Fix:** Increment attachment generations and ignore detach calls from older socket generations.
- **Files modified:** `runtime/connections.ts`, `routes/api/runtime.ts`
- **Verification:** Lifecycle tests, reconnect production smoke, and `deno task check` pass.
- **Committed in:** `b78f7f5`

**2. [Rule 1 - Lint] Removed a mutable-only fixture binding**
- **Found during:** Overall verification
- **Issue:** `deno lint` rejected a lifecycle fixture under `prefer-const`.
- **Fix:** Used a const callback holder while preserving deterministic initialization.
- **Files modified:** `tests/media_lifecycle_test.ts`
- **Verification:** `deno task check` passes.
- **Committed in:** `bbb902c`

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 1).
**Impact on plan:** Both fixes protect required lifecycle correctness and project quality gates without expanding into Plan 08-03 UI work.

## Issues Encountered

The production WebSocket smoke requires a build/start cycle and completed in 50 seconds; it passed without code changes.

## Known Stubs

None. Empty collections and null snapshot/session values are intentional initialized or terminal states, not unwired UI data.

## User Setup Required

None - no external service configuration required.

## Verification

- `deno test -A tests/media_lifecycle_test.ts tests/media_transport_test.ts` — 5 passed.
- `deno test -A tests/runtime_reconnect_smoke_test.ts` — 2 passed.
- `deno task check` — format, lint, and type-check passed.

## Next Phase Readiness

Plan 08-03 can project the snapshot protocol into shell now-playing controls. No browser UI or 08-03 files were changed here.

## Self-Check: PASSED

- Both created tests and all six modified runtime/route files exist.
- TDD commits `4e30445`, `727125b`, `41815ea`, and `b78f7f5` exist in history.

---
*Phase: 08-cross-tab-media-sessions*
*Completed: 2026-07-31*
