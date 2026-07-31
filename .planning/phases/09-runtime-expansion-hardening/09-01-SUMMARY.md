---
phase: 09-runtime-expansion-hardening
plan: "01"
subsystem: testing
tags: [deno, nap, contract-parity, traceability, tdd]
requires:
  - phase: 06-common-data-and-durable-storage
    provides: passed canonical verification and per-plan coverage
  - phase: 07-intent-navigation
    provides: passed canonical verification and per-plan coverage
  - phase: 08-cross-tab-media-sessions
    provides: passed canonical verification and per-plan coverage
provides:
  - exhaustive 100-row pinned NAP contract registry across ten domains
  - release-blocking parity and SILENT_IGNORE tests
  - exact 33-ID requirement and roadmap traceability audit
affects: [09-runtime-expansion-hardening, release-gates, dispatcher-hardening]
tech-stack:
  added: []
  patterns: [codec-derived fixture joined bidirectionally to production registry, closed release disposition vocabulary]
key-files:
  created: [runtime/nap_contract_registry.ts, tests/fixtures/v1_1_contract_matrix.json, tests/contract_parity_test.ts, tests/requirement_traceability_test.ts, .planning/phases/09-runtime-expansion-hardening/CONTRACT-PARITY.md]
  modified: []
key-decisions:
  - "Treat every pinned discriminant as a first-class evidence row; SILENT_IGNORE is unrepresentable and explicitly tested as a blocker."
  - "Report the 13 stale checked-versus-Pending requirement claims without editing completion state before final Phase 9 reconciliation."
patterns-established:
  - "Contract parity: compare canonical-minus-registry and registry-minus-canonical, then validate every evidence field."
  - "Traceability: parse REQUIREMENTS and ROADMAP independently and join every v1.1 ID exactly once."
requirements-completed: [QLT-01]
coverage:
  - id: D1
    description: "All 100 pinned request, result, event, and handshake discriminants across ten domains have explicit direction, grant, decoder, owner, terminal, requirement, test, and disposition evidence."
    requirement: QLT-01
    verification:
      - kind: integration
        ref: "tests/contract_parity_test.ts#pinned 0.31.0 ten-domain matrix exactly matches production registry"
        status: pass
      - kind: integration
        ref: "tests/contract_parity_test.ts#fixture literals are extracted exactly from pinned NAP declarations"
        status: pass
    human_judgment: false
  - id: D2
    description: "Missing, invented, wrong-direction, incomplete-evidence, advertised-unsupported, and SILENT_IGNORE rows block release."
    requirement: QLT-01
    verification:
      - kind: unit
        ref: "tests/contract_parity_test.ts#contract parity blocks every malformed or silent disposition"
        status: pass
    human_judgment: false
  - id: D3
    description: "All 33 v1.1 requirement IDs map exactly once to the matching ROADMAP phase with closed statuses and contradictions reported."
    requirement: QLT-01
    verification:
      - kind: unit
        ref: "tests/requirement_traceability_test.ts#all 33 v1.1 requirements map exactly once with honest evidence status"
        status: pass
    human_judgment: false
duration: 17min
completed: 2026-07-31
status: complete
---

# Phase 9 Plan 1: Contract Parity and Traceability Summary

**A 100-row pinned NAP registry now makes ten-domain contract drift, invented actions, incomplete evidence, and silent dispatch release-blocking while auditing all 33 v1.1 requirement mappings.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-07-31T05:46:00Z
- **Completed:** 2026-07-31T06:03:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Passed the exact independent Phase 6–8 VERIFICATION/SUMMARY/coverage prerequisite before freezing the matrix.
- Joined 100 pinned literals across SHELL, IDENTITY, RELAY, OUTBOX, RESOURCE, UPLOAD, COMMON, STORAGE, INTENT, and MEDIA to production ownership and executable evidence.
- Proved malformed and SILENT_IGNORE rows fail, and audited 33 unique requirement mappings while retaining honest stale-claim reporting.

## Task Commits

1. **TDD RED: contract parity and traceability gates** — `5724bc3`
2. **TDD GREEN: exhaustive registry, fixture, report, and parsers** — `2908a7f`
3. **Rule 3 fix: pin test imports to repository convention** — `b7bf760`

## Files Created/Modified

- `runtime/nap_contract_registry.ts` — closed production registry, parity auditor, and traceability parser.
- `tests/fixtures/v1_1_contract_matrix.json` — codec-derived ten-domain literal inventory.
- `tests/contract_parity_test.ts` — installed-declaration extraction and blocker tests.
- `tests/requirement_traceability_test.ts` — exact 33-ID ledger join and contradiction evidence.
- `.planning/phases/09-runtime-expansion-hardening/CONTRACT-PARITY.md` — readable zero-blocker parity report.

## Decisions Made

- The canonical matrix includes the two SHELL handshake envelopes plus every literal from the nine installed pinned NAP domain declarations, for 100 rows total.
- Existing unselected NAP domains remain outside the registry and receive no grant or advertisement.
- Thirteen checked requirements whose traceability rows remain `Pending` are reported for final reconciliation, not prematurely rewritten.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adapted the prerequisite command to Deno 2.9 eval semantics**
- **Found during:** Task 1 precondition
- **Issue:** Deno 2.9 rejects the obsolete `deno eval --allow-read` flag before executing the evidence gate.
- **Fix:** Ran the byte-equivalent fail-closed evaluator with current `deno eval` semantics; all Phase 6–8 evidence passed without changing planning artifacts.
- **Files modified:** None
- **Verification:** Prerequisite evaluation exited successfully.

**2. [Rule 3 - Blocking] Pinned new test assertion imports**
- **Found during:** Full `deno task check`
- **Issue:** Repository lint rejects unversioned JSR imports.
- **Fix:** Pinned both new tests to the established `jsr:@std/assert@1.0.16` import.
- **Files modified:** `tests/contract_parity_test.ts`, `tests/requirement_traceability_test.ts`
- **Verification:** `deno task check` and the 239-test full suite pass.
- **Committed in:** `b7bf760`

**Total deviations:** 2 auto-fixed (2 Rule 3)
**Impact on plan:** Execution semantics and repository import policy were corrected without weakening any gate or expanding scope.

## Issues Encountered

None outstanding. The readable report records the 13 known bookkeeping contradictions for later Phase 9 reconciliation.

## User Setup Required

None.

## Next Phase Readiness

Later Phase 9 plans can consume the registry as the release ledger. Contract parity, focused tests, formatting, lint, type-check, and all 239 tests pass.

## Self-Check: PASSED

All five created artifacts exist; commits `5724bc3`, `2908a7f`, and `b7bf760` are present; canonical coverage contains three non-empty passing verification records.

---
*Phase: 09-runtime-expansion-hardening*
*Completed: 2026-07-31*
