---
phase: 09-runtime-expansion-hardening
plan: "05"
subsystem: browser-boundary-security
tags: [deno, fresh, iframe, csp, permissions-policy, tdd]
requires:
  - phase: 09-runtime-expansion-hardening
    plan: "04"
    provides: exact account, window, and generation authority fencing
  - phase: 07-intent-navigation
    provides: source-bound stacked sandboxed frames
provides:
  - closed CSP, Permissions-Policy, referrer, MIME, and framing response headers
  - exact opaque-origin WindowProxy message admission
  - exact connection, window, identity, account, and generation delivery fencing
affects: [09-06-lifecycle-hardening, 09-09-final-reconciliation, QLT-02]
tech-stack:
  added: []
  patterns: [single response-policy owner, opaque-origin source gate, current-authority delivery gate]
key-files:
  created: [runtime/security_headers.ts, tests/adversarial_browser_boundary_test.ts, tests/napplet_frame_test.tsx, tests/runtime_transport_test.ts]
  modified: [main.ts, routes/_app.tsx, components/NappletFrame.tsx, runtime/portal_runtime.ts]
key-decisions:
  - "Apply one immutable browser policy after Fresh request handling so shell and runtime responses share the same fail-closed headers."
  - "Accept iframe messages only from the current WindowProxy with the opaque srcdoc origin, and recheck exact runtime recipient authority before delivery."
  - "Leave QLT ledger completion to Plan 09-09 final reconciliation."
patterns-established:
  - "Browser response boundary: overwrite rather than merge caller-provided security headers."
  - "Frame boundary: exact source plus origin null precedes all decoding and dispatch."
requirements-completed: []
coverage:
  - id: D1
    description: "The iframe retains exactly allow-scripts without same-origin, navigation, popup, form, modal, or download authority."
    requirement: QLT-02
    verification:
      - kind: unit
        ref: "tests/adversarial_browser_boundary_test.ts#mandatory browser boundary matrix is closed"
        status: pass
      - kind: unit
        ref: "tests/napplet_frame_test.tsx#napplet frame locks sandbox and registers source before bytes"
        status: pass
    human_judgment: false
  - id: D2
    description: "Foreign origins, WindowProxy sources, connections, windows, accounts, identities, and generations dispatch and receive no runtime data."
    requirement: QLT-02
    verification:
      - kind: integration
        ref: "tests/adversarial_browser_boundary_test.ts#browser boundary tracer denies a forged frame and closes response policy"
        status: pass
      - kind: integration
        ref: "tests/adversarial_browser_boundary_test.ts#mandatory browser boundary matrix is closed"
        status: pass
    human_judgment: false
  - id: D3
    description: "Built shell and runtime responses carry restrictive CSP and Permissions-Policy with hostile policy input overwritten."
    requirement: QLT-02
    verification:
      - kind: integration
        ref: "tests/runtime_transport_test.ts#runtime responses receive the closed browser policy"
        status: pass
      - kind: other
        ref: "deno task build"
        status: pass
    human_judgment: false
duration: 14min
completed: 2026-07-31
status: complete
---

# Phase 9 Plan 5: Browser Boundary Security Summary

**One immutable response policy and exact opaque-frame/current-recipient checks now deny hostile browser sources, origins, sandbox escalation, and stale runtime delivery.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-31T06:31:57Z
- **Completed:** 2026-07-31T06:45:57Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Locked the napplet iframe to `allow-scripts` with opaque origin and exact current `WindowProxy` admission before decoding or dispatch.
- Applied a single restrictive browser response policy across Fresh shell/runtime responses, including CSP, Permissions-Policy, no-referrer, nosniff, and frame denial.
- Fenced outbound runtime transfer delivery by current connection, window, account, verified identity, and generation authority.
- Passed all six focused browser-boundary tests, the production build, `deno task check`, and the full 261-test repository suite with zero mandatory red rows.

## Task Commits

1. **Task 1 RED: failing forged-frame browser tracer** — `b56bcc2`
2. **Task 1 GREEN: closed browser tracer boundary** — `a5ebf90`
3. **Task 2 RED: expanded hostile browser matrix** — `6666ac7`
4. **Task 2 GREEN: exhausted sandbox, origin, policy, and transport rows** — `3824957`

## Files Created/Modified

- `runtime/security_headers.ts` — immutable restrictive browser policy and response-header application.
- `main.ts` — global post-handler security policy middleware.
- `routes/_app.tsx` — stable no-referrer document metadata.
- `components/NappletFrame.tsx` — exact opaque-origin and WindowProxy message gate.
- `runtime/portal_runtime.ts` — current-recipient delivery authority revalidation.
- `tests/adversarial_browser_boundary_test.ts` — tracer and exhaustive hostile boundary matrix.
- `tests/napplet_frame_test.tsx` — exact sandbox, registration order, source, and origin evidence.
- `tests/runtime_transport_test.ts` — same-origin transport and response-policy evidence.

## Decisions Made

- Security response headers are overwritten from one immutable policy rather than merged with response-local input, so a caller cannot weaken them.
- The srcdoc iframe's legitimate browser origin is exactly `null`; any other explicit origin is rejected before message inspection.
- Delivery fencing recognizes both verified artifact identity and exact catalog manifest identity while requiring current connection/window/account authority.
- QLT-02 remains pending in `REQUIREMENTS.md`; only Plan 09-09 performs final ledger reconciliation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added the two named focused verification suites**

- **Found during:** Task 2 final verification
- **Issue:** The plan's mandatory command referenced `tests/napplet_frame_test.tsx` and `tests/runtime_transport_test.ts`, but neither file existed in the checkout.
- **Fix:** Added the exact named suites with sandbox/source-order and runtime origin/header coverage, preserving the mandatory command unchanged.
- **Files modified:** `tests/napplet_frame_test.tsx`, `tests/runtime_transport_test.ts`
- **Verification:** Exact six-test plan command, production build, and full 261-test repository suite pass.
- **Committed in:** `3824957`

---

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** Restored the specified verification surface without changing runtime architecture or dependencies.

## Issues Encountered

None beyond the expected TDD RED gates and missing named verification files.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

- Browser sandbox and response-policy mandatory rows are zero-red, so Plan 09-06 can begin lifecycle adversarial work.
- The QLT ledger intentionally remains unchanged for Plan 09-09 final reconciliation.
- No package, lockfile, generated cache, or shared research cache changes were made.

## Self-Check: PASSED

- All four created files and four modified owner files exist.
- All four RED/GREEN task commits exist.
- Focused tests, production build, repository check, and all 261 tests pass.

---
*Phase: 09-runtime-expansion-hardening*
*Completed: 2026-07-31*
