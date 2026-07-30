---
phase: 01-one-day-napplet-runtime-mvp
plan: 06
subsystem: fresh-runtime
tags: [fresh, runtime, signer, docs, e2e, mobile-shell]
requires:
  - phase: 01-04
    provides: approved mobile shell and persistent opaque iframe bridge
  - phase: 01-05
    provides: singleton identity, RELAY, and OUTBOX runtime services
provides:
  - Fresh composition that shares one process-owned portal runtime and signer service
  - Loopback-safe startup defaults with sanitized readiness output
  - Operator documentation for configuration, sensitive state, exact NAP coverage, and deferrals
  - End-to-end and documentation tests for the supplied-napplet vertical slice
  - Process-owned Nostr Connect lifecycle with reconnect replay and explicit cancellation
affects: [phase-01-verification, fresh-startup, signer-lifecycle, operator-docs]
tech-stack:
  added: [@libs/qrcode]
  patterns: [singleton-runtime-composition, process-owned-signer-service, loopback-default-binding]
key-files:
  created: [tests/end_to_end_test.ts, tests/docs_test.ts, runtime/signer_service.ts]
  modified: [main.ts, utils.ts, README.md, deno.json, deno.lock, vite.config.ts, routes/api/runtime.ts, islands/NappletShell.tsx, assets/styles.css, runtime/accounts.ts, runtime/config.ts, runtime/portal_runtime.ts, routes/index.tsx, tests/accounts_test.ts, tests/config_test.ts, tests/shell_architecture_test.ts, tests/signer_service_test.ts, tests/websocket_session_test.ts]
key-decisions:
  - "Fresh constructs one process runtime and one process-owned signer service before filesystem routes are registered."
  - "Default dev and production startup bind to 127.0.0.1 unless PORTAL_BIND explicitly overrides to another loopback address."
  - "Nostr Connect signer attempts are owned by the process signer service, not by transient WebSocket sessions."
  - "Remote signer QR/link/cancel state is browser-safe projection only; signer material and relay authority stay server-side."
patterns-established:
  - "Route state carries browser-safe handles to process-owned services; islands keep only UI and transport behavior."
  - "Startup summaries log counts and configured/empty status, never bunker URIs, nsec values, or account snapshots."
  - "Signer attempts survive browser projection cleanup and can be explicitly cancelled before a fresh attempt."
requirements-completed: [MVP-01, MVP-02, MVP-03, MVP-04, MVP-05, AUTH-06, STREAM-01, STREAM-05, NAP-01, NAP-02, NAP-03, NAP-04, QUAL-01, QUAL-02, QUAL-03, QUAL-04]
coverage:
  - id: D1
    description: "Fresh composition is starter-free, singleton-owned, loopback-safe, and exposes one process runtime through typed route state."
    requirement: MVP-01
    verification:
      - kind: e2e
        ref: "tests/end_to_end_test.ts#Fresh composition is singleton, loopback-safe, and starter-free"
        status: pass
      - kind: other
        ref: "deno task check"
        status: pass
    human_judgment: false
  - id: D2
    description: "The supplied Security Lab fixture traverses verified artifact mount, exact shell handshake, identity, stored RELAY value, and later live RELAY update."
    requirement: MVP-05
    verification:
      - kind: e2e
        ref: "tests/end_to_end_test.ts#supplied Security Lab traverses verified mount, handshake, identity, and continuing stream"
        status: pass
      - kind: e2e
        ref: "tests/tracer_end_to_end_test.ts#verified Security Lab completes sign-in, handshake, and continuing relay stream"
        status: pass
    human_judgment: false
  - id: D3
    description: "Operator documentation covers environment, local endpoints, sensitive account storage, unbounded process cache, exact SHELL/IDENTITY/RELAY/OUTBOX scope, and locked deferrals."
    requirement: QUAL-04
    verification:
      - kind: unit
        ref: "tests/docs_test.ts#operator documentation covers configuration security and exact scope"
        status: pass
    human_judgment: false
  - id: D4
    description: "Nostr Connect launch, QR/link parity, process-owned signer attempts, reconnect replay, restored active state, and explicit cancellation are covered."
    requirement: AUTH-06
    verification:
      - kind: unit
        ref: "tests/shell_architecture_test.ts#signer launch and QR encode the exact same Nostr Connect URI"
        status: pass
      - kind: unit
        ref: "tests/signer_service_test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "The approved mobile shell, real signer flows, real relay/outbox/reconnect behavior, and responsive safe-area layouts need operator acceptance against the supplied napplet."
    requirement: QUAL-03
    verification:
      - kind: manual_procedural
        ref: "01-06-PLAN.md#Validate the supplied napplet and approved mobile shell"
        status: unknown
    human_judgment: true
    rationale: "The plan's final checkpoint requires real browser/device inspection and approval of signer, relay, outbox, reconnect, and responsive shell flows."
