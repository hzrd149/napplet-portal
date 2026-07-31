---
phase: 07-intent-navigation
reviewed: 2026-07-31T05:05:00Z
depth: deep
files_reviewed: 18
files_reviewed_list:
  - islands/IntentReservation.tsx
  - islands/NappletShell.tsx
  - main.ts
  - routes/api/runtime.ts
  - routes/intent/reserved.tsx
  - runtime/catalog.ts
  - runtime/connections.ts
  - runtime/intent.ts
  - runtime/portal_runtime.ts
  - runtime/transport.ts
  - static/intent-reserved.js
  - tests/catalog_test.ts
  - tests/intent_contract_test.ts
  - tests/intent_navigation_test.tsx
  - tests/intent_production_test.ts
  - tests/intent_registry_test.ts
  - tests/intent_runtime_test.ts
  - tests/runtime_reconnect_smoke_test.ts
findings:
  critical: 7
  warning: 1
  info: 0
  total: 8
status: resolved
---

# Phase 7: Code Review Report

**Reviewed:** 2026-07-31T05:05:00Z
**Depth:** deep
**Files Reviewed:** 18
**Status:** resolved

## Summary

The Phase 7 implementation does not provide a working or secure production intent navigation path. The focused tests and `deno task check` pass, but the tests exercise isolated controllers with values that contradict the production protocol and use source-string assertions instead of end-to-end behavior. Seven ship-blocking correctness/security defects and one robustness defect were found.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Production authorization emits a path the popup controller always rejects

**File:** `runtime/intent.ts:239-245`, `islands/NappletShell.tsx:241-245`
**Issue:** `IntentService.reserve()` authorizes `/intent/reserved#...`, but `PopupReservationController.authorize()` accepts only paths beginning with `/napplet?`. Every genuine backend authorization therefore calls `fail(..., "failed")`, closes the reserved popup, and reports a failed invocation. The unit test hides the defect by inventing `/napplet?ticket=...` instead of using the backend output.
**Fix:** Define one shared launch-path codec/constructor and make the shell validate the exact backend-issued reserved route, then add an integration test that passes the real `IntentService` authorization into the real popup controller.

### CR-02: Reuse and stack modes are not wired, so all non-new-window invocations disappear

**File:** `islands/NappletShell.tsx:669-685`, `islands/NappletShell.tsx:589-593`
**Issue:** The browser creates a reservation only when `behavior.newWindow === true`. No code calls `SurfaceStackController.push()` or `focusReusable()` in production; the only production mutation is `replaceRoot()` for the initial artifact. Since the endpoint dispatches an invocation only after finding a paired reservation, normal reuse/stack invocations are silently discarded. Phase 7's reuse, stack, history, Back, and Close behavior exists only as disconnected controller code.
**Fix:** Route every validated `intent.invoke` through a shell-owned mode decision, synchronously create the appropriate reservation, claim the authorized ticket into a verified `IntentSurface`, and call `focusReusable()` or `push()` as appropriate. Add browser/runtime integration coverage for all three modes.

### CR-03: The process runtime is constructed without production resolver settings

**File:** `routes/api/runtime.ts:54`, `main.ts:6-7`, `runtime/portal_runtime.ts:351-356`
**Issue:** The singleton exported to production is created as `createPortalRuntime({ fixture })`. Consequently `productionCatalogResolver` is always undefined. `main.ts` wires the real `CatalogService` to that singleton, so real `35129:` installed manifests fail in `resolveCatalogArtifact()` unless they happen to be the bundled test fixture. Production intent authority can never populate from the user's real catalog.
**Fix:** Construct the process runtime in the production composition root with `runtimeSettings` (and the process event runtime), remove the fixture-owned singleton from the route module, and inject the configured runtime into the handler exclusively through `ctx.state`.

### CR-04: Signed archetype authority does not verify the manifest signature

**File:** `runtime/portal_runtime.ts:297-308`
**Issue:** `createProductionCatalogResolver()` checks kind, pubkey text, d-tag, and event ID equality but never calls `verifyEvent(event)`. It then treats archetype tags as signed authority. This boundary must not assume that a relay, loader, or injected `EventRuntime` has verified signatures; an invalid event with matching fields can become executable intent authority.
**Fix:** Call `verifyEvent(event)` at this exact boundary before decoding declarations or resolving artifacts, and reject an invalid ID/signature pair. Add a test with a structurally correct manifest whose signature is invalid.

### CR-05: Reconnected sessions keep sending intent events through the closed socket

**File:** `routes/api/runtime.ts:123-149`, `routes/api/runtime.ts:156-163`
**Issue:** `runtime.openWindow()` captures the first `socket` in its `sendTransfer` callback. On reconnect, the endpoint reuses the existing session and bridge but never rebinds that callback. `ConnectionRegistry.attach()` updates only its own sender, while intent notifications, authorizations, results, and tickets use `transferSends` directly. After a disconnect/resume, those messages test the old socket's `readyState` and are dropped for the entire resumed session.
**Fix:** Route all bridge output through `ConnectionRegistry.send()`, or provide an explicit rebind method when a session resumes. Add a reconnect test that begins an intent before disconnect and observes authorization/result on the resumed socket.

### CR-06: The popup retains a live opener until hydration and the route has no restrictive CSP

**File:** `routes/intent/reserved.tsx:4-8`, `islands/IntentReservation.tsx:9-13`, `static/intent-reserved.js:1-6`
**Issue:** The claimed "opener-sever-first" bootstrap is not first: the route renders a Fresh island, so `globalThis.opener = null` runs only after the document, shared app shell, inline theme script, and hydration bootstrap execute. The external `static/intent-reserved.js` that clears the opener synchronously is never referenced, and no route response installs a CSP. This leaves a same-origin opener capability exposed during the most sensitive navigation window and contradicts the security contract.
**Fix:** Serve a dedicated minimal reservation document/response with the external severing script as its first executable resource and a strict route-specific CSP (`default-src 'none'`, narrowly scoped script/connect/frame directives). Do not wrap it in the shared `_app` shell; test actual response headers and execution order.

### CR-07: Removed handlers never emit an unavailable change event

**File:** `runtime/intent.ts:478-510`
**Issue:** Rebuild notifications iterate only over archetypes present in the new registry. When an archetype is removed by uninstall, account change, or catalog replacement, subscribers receive no `intent.changed` event for that archetype and retain stale `available: true` state indefinitely. Generation revocation protects backend selection but does not correct the public reactive contract.
**Fix:** Diff the previous availability keys against the new registry and emit a canonical frozen `available: false` projection for every removed archetype, including account reset; add uninstall/account-change stream tests.

## Warnings

### WR-01: Endpoint correlation maps are unbounded and survive invalid ordering

**File:** `routes/api/runtime.ts:187-197`, `routes/api/runtime.ts:384-425`
**Issue:** `pendingIntentReservations` and `pendingIntentAcks` have no capacity, expiry, duplicate policy, or cleanup on close. An authenticated same-origin frame can fill them with arbitrary valid messages for the life of the socket, and invocations without a reservation are silently ignored instead of receiving a canonical failure.
**Fix:** Use a bounded expiring correlation registry keyed by both invocation/reservation identity, reject duplicates deterministically, clear it on socket close, and return a canonical denied/failed result for unmatched invocations.

---

_Reviewed: 2026-07-31T05:05:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_

## Resolution

All seven critical findings and the warning were fixed in the Phase 7 review-fix pass. The full quality gate passed: 213 tests, `deno task check`, production build, and the production reconnect/intent smoke coverage.
