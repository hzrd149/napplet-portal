---
phase: 02-backend-runtime-expansion
plan: "07"
subsystem: contracts
tags: [deno, kehto, napplet, contract-testing, drift-report]
requires: [02-06]
provides: [pinned-contract-lifecycle-suite, non-blocking-sibling-drift-report]
affects: [phase-3-nap-coverage, release-verification]
tech-stack:
  added: []
  patterns: [pinned-package-authority, serialized-wire-fixtures, diagnostic-only-sibling-input]
key-files:
  created: [runtime/contract_report.ts, tests/contract_drift_test.ts, .planning/phases/02-backend-runtime-expansion/02-CONTRACT-DRIFT.json]
  modified: [runtime/relay_adapter.ts, tests/runtime_contract_test.ts, tests/end_to_end_test.ts, tests/tracer_end_to_end_test.ts, tests/fixtures/supplied_napplet_contract.json, README.md]
key-decisions:
  - "Pinned @kehto/runtime 0.20.1 and @napplet/core/@napplet/nap 0.31.0 remain the sole executable contract authority."
  - "Sibling source availability and marker mismatch are serialized as non-blocking diagnostic evidence."
metrics:
  duration: 6min
  completed: 2026-07-30
status: complete
---

# Phase 2 Plan 7: Contract Authority and Drift Evidence Summary

**Pinned Kehto/Napplet lifecycle contracts now cover the supplied napplet from handshake through deterministic stream close, while optional sibling sources produce structured non-blocking drift evidence.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-30T21:00:18Z
- **Completed:** 2026-07-30T21:06:18Z
- **Tasks:** 2 TDD tasks
- **Files modified:** 9

## Accomplishments

- Compiled pinned Kehto and NAP types directly against portal adapter boundaries and round-tripped canonical success, typed-error, correlation, EOSE, event, and terminal close frames.
- Extended the real supplied Security Lab smoke path through verified mount, source-bound handshake, initial/live delivery, EOSE, close, and rejection of post-close events.
- Added a versioned diagnostic report with exact pinned versions, sibling revisions, availability, missing markers, and blocking adapter coverage.
- Proved matching, mismatching, missing, unreadable, and concurrent report generation all exit successfully without changing runtime or release authority.
- Passed formatting, lint, TypeScript checking, and all 97 repository tests.

## Task Commits

1. **RED: Define pinned lifecycle coverage** - `13c28a0` (test)
2. **GREEN: Prove pinned lifecycle end to end** - `593f22a` (feat)
3. **RED: Define sibling drift cases** - `54f578d` (test)
4. **GREEN: Emit non-blocking drift evidence** - `5077892` (feat)

## Files Created/Modified

- `runtime/contract_report.ts` - Diagnostic-only report schema, normalized sibling reads, stable statuses, and report generator.
- `tests/contract_drift_test.ts` - Matching, mismatch, absence, unreadability, authority, and parallel isolation coverage.
- `.planning/phases/02-backend-runtime-expansion/02-CONTRACT-DRIFT.json` - Current structured evidence for Kehto relay and Napplet core/NAP references.
- `tests/runtime_contract_test.ts`, `tests/fixtures/supplied_napplet_contract.json` - Compile-time pinned imports and serialized canonical lifecycle fixtures.
- `tests/end_to_end_test.ts`, `tests/tracer_end_to_end_test.ts`, `runtime/relay_adapter.ts` - Deterministic terminal relay close in the supplied-napplet path.
- `README.md` - Report regeneration and non-blocking interpretation guidance.

## Decisions Made

- Kept sibling checkouts outside production imports and normal runtime composition; only the explicitly invoked report tool reads them.
- Stored exact package versions both at report level and per affected contract so drift evidence remains self-contained.
- Sanitized sibling I/O failures to `missing` or `unreadable` without paths, payloads, or secrets.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added deterministic terminal close to the supplied tracer adapter**
- **Found during:** Task 1 GREEN
- **Issue:** The compatibility tracer removed its listener on close but did not emit the canonical terminal `relay.closed` frame required by D-24.
- **Fix:** Expanded the tracer envelope to the existing relay stream union and emitted one idempotent terminal frame before rejecting later delivery.
- **Files modified:** `runtime/relay_adapter.ts`, focused end-to-end tests
- **Verification:** Focused contract/smoke suite and full 97-test suite
- **Commit:** `593f22a`

**2. [Rule 3 - Blocking] Narrowed an existing tracer callback after the stream union gained close**
- **Found during:** Task 2 full type-check
- **Issue:** An earlier test callback accepted only event/EOSE frames and no longer type-checked when the tracer correctly exposed close.
- **Fix:** Explicitly narrowed that test collector to its asserted event/EOSE subset.
- **Files modified:** `tests/tracer_end_to_end_test.ts`
- **Verification:** `deno task check` and full suite
- **Commit:** `5077892`

**Total deviations:** 2 auto-fixed (1 missing critical lifecycle behavior, 1 blocking test type adjustment). **Impact:** Canonical close behavior is stronger without expanding the production trust boundary.

## Issues Encountered

None remaining.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None - sibling input tampering and wire fixture spoofing are covered by T-02-17 and T-02-18; the report exposes only public versions, revisions, contract names, and coverage per T-02-19.

## Verification

- `deno test -A tests/runtime_contract_test.ts tests/end_to_end_test.ts` — 5 passed, 0 failed; tracer gate rerun also passed.
- `deno test -A tests/contract_drift_test.ts tests/runtime_contract_test.ts` — 6 passed, 0 failed.
- Production sibling-import search — no `../kehto` or `../napplet` imports outside diagnostic inputs.
- `deno task check` — formatting, lint, and TypeScript checks passed.
- `deno task test` — 97 passed, 0 failed.

## Self-Check: PASSED

- Every created and modified artifact listed above exists.
- Commits `13c28a0`, `593f22a`, `54f578d`, and `5077892` exist.
- All task acceptance criteria and plan-level verification commands pass.

## Next Phase Readiness

- Phase 2 contract and drift requirements V2-07 and V2-08 are complete.
- Phase 3 can extend the same pinned-fixture and diagnostic-only sibling pattern to broader NAP domains without changing production dependency authority.

---
*Phase: 02-backend-runtime-expansion*
*Completed: 2026-07-30*
