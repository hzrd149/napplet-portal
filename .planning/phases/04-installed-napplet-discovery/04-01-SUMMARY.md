---
phase: 04-installed-napplet-discovery
plan: "01"
subsystem: backend-runtime
tags: [deno, nostr, catalog, artifact-integrity, relay-policy]
requires:
  - phase: 02-backend-runtime-expansion
    plan: "04"
    provides: signed installed catalog codec and serialized replacement mutation
  - phase: 02-backend-runtime-expansion
    plan: "03"
    provides: exact manifest and executable artifact integrity boundary
provides:
  - Immediate partial installed-catalog projection with bounded verified enrichment
  - Immutable naddr install review and generation-bound approval
  - Exact accepted-manifest backend launch authority
affects: [04-02-runtime-transport, 04-03-catalog-ui, installed-launch]
tech-stack:
  added: []
  patterns: [raw-truth-before-enrichment, exact-key-inflight-dedupe, stale-bound-authority]
key-files:
  created: []
  modified: [runtime/catalog.ts, runtime/relay_policy.ts, tests/catalog_test.ts, tests/relay_policy_test.ts]
key-decisions:
  - "Accepted catalog membership projects immediately and artifact availability enriches it independently through four workers."
  - "Install review facts are server-derived and approval is bound to the reviewed catalog event identity."
  - "Executable bytes are released only after the current catalog matches the exact catalog, coordinate, and accepted-manifest triple."
requirements-completed: [CAT-01, CAT-02, CAT-03]
coverage:
  - id: D1
    description: "Accepted entries remain visible through pending, ready, unavailable, retry, and stale completion states."
    requirement: CAT-01
    verification:
      - kind: integration
        ref: "tests/catalog_test.ts#accepted truth emits pending immediately, retains failure, retries, and discards stale completion"
        status: pass
      - kind: unit
        ref: "tests/catalog_test.ts#enrichment queue caps at four and shares exact in-flight work"
        status: pass
    human_judgment: false
  - id: D2
    description: "Strict named-manifest preview returns immutable verified facts through bounded policy-approved relays and approval rejects catalog replacement races."
    requirement: CAT-02
    verification:
      - kind: integration
        ref: "tests/catalog_test.ts#preview derives immutable facts, approval is generation-bound, and launch rechecks exact accepted triple"
        status: pass
      - kind: unit
        ref: "tests/relay_policy_test.ts#preview reads combine permitted hints before configured reads with stable cap and fallback"
        status: pass
    human_judgment: false
  - id: D3
    description: "Launch re-reads current account catalog truth and releases verified bytes only for the exact accepted triple."
    requirement: CAT-03
    verification:
      - kind: integration
        ref: "tests/catalog_test.ts#preview derives immutable facts, approval is generation-bound, and launch rechecks exact accepted triple"
        status: pass
      - kind: integration
        ref: "tests/artifact_resolver_test.ts"
        status: pass
    human_judgment: false
duration: 14min
completed: 2026-07-31
status: complete
---

# Phase 4 Plan 1: Backend Catalog Authority Summary

**Accepted catalog truth now streams before artifact resolution, while immutable install review and exact stale-checked launch keep executable bytes behind backend authority.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-31T00:55:00Z
- **Completed:** 2026-07-31T01:09:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Split stable accepted membership from optional artifact metadata and executable content, with immediate pending projection, unavailable retention, recovery, exact-key sharing, four-worker scheduling, and generation rejection.
- Added strict bounded kind-35129 naddr review using policy-approved hints plus configured reads, returning only immutable integrity-verified facts bound to the source catalog event.
- Bound approval to the reviewed generation and launch to the latest active-account catalog's exact catalog/coordinate/manifest triple before returning verified executable bytes.

## Task Commits

1. **Task 1 RED: Partial catalog authority behavior** - `a2ebbfe` (test)
2. **Task 1 GREEN: Streaming catalog enrichment** - `cdf3fed` (feat)
3. **Task 2 RED: Preview relay selection** - `368ab7a` (test)
4. **Task 2 GREEN: Install and launch authority** - `bd444b9` (feat)
5. **Static-gate correction** - `43987f9` (fix)

## Files Created/Modified

- `runtime/catalog.ts` - Partial projection lifecycle, bounded enrichment queue, strict preview, stale approval, and exact launch authority.
- `runtime/relay_policy.ts` - Canonical hints-first bounded preview relay selection.
- `tests/catalog_test.ts` - Deterministic deferred resolution, stale generation, preview, approval, and launch coverage.
- `tests/relay_policy_test.ts` - Scheme filtering, blocked precedence, stable dedupe/order, cap, and fallback coverage.

## Decisions Made

- Kept `project()` promise-compatible for existing callers while making its returned snapshot immediate and scheduling enrichment independently.
- Keyed in-flight work by active pubkey, catalog event ID, coordinate, and accepted manifest ID so asynchronous completion cannot cross authority generations.
- Kept executable `srcdoc` out of ordinary projections; only `launch()` returns the exact integrity-verified artifact.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected static-gate violations**
- **Found during:** Task 2 verification
- **Issue:** The new immediate projection retained a redundant `async`, and an in-flight task binding was unnecessarily mutable.
- **Fix:** Returned `Promise.resolve(snapshot)` and made the task binding immutable.
- **Files modified:** `runtime/catalog.ts`
- **Verification:** `deno task check`
- **Committed in:** `43987f9`

## Issues Encountered

- Repository-wide `deno test -A` reached 137 passing tests but the environment-dependent production reconnect smoke failed with loopback `ConnectionRefused` before exercising catalog behavior. The focused plan suite and `deno task check` pass; the out-of-scope item is recorded in `deferred-items.md`.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None - all new browser selector, relay hint, asynchronous enrichment, and executable release surfaces are covered by T-04-01 through T-04-05.

## Verification

- `deno test -A tests/catalog_test.ts tests/relay_policy_test.ts tests/artifact_resolver_test.ts` — 16 passed, 0 failed.
- `deno task check` — formatting, lint, and TypeScript checks passed.
- `deno test -A` — 137 tests passed; one pre-existing production reconnect smoke failed on loopback server startup and is deferred.

## Self-Check: PASSED

- All four planned source/test files exist.
- Task commits `a2ebbfe`, `cdf3fed`, `368ab7a`, `bd444b9`, and `43987f9` exist in git history.
- Every plan-specific automated verification and the repository static quality gate pass.

## Next Phase Readiness

- Plan 04-02 can expose preview, approval, launch, projection status, and retry through strict correlated transport messages.
- Plan 04-03 can render stable partial cards without receiving executable content.

---
*Phase: 04-installed-napplet-discovery*
*Completed: 2026-07-31*
