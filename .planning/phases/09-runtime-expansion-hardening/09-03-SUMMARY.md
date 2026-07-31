---
phase: 09-runtime-expansion-hardening
plan: "03"
subsystem: security
tags: [deno, capabilities, catalog, signer, authority, tdd]
requires:
  - phase: 09-runtime-expansion-hardening
    plan: "02"
    provides: closed transport and binary transfer authority boundaries
provides:
  - exact action-level capability authorization backed by the pinned contract registry
  - generation/account/catalog-bound window and launch authority
  - signer-safe catalog mutation checks and sanitized sign-in failures
  - focused hostile authority matrix with zero mandatory red rows
affects: [09-04-state-isolation, runtime-dispatch, catalog-launch, signer-boundaries]
tech-stack:
  added: []
  patterns: [server-owned immutable authority context, async effect authority recheck, closed registry grant lookup]
key-files:
  created: [tests/adversarial_authority_test.ts]
  modified: [runtime/catalog.ts, runtime/signer_service.ts, runtime/nap_contract_registry.ts, runtime/nap_dispatcher.ts, runtime/portal_runtime.ts]
key-decisions:
  - "Preserve exact manifest capability literals and authorize an action only through an exact action grant or an explicit whole-domain grant."
  - "Re-check active account and exact accepted catalog identity after asynchronous resolution and immediately before signing or publication effects."
  - "Treat signer implementation errors as private causes and expose only stable browser-safe failure messages."
patterns-established:
  - "Authority contexts are immutable server-owned objects bound to connection, window, account, artifact, instance, grants, and generation."
  - "Async catalog work snapshots authority, then revalidates it before releasing bytes, signing, publishing, or committing state."
requirements-completed: [QLT-02]
coverage:
  - id: D1
    description: "Exact capability grants deny sibling, malformed, invented, and foreign actions before signer-backed effects."
    requirement: QLT-02
    verification:
      - kind: integration
        ref: "tests/adversarial_authority_test.ts#authority tracer rejects an ungranted action before signer effect"
        status: pass
      - kind: unit
        ref: "tests/adversarial_authority_test.ts#authority matrix denies malformed invented and sibling grants"
        status: pass
    human_judgment: false
  - id: D2
    description: "Window and catalog authority reject foreign account, identity, artifact, instance, and stale generation replacements."
    requirement: QLT-02
    verification:
      - kind: unit
        ref: "tests/adversarial_authority_test.ts#window authority matrix rejects foreign identity instance and generation"
        status: pass
      - kind: integration
        ref: "tests/adversarial_authority_test.ts#catalog authority rejects account replacement during artifact resolution"
        status: pass
    human_judgment: false
  - id: D3
    description: "Catalog signer work has zero effects after authority replacement and signer failures disclose no secret-bearing detail."
    requirement: QLT-02
    verification:
      - kind: integration
        ref: "tests/adversarial_authority_test.ts#catalog signer authority rejects account replacement before publication"
        status: pass
      - kind: unit
        ref: "tests/adversarial_authority_test.ts#signer failures never return nsec bunker or upstream authority details"
        status: pass
    human_judgment: false
duration: 8min
completed: 2026-07-31
status: complete
---

# Phase 9 Plan 3: Authority Boundary Hardening Summary

**Exact registry grants and server-owned account, artifact, instance, and generation authority now deny forged or stale capability, catalog, identity, and signer requests with zero effects.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-31T06:13:33Z
- **Completed:** 2026-07-31T06:21:38Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Closed the broad-domain privilege expansion that allowed `common.encodeNip19` to confer signer-backed `common.follow` authority.
- Bound every production window context to exact process-owned connection, account, accepted manifest, verified identity, instance, and generation truth.
- Revalidated catalog launch and signer mutation authority across asynchronous seams while sanitizing all napplet-visible denials.

## Task Commits

1. **Task 1 RED: failing exact capability authority tracer** — `87a1cad`
2. **Task 1 GREEN: exact window capability authority** — `af1f27e`
3. **Task 2 RED: failing catalog and signer authority matrix** — `5d290f6`
4. **Task 2 GREEN: catalog, signer, and generation remediation** — `3a94e02`

## Files Created/Modified

- `tests/adversarial_authority_test.ts` — six-row focused hostile authority evidence suite.
- `runtime/nap_contract_registry.ts` — closed action/domain grant lookup over supported advertised request rows.
- `runtime/nap_dispatcher.ts` — exact grant checks and canonical window-authority predicate.
- `runtime/portal_runtime.ts` — immutable launch grants and server-owned authority generations.
- `runtime/catalog.ts` — account/catalog rechecks across launch, signing, publication, and commit seams.
- `runtime/signer_service.ts` — stable sanitized bunker and nsec failures.

## Decisions Made

- Whole-domain grants remain intentional compatibility authority; action grants no longer widen to siblings.
- Object identity is part of the out-of-band window capability: a napplet cannot recreate authority by copying visible-looking fields.
- Catalog mutation publication may begin only while the original active account and catalog replacement remain exact.

## Deviations from Plan

None - the adversarial matrix discovered and remediated only the bounded authority rows named by the plan.

## Issues Encountered

- The focused gate passed 22/22 and `deno task check` passed.
- The repository-wide suite passed 249 tests and had one externally owned planning-ledger expectation failure in `tests/requirement_traceability_test.ts`: it still expects concurrently advanced `QLT-02` and `QLT-03` statuses to remain pending. Exact evidence is recorded in `deferred-items.md`; no runtime or authority test failed.

## TDD Gate Compliance

- RED commits: `87a1cad`, `5d290f6`
- GREEN commits: `af1f27e`, `3a94e02`
- Tracer feedback gate: passed after Task 1 commit.

## User Setup Required

None.

## Next Phase Readiness

The capability/catalog/identity/signer authority matrix has zero mandatory red rows, so the next state-isolation plan can begin. The unrelated traceability expectation remains assigned to final Phase 9 bookkeeping.

## Known Stubs

None.

## Self-Check: PASSED

All six changed implementation/test files exist; commits `87a1cad`, `af1f27e`, `5d290f6`, and `3a94e02` are present; the focused 22-test authority/catalog/signer gate and repository format/lint/type-check gate pass.

---
*Phase: 09-runtime-expansion-hardening*
*Completed: 2026-07-31*
