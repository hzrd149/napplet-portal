---
phase: 07-intent-navigation
fixed_at: 2026-07-31T04:50:04Z
review_path: .planning/phases/07-intent-navigation/07-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-07-31T04:50:04Z
**Source review:** `.planning/phases/07-intent-navigation/07-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 8
- Fixed: 8
- Skipped: 0
- Verification: `deno task check`, 213 tests, production build, and runtime reconnect/intent smoke passed

## Fixed Issues

### CR-01: Production authorization emits a path the popup controller always rejects

**Files modified:** `runtime/transport.ts`, `runtime/intent.ts`, `islands/NappletShell.tsx`, `tests/intent_navigation_test.tsx`
**Commit:** c43eedb
**Applied fix:** Added one reserved-launch codec and validated the exact backend-issued route in the popup controller.

### CR-02: Reuse and stack modes are not wired

**Files modified:** `islands/NappletShell.tsx`, `tests/intent_navigation_test.tsx`
**Commit:** ba53379
**Applied fix:** Routed every invocation through new-tab, reuse, or stack reservation handling; claimed verified targets into retained surfaces and wired focus, push, Back, and Close lifecycle behavior.
**Status:** fixed; requires human verification of browser navigation behavior.

### CR-03: Process runtime lacks production resolver settings

**Files modified:** `main.ts`, `routes/api/runtime.ts`, `tests/intent_production_test.ts`
**Commit:** 0e26686
**Applied fix:** Moved process runtime construction into the production composition root with runtime settings and injected it through request state.

### CR-04: Signed archetype authority does not verify the manifest signature

**Files modified:** `runtime/portal_runtime.ts`, `tests/intent_production_test.ts`
**Commit:** df1ae6c
**Applied fix:** Added explicit `verifyEvent` enforcement at the production catalog authority boundary and invalid-signature coverage.

### CR-05: Reconnected sessions send intent events through the closed socket

**Files modified:** `runtime/connections.ts`, `routes/api/runtime.ts`, `tests/websocket_session_test.ts`
**Commit:** bd5a252
**Applied fix:** Routed bridge text and binary output through the reconnect-aware connection registry so resumed sockets receive intent events.

### CR-06: Popup retains a live opener until hydration and lacks route CSP

**Files modified:** `routes/intent/reserved.tsx`, `static/intent-reserved.js`, `tests/intent_navigation_test.tsx`, `tests/intent_production_test.ts`
**Commit:** 1790717
**Applied fix:** Replaced the island route with a minimal dedicated response, parser-blocking opener-sever bootstrap, and restrictive route-specific CSP.

### CR-07: Removed handlers never emit an unavailable change event

**Files modified:** `runtime/intent.ts`, `tests/intent_runtime_test.ts`
**Commit:** 13483d8
**Applied fix:** Diffed previous registry keys and emitted frozen canonical unavailable projections for removed archetypes.

### WR-01: Endpoint correlation maps are unbounded

**Files modified:** `routes/api/runtime.ts`, `tests/websocket_session_test.ts`
**Commit:** a07e7a3
**Applied fix:** Added bounded, expiring, duplicate-rejecting correlation registries, close cleanup, and canonical unmatched-invocation failure replies.

## Additional Integration Repair

**Files modified:** `tests/common_runtime_integration_test.ts`, `tests/common_storage_runtime_test.ts`
**Commit:** 3501574
**Applied fix:** Updated catalog test doubles to implement the authority snapshot contract exercised by the full integration suite.

---

_Fixed: 2026-07-31T04:50:04Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
