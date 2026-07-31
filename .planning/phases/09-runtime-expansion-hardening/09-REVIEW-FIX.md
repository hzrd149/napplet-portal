---
phase: 09-runtime-expansion-hardening
fixed_at: 2026-07-31T09:45:00Z
review_path: .planning/phases/09-runtime-expansion-hardening/09-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 9: Code Review Fix Report

**Fixed at:** 2026-07-31T09:45:00Z
**Source review:** `.planning/phases/09-runtime-expansion-hardening/09-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### CR-01: Sandboxed napplets can bypass the backend proxy boundary over arbitrary WebSockets

**Files modified:** `runtime/security_headers.ts`, `main.ts`, `tests/adversarial_browser_boundary_test.ts`
**Commit:** 8064f29
**Applied fix:** Replaced scheme-wide WebSocket CSP sources with the exact portal WebSocket origin derived per response and added hostile-origin regression coverage.

### CR-02: Relay subscriptions keep sending through the dead pre-reconnect socket

**Files modified:** `routes/api/runtime.ts`, `tests/websocket_session_test.ts`
**Commit:** 1a39ec2
**Applied fix:** Routed relay callbacks through the current connection attachment, registered subscription ownership, and verified resumed delivery plus grace-expiry cleanup.

### WR-01: The host-wide CSP still permits all inline script execution

**Files modified:** `runtime/security_headers.ts`, `tests/adversarial_browser_boundary_test.ts`
**Commit:** 8644f7b
**Applied fix:** Removed `unsafe-inline` from `script-src` and authorized only the byte-stable theme bootstrap with its SHA-256 hash.

---

_Fixed: 2026-07-31T09:45:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
