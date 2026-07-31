---
phase: 09-runtime-expansion-hardening
plan: "08"
subsystem: testing
tags: [playwright, chromium, accessibility, responsive, lifecycle, browser]
requires:
  - phase: 09-runtime-expansion-hardening
    plan: "07"
    provides: deterministic lifecycle and production multi-client transport seams
provides:
  - exact user-authorized Playwright 1.62.1 pin and local Chromium harness
  - passing real-browser viewport, focus, theme, history, reconnect, and intent-popup acceptance
  - two-page media acceptance implementation with one explicit fixture-resolution gap
affects: [09-09, QLT-04, browser-acceptance]
tech-stack:
  added: ["@playwright/test@1.62.1"]
  patterns: [
    isolated loopback built-server browser tests,
    explicit physical-device evidence boundary,
  ]
key-files:
  created: [playwright.config.ts, tests/browser/portal_acceptance_test.ts]
  modified: [
    deno.json,
    deno.lock,
    main.ts,
    runtime/security_headers.ts,
    shell/connection.ts,
    components/AccountSheet.tsx,
    assets/styles.css,
    routes/intent/reserved.tsx,
  ]
key-decisions:
  - "Accept the USER-AUTHORIZED residual SUS risk for exactly @playwright/test 1.62.1 and retain its SHA-512 lock evidence."
  - "Label every result automated local Chromium evidence; physical iOS and Android remain NOT RUN."
  - "Do not mark QLT-04 complete while the two-page media browser row is blocked on historical artifact resolution."
patterns-established:
  - "Browser acceptance fails on console errors, page errors, overflow, inaccessible roles, and lifecycle mismatches."
requirements-completed: []
coverage:
  - id: D1
    description: "Phone portrait/landscape, focus, theme, reduced-motion, history, reconnect/visibility, and intent popup acceptance runs in local Chromium."
    requirement: QLT-04
    verification:
      - kind: automated_ui
        ref: "deno run -A npm:@playwright/test@1.62.1 test tests/browser/portal_acceptance_test.ts --grep-invert 'two browser pages'"
        status: pass
    human_judgment: false
  - id: D2
    description: "Two browser pages prove media revoke-before-grant through the production runtime."
    requirement: QLT-04
    verification:
      - kind: automated_ui
        ref: "tests/browser/portal_acceptance_test.ts#two browser pages revoke the prior media owner before granting transfer"
        status: fail
    human_judgment: true
    rationale: "Production runtime.start returns sanitized runtime.signer.error because the historical verified artifact resolves as blob-unavailable in this browser harness."
duration: 92min
completed: 2026-07-31
status: gaps_found
---

# Phase 09 Plan 08: Real Chromium Browser Acceptance Summary

**Exact Playwright 1.62.1 drives local Chromium through four passing browser
acceptance rows, with the two-page media row implemented but blocked at
production artifact resolution.**

## Performance

- **Duration:** 92 min
- **Started:** 2026-07-31T06:00:00Z
- **Completed:** 2026-07-31T07:32:00Z
- **Tasks:** 1 complete, 1 gaps found
- **Files modified:** 11

## Accomplishments

- Pinned only `npm:@playwright/test@1.62.1`; `deno.lock` records exact 1.62.1
  entries and SHA-512 integrity for Playwright packages.
- Passed real local Chromium coverage for phone portrait/landscape overflow,
  accessible navigation/dialog/focus return, system/light/dark themes, reduced
  motion, Back/Forward, offline/online/visibility state, popup capture, fragment
  erasure, opener severing, and popup close.
- Implemented a real two-page WebSocket media ownership row using production
  sign-in, runtime ownership, generation, and transfer messages.
- Passed `deno task check` and `deno task build`.

## Task Commits

1. **Task 1 RED: failing phone browser tracer** - `f24ce44`
2. **Task 1 GREEN: exact pin and local Chromium tracer** - `36642af`
3. **Task 2 RED: failing browser acceptance matrix** - `ac4ba03`
4. **Task 2 implementation and bounded gap evidence** - `862903f`

