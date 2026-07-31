---
phase: 07-intent-navigation
plan: 04
subsystem: runtime
tags: [intent, websocket, ticket, reconnect, csp]
requires:
  - phase: 07-intent-navigation
    provides: Exact intent registry, private ticket dispatcher, and secure shell navigation
provides:
  - Process-owned production IntentService composition
  - Exact target-window WebSocket ticket claim and private verified launch delivery
  - Opener-sever-first same-origin reservation entry with unchanged iframe sandbox
  - Built-server reconnect and claim namespace isolation coverage
affects: [intent-navigation, production-runtime, shell-navigation]
tech-stack:
  added: []
  patterns: [fragment-erased capability bootstrap, target-window claim namespace, atomic single-use payload release]
key-files:
  created: [islands/IntentReservation.tsx, tests/intent_production_test.ts]
  modified: [main.ts, routes/api/runtime.ts, runtime/intent.ts, runtime/portal_runtime.ts, runtime/connections.ts, runtime/transport.ts, routes/intent/reserved.tsx, tests/runtime_reconnect_smoke_test.ts]
key-decisions:
  - "Expose the IntentService created from the production CatalogService as the single process-owned intent authority."
  - "Bind a fresh target WebSocket to the backend-issued targetWindowId and require the opaque ticket before releasing verified launch bytes."
  - "Erase ticket-bearing fragment state immediately after opener severing and retain the exact allow-scripts-only iframe sandbox."
patterns-established:
  - "Rejected target claims return correlation and status only; private payload fields are emitted solely after atomic claim success."
  - "Target-window sockets cannot alias reconnect namespaces, preventing stale connection authority from crossing into a new surface."
requirements-completed: [INT-01, INT-02, INT-03]
coverage:
  - id: D1
    description: "Production composes one intent authority and routes exact reserve, acknowledgement, and claim traffic through authenticated runtime windows."
    requirement: INT-01
    verification:
      - kind: integration
        ref: "tests/intent_production_test.ts#production intent tracer uses one process-owned exact service"
        status: pass
    human_judgment: false
  - id: D2
    description: "A same-origin target severs opener, erases its opaque bootstrap fragment, claims once, and mounts only verified sandboxed srcdoc."
    requirement: INT-02
    verification:
      - kind: integration
        ref: "tests/intent_production_test.ts#reservation opener is severed before transport and CSP stays external"
        status: pass
    human_judgment: false
  - id: D3
    description: "Reconnect and target claim namespaces remain isolated while failed claims disclose no private launch payload."
    requirement: INT-03
    verification:
      - kind: e2e
        ref: "tests/runtime_reconnect_smoke_test.ts#built Fresh server resumes one runtime WebSocket namespace"
        status: pass
      - kind: integration
        ref: "tests/runtime_reconnect_smoke_test.ts#intent target sockets cannot combine reconnect and claim namespaces"
        status: pass
    human_judgment: false
duration: 14min
completed: 2026-07-31
status: complete
---

# Phase 7 Plan 4: Production Intent Integration Summary

**Production WebSockets now carry exact intent discovery and invocation into opener-safe, single-use verified launch claims without weakening iframe sandboxing or reconnect ownership.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-31T04:28:00Z
- **Completed:** 2026-07-31T04:42:00Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Exposed one process-owned `IntentService` from the same production `CatalogService` and routed strict reserve, invoke, acknowledgement, query, and claim messages through `/api/runtime`.
- Added an opener-sever-first Fresh island that validates and erases opaque fragment capability state before opening transport, then mounts only atomically claimed verified `srcdoc` in `sandbox="allow-scripts"`.
- Proved the built Fresh server WebSocket reconnect path, frozen signed-tag declaration seam, claim correlation, namespace isolation, and rejection-without-disclosure behavior.

## Task Commits

1. **Task 1: Trace pinned INTENT over production transport** - `26602ed`
2. **Task 2: Serve opener-sever-first reservation entry** - `b500818`
3. **Task 3: Prove reconnect namespace isolation** - `9f4dbd4`
4. **Rule 1 fix: Satisfy Deno browser-global lint** - `c6caca4`

## Files Created/Modified

- `main.ts` - Retains the production process-owned intent authority.
- `routes/api/runtime.ts` - Creates exact target window namespaces and returns correlated claim results.
- `runtime/intent.ts` - Binds verified launch bytes to expiring single-use tickets.
- `runtime/connections.ts` - Supports collision-checked backend-issued target window IDs.
- `runtime/portal_runtime.ts` - Returns the single configured intent service.
- `runtime/transport.ts` - Restricts authorized navigation to the fixed reservation route.
- `routes/intent/reserved.tsx` - Hosts only the generated reservation island.
- `islands/IntentReservation.tsx` - Severs opener, validates/erases capability state, claims, and mounts verified content.
- `tests/intent_production_test.ts` - Covers production composition, declarations, CSP, opener ordering, and bootstrap bounds.
- `tests/intent_navigation_test.tsx` - Covers the generated reservation bootstrap contract.
- `tests/runtime_reconnect_smoke_test.ts` - Covers built-server reconnect and target namespace isolation.

## Decisions Made

- A new target surface receives a backend-issued `targetWindowId`; it cannot present a reconnect token on the same upgrade.
- Ticket possession alone is insufficient: claims still require exact reservation, target window, generation, active account, current catalog authority, and expiry checks.
- Successful claims include the already-verified launch `srcdoc` privately; rejected claims include no claim payload.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced lint-forbidden browser global spelling**
- **Found during:** Overall `deno task check`
- **Issue:** Deno's `no-window` rule rejected `window.opener` even though the browser operation was correct.
- **Fix:** Used `globalThis.opener` while preserving the required first-operation ordering.
- **Files modified:** `islands/IntentReservation.tsx`, intent tests
- **Verification:** `deno task check` and production build pass.
- **Committed in:** `c6caca4`

**Total deviations:** 1 auto-fixed bug.
**Impact on plan:** No scope change; the fix was required for the mandated lint gate.

## Issues Encountered

The supplied legacy tracer manifest has no archetype tag, so production coverage validates the real artifact declaration field remains frozen and separately exercises the canonical signed-tag decoder rather than inventing unsigned fixture authority.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## TDD Gate Compliance

Warning: the production tracer tests and implementation landed together in `26602ed` rather than separate RED and GREEN commits. All required behavior is covered and passing, but this plan does not have a distinct Task 1 RED commit.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: target-window-websocket | routes/api/runtime.ts | New target namespace upgrades are bounded, same-origin, non-reconnectable, collision checked, and disclose payload only after an exact atomic ticket claim. |

## Next Phase Readiness

Phase 7 production integration is complete and ready for milestone verification. No blocking intent, ticket, reconnect, CSP, or sandbox issue remains.

## Self-Check: PASSED

- All created and modified files exist.
- Commits `26602ed`, `b500818`, `9f4dbd4`, and `c6caca4` exist.
- All 19 focused intent/reconnect tests, `deno task check`, `deno task build`, and the built-server WebSocket smoke pass.

---
*Phase: 07-intent-navigation*
*Completed: 2026-07-31*