duration: 55min
completed: 2026-07-30
status: complete
---

# Phase 01 Plan 06: Fresh Composition and Acceptance Summary

**Fresh now boots a loopback-safe singleton Napplet Portal runtime with process-owned signer lifecycle, supplied-napplet end-to-end tests, and truthful operator documentation.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-07-30T13:24:30Z
- **Completed:** 2026-07-30T15:15:30Z
- **Tasks:** 3
- **Files modified:** 19

## Accomplishments

- Replaced starter Fresh composition with one process-owned portal runtime, typed route state, static files, filesystem routes, and sanitized startup logging.
- Added end-to-end coverage for the supplied Security Lab fixture through sign-in, verified artifact resolution, source-bound iframe handshake, identity, stored RELAY data, and later live RELAY updates.
- Documented environment variables, loopback binding, local endpoint behavior, sensitive account snapshots, unbounded process cache, exact Phase 1 NAP coverage, and deferred scope.
- Hardened remote signer startup so Nostr Connect attempts are owned by a process service, survive browser reconnect/projection cleanup, expose QR/link parity, restore active accounts, and support explicit cancellation.
- Closed code-review findings by adding same-origin WebSocket enforcement, current-state socket close handling, startup restore rejection handling, and restored-account cache invalidation/refresh.
- Kept backend runtime authority, signer material, relay processing, and persistent state out of islands.

## Task Commits

1. **Task 1 RED: Fresh vertical-slice acceptance** - `2a2459e` (test)
2. **Task 1 GREEN: Singleton Fresh/runtime composition** - `9df507c` (feat)
3. **Task 2: Operations, security, and scope documentation** - `905546e` (docs)
4. **Task 1 fix: Loopback defaults in runtime tasks** - `4bd37a3` (fix)
5. **Task 1 fix: Vite loopback server binding** - `90e600c` (fix)
6. **Task 3 fix: Nostr Connect QR/link URI parity** - `3aaa768` (fix)
7. **Task 3 fix: Approved signer action copy** - `58be8fa` (fix)
8. **Task 3 RED: Remote signer lifecycle regressions** - `ba8bec8` (test)
9. **Task 3 GREEN: Wait for Applesauce remote signer connection** - `6b08075` (fix)
10. **Task 3 RED: Signer initiation handshake race** - `d66781c` (test)
11. **Task 3 RED: Process-owned signer connection service** - `2666644` (test)
12. **Task 3 GREEN: Decouple signer attempts from WebSocket sessions** - `9169540` (fix)
13. **Task 3 RED: Explicit signer cancellation UX** - `b41e5f2` (test)
14. **Task 3 GREEN: Remote signer cancellation** - `39ac8f2` (fix)
15. **Code review fix: Runtime origin, close, and restore handling** - `cc30a07` (fix)
16. **Code review fix: Restored signer cache invalidation** - `b4149aa` (fix)

## Files Created/Modified

- `main.ts` - Fresh composition root with sanitized config load, one portal runtime, one process-owned signer service, and typed route state.
- `utils.ts` - Browser-safe request state typing for config, runtime, and signer service handles.
- `README.md` - Operator setup, security boundary, sensitive storage, NAP coverage, testing commands, and deferrals.
- `tests/end_to_end_test.ts` - Fresh singleton/startup and supplied-napplet vertical-slice acceptance.
- `tests/docs_test.ts` - Documentation coverage and no-secret examples gate.
- `runtime/signer_service.ts` - Process-owned signer attempt lifecycle, state projection, restore, and cancellation.
- `routes/api/runtime.ts` - Runtime WebSocket bridge wired to signer service projection and cancellation.
- `islands/NappletShell.tsx` - Browser shell signer QR/link/cancel UI and persistent iframe behavior.
- `deno.json`, `deno.lock`, `vite.config.ts` - Loopback task defaults and QR dependency wiring.
- `runtime/accounts.ts`, `runtime/config.ts`, `runtime/portal_runtime.ts`, `routes/index.tsx`, `assets/styles.css` - Startup, signer, shell, and runtime integration support.
- `tests/accounts_test.ts`, `tests/config_test.ts`, `tests/shell_architecture_test.ts`, `tests/signer_service_test.ts`, `tests/websocket_session_test.ts` - Regression coverage for signer relays, launch labels, lifecycle ownership, cancellation, origin checks, close handling, cache invalidation, and startup defaults.

## Decisions Made

