---
phase: 06-common-data-and-durable-storage
plan: "02"
subsystem: runtime
tags: [nap-storage, atomic-json, quotas, capability-authority]
requires:
  - phase: 06-common-data-and-durable-storage
    plan: "01"
    provides: backend-minted immutable WindowCapabilityContext authority
provides:
  - Closed canonical version-1 napplet storage snapshot codec
  - Globally serialized atomic string storage persistence
  - Exact durable storage.get/set/remove/keys dispatcher operations
affects: [06-03, storage, runtime-dispatch]
tech-stack:
  added: []
  patterns: [copy-validate-persist-commit, global mutation tail, authority-derived namespaces]
key-files:
  created: [runtime/storage_store.ts, runtime/storage.ts, tests/storage_test.ts]
  modified: [runtime/nap_dispatcher.ts, main.ts, tests/common_storage_runtime_test.ts]
key-decisions:
  - "Encode storage authority as one opaque tuple containing account, exact manifest and artifact identity, canonical scope, and backend instance identity only for instance scope."
  - "Count UTF-8 key plus value bytes across shared and every instance namespace for the 512 KiB account/exact-manifest budget."
patterns-established:
  - "Durable mutation: clone latest committed snapshot, validate prospective quotas, atomically persist, then publish in memory."
  - "Storage errors: expose only stable quota-exceeded or storage-unavailable codes across the dispatcher boundary."
requirements-completed: [STO-01, STO-02, STO-03]
coverage:
  - id: D1
    description: "String storage persists canonically across reconnects and process restart without cross-namespace loss."
    requirement: STO-03
    verification:
      - kind: unit
        ref: "tests/storage_test.ts#snapshot, concurrent, restart, write failure, and malformed tests"
        status: pass
    human_judgment: false
  - id: D2
    description: "Exact get, set, remove, and sorted keys operations enforce backend authority and UTF-8 quotas."
    requirement: STO-02
    verification:
      - kind: integration
        ref: "tests/storage_test.ts#dispatcher supports exact get set remove keys and redacted failures"
        status: pass
      - kind: unit
        ref: "tests/storage_test.ts#UTF-8 and aggregate quota tests"
        status: pass
    human_judgment: false
duration: 5min
completed: 2026-07-31
status: complete
---

# Phase 6 Plan 2: Durable Storage Summary

**Canonical atomic storage now preserves isolated string values across restart while enforcing exact backend authority, deterministic ordering, and conservative UTF-8 quotas.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-31T03:30:41Z
- **Completed:** 2026-07-31T03:35:11Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added a closed version-1 snapshot codec with canonical namespace/key order, host-only permissions, random sibling temp files, and atomic replacement.
- Serialized every mutation through one global copy-validate-persist-commit tail so concurrent namespaces and failed writes cannot corrupt committed truth.
- Completed all four string-only STORAGE operations with sorted keys, missing-value nulls, backend-derived shared/instance isolation, and UTF-8 quota enforcement.

## Task Commits

1. **Task 1 RED: durable snapshot behavior** - `25cf9a3` (test)
2. **Task 1 GREEN: globally serialized snapshot store** - `88a2e9e` (feat)
3. **Task 2 RED: operations and quota behavior** - `b30e36d` (test)
4. **Task 2 GREEN: durable isolated operations** - `16ce338` (feat)

## Files Created/Modified

- `runtime/storage_store.ts` - Closed snapshot parsing, canonical serialization, and atomic filesystem replacement.
- `runtime/storage.ts` - Immutable storage service, namespace derivation, global mutation tail, and quotas.
- `runtime/nap_dispatcher.ts` - Exact four-operation dispatch and stable redacted failure mapping.
- `main.ts` - Process-owned durable storage service wiring at the fixed host path.
- `tests/storage_test.ts` - Persistence, malformed input, concurrency, recovery, quota, and dispatcher coverage.
- `tests/common_storage_runtime_test.ts` - Updated tracer ports for the completed storage interface.

## Decisions Made

- Aggregate quota identity includes account, coordinate, exact manifest event, d-tag, and aggregate hash; shared and all instance namespaces consume the same 512 KiB budget.
- Empty namespaces are removed from the canonical document while remove of a missing key remains a successful deterministic no-op.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical integration] Replaced the production tracer map**
- **Found during:** Task 2
- **Issue:** Implementing the service without replacing `main.ts` tracer wiring would leave production requests non-durable.
- **Fix:** Opened one process-owned StorageService at `.data/napplet-storage.json` and injected it into NapDispatcher.
- **Files modified:** `main.ts`
- **Verification:** Focused integration suite, full 180-test suite, and `deno task check` pass.
- **Committed in:** `16ce338`

**2. [Rule 3 - Blocking interface update] Completed existing tracer test ports**
- **Found during:** Task 2
- **Issue:** The prior two-method tracer port did not satisfy the completed four-operation StoragePort interface.
- **Fix:** Added deterministic remove and keys methods to the existing runtime test harnesses.
- **Files modified:** `tests/common_storage_runtime_test.ts`
- **Verification:** All four common/storage runtime tests pass.
- **Committed in:** `16ce338`

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 3)
**Impact on plan:** Both changes were necessary to ship the planned production behavior and preserve existing integration coverage.

## Issues Encountered

- Deno treats the plan's pipe-delimited `--filter` text as a literal substring, so that command selected zero tests; the complete focused file was run instead and all seven storage tests passed.

## User Setup Required

None - the runtime creates the host-owned `.data` directory and snapshot with restrictive permissions.

## Known Stubs

None.

## Next Phase Readiness

Durable STORAGE is complete and the Phase 06-01 authority seam remains ready for Phase 06-03 COMMON expansion. No Phase 06-03 work was executed here.

## Self-Check: PASSED

- All created and modified files exist.
- Task commits `25cf9a3`, `88a2e9e`, `b30e36d`, and `16ce338` exist.
- Focused 11-test suite, full 180-test suite, and formatting/lint/type checks pass.

---
*Phase: 06-common-data-and-durable-storage*
*Completed: 2026-07-31*
