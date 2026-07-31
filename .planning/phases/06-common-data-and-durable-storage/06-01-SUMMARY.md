---
phase: 06-common-data-and-durable-storage
plan: "01"
subsystem: runtime
tags: [nap-common, nap-storage, nip19, authority, websocket]
requires:
  - phase: 04-full-catalog-runtime-and-install-flow
    provides: exact accepted-manifest catalog launch verification
  - phase: 05-resource-and-blossom-transfer
    provides: connection/window-owned NAP dispatcher lifecycle
provides:
  - Backend-minted immutable WindowCapabilityContext authority
  - Canonical common.encodeNip19 and string storage.set/storage.get tracer
  - Capability, identity, manifest, reconnect, and expiry enforcement
affects: [06-02, 06-03, common-service, durable-storage]
tech-stack:
  added: []
  patterns: [authority-first dispatch, exact-key envelope decoding, backend-issued instance namespace]
key-files:
  created: [tests/common_storage_runtime_test.ts]
  modified: [runtime/nap_dispatcher.ts, runtime/portal_runtime.ts, routes/api/runtime.ts, components/NappletFrame.tsx, islands/NappletShell.tsx, main.ts]
key-decisions:
  - "Mint window capability authority only from a successful backend CatalogService.launch result."
  - "Treat omitted storage scope as shared and derive instance scope solely from the backend-issued instanceId."
patterns-established:
  - "Authority-first dispatch: validate the current immutable window context and granted domain before decoding or invoking a service."
  - "Stable rejection: malformed and unauthorized requests settle once with redacted public error codes."
requirements-completed: [COM-01, STO-01, STO-02]
coverage:
  - id: D1
    description: "Verified catalog launches bind canonical COMMON and STORAGE round trips to backend window authority."
    requirement: COM-01
    verification:
      - kind: integration
        ref: "tests/common_storage_runtime_test.ts#catalog launch binds backend authority before full proxy forwarding"
        status: pass
    human_judgment: false
  - id: D2
    description: "Storage namespaces are isolated by account, exact manifest, scope, and backend-issued instance identity."
    requirement: STO-02
    verification:
      - kind: unit
        ref: "tests/common_storage_runtime_test.ts#instance authority survives reconnect identity and revokes on expiry"
        status: pass
    human_judgment: false
duration: 16min
completed: 2026-07-31
status: complete
---

# Phase 6 Plan 1: Verified Manifest and Window Authority Tracer Summary

**Backend-verified catalog launches now mint immutable window capabilities for canonical public NIP-19 encoding and isolated string storage across reconnects.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-07-31T03:12:00Z
- **Completed:** 2026-07-31T03:27:59Z
- **Tasks:** 1
- **Files modified:** 7

## Accomplishments

- Bound account, coordinate, exact manifest event, artifact identity, domain grants, and backend-issued instance ID only after a successful verified catalog launch.
- Added exact-key COMMON/STORAGE decoding with canonical correlated results, string-only values, and stable redacted failures.
- Preserved authority during reconnect while sign-out, manifest replacement, and actual window expiry revoke dispatch without deleting stored values.

## Task Commits

1. **Task 1 RED: verified authority tracer** - `2776358` (test)
2. **Task 1 GREEN: authority-bound COMMON/STORAGE seam** - `e4dd63a` (feat)

## Files Created/Modified

- `runtime/nap_dispatcher.ts` - Exact COMMON/STORAGE decoding, namespace derivation, and authority-first dispatch.
- `runtime/portal_runtime.ts` - Verified launch registry and window authority lifecycle.
- `routes/api/runtime.ts` - Routes COMMON/STORAGE forwards into the backend dispatcher.
- `components/NappletFrame.tsx` - Advertises and forwards only verified COMMON/STORAGE grants.
- `islands/NappletShell.tsx` - Projects verified artifact capability grants into the iframe bridge.
- `main.ts` - Wires the tracer storage port for the production runtime seam.
- `tests/common_storage_runtime_test.ts` - TDD coverage for round trips, denial, reconnect, and expiry.

## Decisions Made

- Backend object identity plus current account truth is the authority recheck; browser messages cannot reconstruct or override it.
- Shared namespaces omit instance identity, while instance namespaces include only the backend-issued instance ID.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical integration] Wired verified capabilities through the hydrated shell**
- **Found during:** Task 1
- **Issue:** Updating only the listed frame component could not project catalog result capabilities into the live bridge.
- **Fix:** Added the verified capability handoff in `islands/NappletShell.tsx`.
- **Verification:** Focused iframe tests, `deno task check`, and full test suite.
- **Committed in:** `e4dd63a`

**2. [Rule 2 - Missing critical operation] Wired an in-process tracer storage port**
- **Found during:** Task 1
- **Issue:** The dispatcher interface alone would leave production storage requests unwired.
- **Fix:** Added the intentionally small in-memory tracer port in `main.ts`; durable persistence remains Plan 06-03 scope.
- **Verification:** End-to-end runtime tracer and full test suite.
- **Committed in:** `e4dd63a`

**Total deviations:** 2 auto-fixed (2 Rule 2)
**Impact on plan:** Both additions were required to make the planned end-to-end production seam functional; no later-plan persistence work was pulled forward.

## Issues Encountered

- The full-suite command outlived the command-output capture while its production WebSocket smoke test ran; the process completed, and the smoke tests were rerun and completed separately.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The in-memory storage port is the explicit Plan 06-01 tracer port and is replaced by durable storage in Plan 06-03; it does not prevent this plan's tracer goal.

## Next Phase Readiness

The verified authority and dispatcher seam is ready for Plan 06-02 COMMON expansion and Plan 06-03 durable storage implementation.

## Self-Check: PASSED

- Created test and all modified runtime files exist.
- RED commit `2776358` and GREEN commit `e4dd63a` exist.
- Focused tests, `deno task check`, full tests, and production WebSocket smoke coverage passed.

---
*Phase: 06-common-data-and-durable-storage*
*Completed: 2026-07-31*