## Files Created/Modified

- `playwright.config.ts` - Local `/snap/bin/chromium` runner and isolated
  built-server port.
- `tests/browser/portal_acceptance_test.ts` - Five-row integrated Chromium
  acceptance suite.
- `deno.json`, `deno.lock` - Exact user-authorized Playwright pin and integrity
  evidence.
- `runtime/security_headers.ts`, `main.ts` - Same-origin-only settings framing
  while external ancestors remain denied.
- `shell/connection.ts` - Browser-safe timer cancellation wrapper.
- `components/AccountSheet.tsx`, `assets/styles.css` - Modal layering and
  invoker focus restoration.
- `routes/intent/reserved.tsx` - Deferred popup script and explicit favicon.

## Gaps Found

| Gap                                                    | Evidence                                                                                                                                                                                                                                                           | Required closure                                                                                                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two-page media browser row cannot reach media creation | Sequential production `runtime.start` emits sanitized `runtime.signer.error`; server evidence identifies verified artifact resolution as `blob-unavailable`. Existing Deno production multi-client media smoke passes, but this does not replace browser evidence. | Provide a deterministic exact verified artifact to the browser server through the existing production Blossom boundary, then run the complete five-test suite. |

### Bounded follow-up (2026-07-31)

- Confirmed and fixed a production `pinnedFetch` deadlock: it awaited
  `Agent.close()` before returning an unread response body. Commit `89c04d7`
  defers cleanup until body completion/cancellation; the new focused regression
  and artifact-resolver suite pass, as does `deno task check`.
- Added an uncommitted Playwright-managed loopback Blossom trial containing the
  exact 531,120-byte artifact, verified against manifest SHA-256 before serving.
  Direct `BlossomCache.fetch` and `resolveVerifiedArtifact` probes pass without
  external Blossom after the fix.
- The rebuilt Playwright media row nevertheless still receives sanitized
  `runtime.signer.error` / `blob-unavailable`. Therefore WINDOW 21 remains open
  and QLT-04 is not reconciled; no browser pass is claimed.

Physical iOS Safari and Android Chrome remain **NOT RUN — automated local
Chromium is not physical-device evidence**.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 - Bug] Fixed settings iframe CSP violation** — the global
   `frame-ancestors 'none'` and `X-Frame-Options: DENY` blocked the portal's own
   settings frame. `/settings` now permits only same-origin framing.
2. **[Rule 1 - Bug] Fixed browser timer illegal invocation** — a bare
   `clearTimeout` reference was invoked as an object method after WebSocket
   connection.
3. **[Rule 1 - Bug] Restored dialog usability** — the startup ritual covered
   account sheets and closing a sheet lost invoker focus.
4. **[Rule 1 - Bug] Fixed reserved-popup initialization** — the head script ran
   before its status node existed; it now defers and has an explicit favicon.

## Issues Encountered

- Deno's 24-hour minimum dependency age policy initially blocked newly published
  1.62.1. The user-authorized exact pin was added with the age override applied
  only to that command; project policy was not weakened.
- Context7 was unavailable and the documented CLI fallback was not installed;
  installed version declarations and actual runner behavior were used.

## User Setup Required

None.

## Threat Flags

| Flag                                | File                        | Description                                                                                         |
| ----------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------- |
| threat_flag: frame-policy-exception | runtime/security_headers.ts | `/settings` is frameable only by the exact same origin; all other routes retain deny-all ancestors. |

## Self-Check: PASSED

- Created files exist.
- Commits `f24ce44`, `36642af`, `ac4ba03`, and `862903f` exist.
- Four non-media Chromium tests, full check, and build pass.
- Media browser failure is explicitly recorded and QLT-04 remains incomplete.

## Next Phase Readiness

Plan 09-09 must not reconcile QLT-04 until the bounded media browser
artifact-fixture gap is closed and the complete five-test Chromium suite passes.
