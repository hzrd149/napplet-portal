---
phase: 09-runtime-expansion-hardening
reviewed: 2026-07-31T09:15:00Z
depth: deep
files_reviewed: 71
files_reviewed_list:
  - .gitignore
  - README.md
  - assets/styles.css
  - components/AccountSheet.tsx
  - components/MediaControls.tsx
  - components/NappletFrame.tsx
  - deno.json
  - islands/IntentReservation.tsx
  - islands/NappletShell.tsx
  - main.ts
  - playwright.config.ts
  - routes/_app.tsx
  - routes/api/runtime.ts
  - routes/intent/reserved.tsx
  - runtime/accounts.ts
  - runtime/binary_transport.ts
  - runtime/catalog.ts
  - runtime/common.ts
  - runtime/connections.ts
  - runtime/event_runtime.ts
  - runtime/intent.ts
  - runtime/media_contract.ts
  - runtime/media_reducer.ts
  - runtime/media_sessions.ts
  - runtime/nap_contract_registry.ts
  - runtime/nap_dispatcher.ts
  - runtime/outbox.ts
  - runtime/pinned_fetch.ts
  - runtime/portal_runtime.ts
  - runtime/resource_service.ts
  - runtime/security_headers.ts
  - runtime/signer_service.ts
  - runtime/storage.ts
  - runtime/storage_store.ts
  - runtime/transport.ts
  - shell/connection.ts
  - static/intent-reserved.js
  - tests/adversarial_authority_test.ts
  - tests/adversarial_browser_boundary_test.ts
  - tests/adversarial_browser_lifecycle_test.ts
  - tests/adversarial_state_isolation_test.ts
  - tests/adversarial_transport_transfer_test.ts
  - tests/browser/portal_acceptance_test.ts
  - tests/catalog_runtime_test.ts
  - tests/catalog_test.ts
  - tests/common_runtime_integration_test.ts
  - tests/common_storage_runtime_test.ts
  - tests/common_test.ts
  - tests/contract_parity_test.ts
  - tests/fixtures/v1_1_contract_matrix.json
  - tests/intent_contract_test.ts
  - tests/intent_navigation_test.tsx
  - tests/intent_production_test.ts
  - tests/intent_registry_test.ts
  - tests/intent_runtime_test.ts
  - tests/lifecycle_matrix_test.ts
  - tests/media_contract_test.ts
  - tests/media_lifecycle_test.ts
  - tests/media_reducer_test.ts
  - tests/media_sessions_test.ts
  - tests/media_shell_test.tsx
  - tests/media_transport_smoke_test.ts
  - tests/media_transport_test.ts
  - tests/napplet_frame_test.tsx
  - tests/pinned_fetch_test.ts
  - tests/production_multiclient_smoke_test.ts
  - tests/requirement_traceability_test.ts
  - tests/runtime_reconnect_smoke_test.ts
  - tests/runtime_transport_test.ts
  - tests/storage_test.ts
  - tests/websocket_session_test.ts
findings:
  critical: 2
  warning: 1
  info: 0
  total: 3
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-07-31T09:15:00Z
**Depth:** deep
**Files Reviewed:** 71
**Status:** issues_found

## Summary

The Phase 9 runtime, browser boundary, lifecycle, contract, and release-evidence changes were reviewed across `db5f6df..HEAD`. Two security/correctness defects block shipment: the global CSP permits a sandboxed napplet to bypass the backend proxy boundary through arbitrary WebSockets, and relay stream callbacks remain bound to a closed socket across reconnects. The evidence ledger consistently leaves QLT-04 incomplete and labels its browser/device observations as accepted residual risk; no false QLT-04 pass was found.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Sandboxed napplets can bypass the backend proxy boundary over arbitrary WebSockets

**File:** `runtime/security_headers.ts:12`
**Issue:** The global policy uses `connect-src 'self' ws: wss:`. Scheme sources authorize every `ws://` and `wss://` host, not merely the portal host. Because `srcdoc` documents inherit the embedding document's CSP, an untrusted `sandbox="allow-scripts"` napplet can open a WebSocket directly to an attacker-controlled server (which can accept the iframe's opaque `Origin: null`) and exfiltrate data or implement networking outside the explicit NAP proxy/message boundary. This contradicts the project's central sandboxing and backend-state-ownership constraints.
**Fix:** Restrict the policy to the portal origin. In browsers where `'self'` does not cover the required WebSocket URL consistently, generate an explicit `ws://<portal-host>` or `wss://<portal-host>` source per response rather than using scheme-wide sources. Add a browser boundary test that attempts an attacker-origin WebSocket from the sandbox and proves CSP blocks it.

### CR-02: Relay subscriptions keep sending through the dead pre-reconnect socket

**File:** `routes/api/runtime.ts:653-669`
**Issue:** The relay listener closes over the attachment-local `socket` and calls `socket.send(...)` directly. A reconnect reuses the existing session and bridge, while the relay subscription survives; its callback therefore continues targeting the closed old socket. Subsequent live relay events either disappear or throw from the callback instead of reaching the resumed connection. The returned subscription handle is also discarded, so `runtime/connections.ts` cannot track and close it when the window expires. This breaks the stream-oriented reconnect seam and can leak subscriptions.
**Fix:** Deliver relay messages through `connections.send(connection.connectionId, ...)`, which always targets the current attachment and handles send failure. Have `portal_runtime.ts` register the returned relay handle with its `ConnectionRegistry.trackSubscription(connectionId, windowId, subId, handle)` (or return it to the route and explicitly manage replacement/expiry). Add a test that subscribes, disconnects, reconnects with the token, emits a live event without resubscribing, and asserts delivery occurs exactly once on the new socket and the handle is released on grace expiry.

## Warnings

### WR-01: The host-wide CSP still permits all inline script execution

**File:** `runtime/security_headers.ts:8`
**Issue:** `script-src 'self' 'unsafe-inline'` removes most of CSP's protection against a future host-page HTML injection. Applying this policy globally means every route accepts arbitrary inline JavaScript even though the intent reservation bootstrap has already moved to a same-origin external file. This materially weakens the hostile-browser boundary.
**Fix:** Remove `'unsafe-inline'` from host pages and use nonces or hashes for any unavoidable inline host bootstrap. If verified napplet artifacts genuinely require inline scripts, apply a narrowly scoped artifact/iframe policy rather than weakening every portal response, and add assertions for both host and iframe policies.

---

_Reviewed: 2026-07-31T09:15:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