- The server process owns signer connection attempts and account restoration; WebSocket sessions only observe and request actions.
- Startup logging remains intentionally sparse: bind, coordinate configured/empty value, relay/blossom counts, and account availability only.
- Vite dev and production commands default to loopback through task/config wiring rather than requiring each operator to remember host flags.
- Documentation treats complete account snapshots as sensitive host-permission-owned state and keeps catalog, durable caches, multi-user auth, approval UI, read-only accounts, example napplets, and production hardening deferred.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Remote signer activation could race browser session readiness**
- **Found during:** Task 3 signer verification
- **Issue:** A Nostr Connect signer could be initiated from transient transport-open behavior before the runtime session was ready.
- **Fix:** Added tests that forbid transport-open signer initiation and moved signer attempts behind server-owned session readiness.
- **Files modified:** `routes/api/runtime.ts`, `runtime/signer_service.ts`, `tests/shell_architecture_test.ts`, `tests/signer_service_test.ts`
- **Verification:** `deno task check` and all 50 tests pass.
- **Committed in:** `d66781c`, `2666644`, `9169540`

**2. [Rule 1 - Bug] Remote signer state needed explicit cancel and replay semantics**
- **Found during:** Task 3 signer lifecycle verification
- **Issue:** Browser reconnect/projection cleanup could lose QR-ready state, and a user had no explicit way to cancel a pending remote signer attempt before retrying.
- **Fix:** Replayed safe pending state from the process signer service, ignored late cancelled approvals, and added visible keyboard-accessible Cancel and fresh-attempt actions.
- **Files modified:** `islands/NappletShell.tsx`, `routes/api/runtime.ts`, `tests/shell_architecture_test.ts`, `tests/signer_service_test.ts`
- **Verification:** `deno task check` and all 50 tests pass.
- **Committed in:** `b41e5f2`, `39ac8f2`

**3. [Code review - Critical] Runtime WebSocket accepted cross-site browser commands**
- **Found during:** Execute-post code review
- **Issue:** `/api/runtime` accepted browser WebSocket upgrades without checking the `Origin` header.
- **Fix:** Added same-origin request validation before `ctx.upgrade()` and a missing/cross-site origin regression test.
- **Files modified:** `routes/api/runtime.ts`, `tests/websocket_session_test.ts`
- **Verification:** Clean re-review, `deno task check`, and 55 tests pass.
- **Committed in:** `cc30a07`

**4. [Code review - Warning/Critical] Shell and signer restore state could go stale**
- **Found during:** Execute-post code review
- **Issue:** The shell close handler captured first-render state, startup restore initially lacked rejection handling, and the module-level signer restore promise could remain rejected or stale across sign-in/sign-out mutations.
- **Fix:** Used current refs and functional profile updates on socket close, attached sanitized startup restore rejection handling, and refreshed/cleared the module restore cache on remote, bunker, nsec, sign-out, and restore rejection paths.
- **Files modified:** `main.ts`, `islands/NappletShell.tsx`, `tests/shell_architecture_test.ts`
- **Verification:** Clean re-review, `deno task check`, and 55 tests pass.
- **Committed in:** `cc30a07`, `b4149aa`

---

**Total deviations:** 4 auto-fixed (2 execution bugs, 2 code-review findings).
**Impact on plan:** The fixes strengthen the planned backend-owned signer/runtime boundary without broadening Phase 1 scope.

## Issues Encountered

- `deno task dev` cannot exercise `/api/runtime` WebSocket upgrades under Fresh 2.3/Vite middleware, so the README documents `deno task build && deno task start` for runtime transport checks.
- The final supplied-napplet/mobile shell checkpoint still requires human/device verification; the automated suite proves the local fixture and contract path, not the operator's real browser approval.

## User Setup Required

Manual acceptance remains required for the final Phase 1 UAT: run the documented local app with the supplied napplet and inspect the signer, relay, outbox, reconnect, Back behavior, persistent iframe, and responsive safe-area flows.

## Next Phase Readiness

- The complete Phase 1 runtime seam is available for phase-level verification and UAT routing.
- Future Phase 2 work can expand the backend runtime behind the existing singleton service boundary without moving Nostr authority into islands.

## Self-Check: PASSED

- `01-06-SUMMARY.md` now exists for the previously committed `01-06` work.
- All key files from the summary exist.
- Recent `01-06` commits are present.
- Code review report is clean with zero findings.
- `deno task check` passes.
- `deno task test` passes: 55 tests passed.
- Human shell acceptance remains explicitly marked as manual coverage.

---
*Phase: 01-one-day-napplet-runtime-mvp*
*Completed: 2026-07-30*
