---
phase: 05-resource-and-blossom-transfer
plan: "04"
subsystem: runtime
tags: [resource, blossom, websocket, cancellation, ownership]
requires:
  - phase: 05-resource-and-blossom-transfer
    provides: bounded resource reads and backend-owned Blossom upload settlement
provides:
  - process-owned RESOURCE and UPLOAD dispatcher with complete authority tuples
  - deterministic cancel, expiry, sign-out, and shutdown cleanup
  - production binary/control transport for all closed transfer actions
affects: [phase-09-parity-audit, nap-runtime, production-transport]
tech-stack:
  added: []
  patterns: [generation-checked delivery, authority-tuple ownership, operation-start settings snapshots]
key-files:
  created: [runtime/nap_dispatcher.ts, tests/nap_dispatcher_test.ts]
  modified: [runtime/portal_runtime.ts, runtime/blossom_transfer.ts, runtime/transport.ts, routes/api/runtime.ts, islands/NappletShell.tsx, main.ts, shell/connection.ts, tests/end_to_end_test.ts, tests/binary_transport_test.ts]
key-decisions:
  - "Bind transfer authority to connection, window, verified napplet identity, and active account in one immutable owner key."
  - "Treat reconnect grace as continued ownership; invalidate and abort only at window expiry, sign-out, explicit removal, or shutdown."
patterns-established:
  - "Register byte-bearing work before service access, cap it at two operations per window, and remove it in finally."
  - "Snapshot validated endpoint settings at operation start while subsequent operations observe reactive settings changes."
requirements-completed: [RES-01, RES-02, RES-03, UPL-01, UPL-02, UPL-03]
coverage:
  - id: D1
    description: "RESOURCE operations cancel exactly by owner/request and abort on window expiry or shutdown without late delivery."
    requirement: RES-01
    verification:
      - kind: integration
        ref: "tests/nap_dispatcher_test.ts#dispatcher cancel and window expiry abort exact owned resource work"
        status: pass
      - kind: integration
        ref: "tests/websocket_session_test.ts#reconnect reattaches namespace without duplicating subscriptions"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every closed RESOURCE and UPLOAD action crosses the production runtime seam under per-window quotas."
    requirement: UPL-01
    verification:
      - kind: e2e
        ref: "tests/end_to_end_test.ts#production runtime wires the complete RESOURCE and UPLOAD seam"
        status: pass
      - kind: integration
        ref: "deno task test (168 passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Upload status and status pushes are scoped to the complete authority tuple and foreign queries return generic unavailable."
    requirement: UPL-03
    verification:
      - kind: unit
        ref: "tests/nap_dispatcher_test.ts#dispatcher exposes closed actions snapshots settings and scopes upload status"
        status: pass
    human_judgment: false
duration: 14min
completed: 2026-07-31
status: complete
---

# Phase 5 Plan 04: RESOURCE and UPLOAD Runtime Integration Summary

**Process-owned RESOURCE and Blossom upload services now cross the verified napplet runtime seam with bounded concurrency, complete authority ownership, binary fidelity, and deterministic lifecycle cancellation.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-31T02:31:00Z
- **Completed:** 2026-07-31T02:45:18Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Added one owned dispatcher for the seven closed RESOURCE/UPLOAD actions with duplicate rejection and a two-operation per-window quota before bytes or network work begins.
- Connected explicit cancel, grace-expired window removal, sign-out, and process shutdown to AbortControllers while preserving in-flight work across transient socket detach and reconnect.
- Constructed resource and Blossom transfer services once in the process runtime, snapshotting current validated settings per operation and using backend signer authority only.
- Scoped retained upload results and owner-only status pushes by connection, window, verified napplet identity, and active account.

## Task Commits

1. **Task 1 RED: Dispatcher lifecycle tests** - `62c931e`
2. **Task 1 GREEN: Owned cancellation and lifecycle** - `7fa3ac0`
3. **Task 2 RED: Production transfer coverage** - `d662dd4`
4. **Task 2 GREEN: Complete production transfer seam** - `e411379`

## Files Created/Modified

- `runtime/nap_dispatcher.ts` - Complete-authority operation registry, quotas, dispatch, status ownership, and cancellation.
- `runtime/portal_runtime.ts` - Verified napplet binding, transfer delivery, sign-out cleanup, and window lifecycle composition.
- `runtime/blossom_transfer.ts` - Explicit owner-status removal for authority invalidation.
- `runtime/transport.ts` - Exact codecs for bytesMany, cancel, and upload status.
- `routes/api/runtime.ts` - Production WebSocket control and binary dispatch.
- `islands/NappletShell.tsx` - Verified-frame forwarding for all closed actions and binary upload input.
- `main.ts` - Process-owned resource, upload, and dispatcher construction.
- `shell/connection.ts` - Binary-safe socket send contract.
- `tests/nap_dispatcher_test.ts` - Cancellation, quota, settings snapshot, and ownership coverage.
- `tests/end_to_end_test.ts` - Production integration coverage.
- `tests/binary_transport_test.ts` - Closed codec coverage.

## Decisions Made

- Reconnect detachment is not an authority change; only the existing grace-expiry window destruction boundary aborts retained work.
- Upload status keys serialize the full authority tuple, so a valid upload ID alone cannot disclose status or destination URLs.
- Resource batch binary items carry stable ordinal indexes while canonical JSON retains input order and per-item settlement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added explicit upload-status owner cleanup**
- **Found during:** Task 1
- **Issue:** The transfer service retained terminal statuses but exposed no lifecycle hook to erase an invalidated owner.
- **Fix:** Added `clearOwner` and invoked it for window invalidation and dispatcher shutdown.
- **Files modified:** `runtime/blossom_transfer.ts`, `runtime/nap_dispatcher.ts`
- **Verification:** Dispatcher lifecycle and foreign-status tests pass.
- **Committed in:** `7fa3ac0`

**2. [Rule 3 - Blocking] Extended the browser socket interface for binary upload frames**
- **Found during:** Task 2
- **Issue:** The existing local socket interface accepted strings only even though the underlying WebSocket already supported binary transport.
- **Fix:** Narrowly extended the send type to `string | ArrayBuffer`.
- **Files modified:** `shell/connection.ts`
- **Verification:** Type-check, shell regression suite, and production WebSocket smoke pass.
- **Committed in:** `e411379`

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 3).
**Impact on plan:** Both changes were required for lifecycle security and production binary operation; no unrelated feature scope was added.

## Issues Encountered

- The first full-suite production reconnect smoke encountered a transient connection refusal. The isolated production build/start smoke and the subsequent full-suite run both passed.
- Phase 8 documentation commits landed concurrently and were preserved without modification.

## User Setup Required

None - no new external configuration is required.

## Known Stubs

None.

## Next Phase Readiness

- All six Phase 5 requirements have automated production-shaped coverage and the phase is ready for verification or Phase 9 parity audit.
- No open implementation blockers remain.

## Verification

- Focused Task 2 suite — 28 passed.
- `deno task test` — 168 passed.
- `deno task check` — formatting, lint, and TypeScript checks passed.
- `deno task build` — production client and server bundles passed.
- `tests/runtime_reconnect_smoke_test.ts` — production build/start WebSocket reconnect passed.

## Self-Check: PASSED

- All 11 created or modified plan files exist.
- Task commits `62c931e`, `7fa3ac0`, `d662dd4`, and `e411379` exist in git history.
- No tracked files were deleted; research-cache JSON and Phase 8 documentation were preserved.

---
*Phase: 05-resource-and-blossom-transfer*
*Completed: 2026-07-31*
