---
phase: 03-mobile-shell-resilience
plan: "02"
subsystem: ui
tags: [mobile-shell, account, identity, iframe, safe-area]
requires:
  - phase: 03-mobile-shell-resilience
    provides: connection controller and truthful backend status projection
provides:
  - Stable Home, Status, and Account navigation around one mounted napplet frame
  - Responsive identity header and account state sheet
  - Canonical verified-frame empty-pubkey sign-out delivery
affects: [03-mobile-shell-resilience, shell-navigation, identity-boundary]
tech-stack:
  added: []
  patterns: [hidden persistent shell views, verified source-bound identity publisher, independent signer and transport projections]
key-files:
  created: [components/HomeHeader.tsx, components/AccountSheet.tsx]
  modified: [components/NappletFrame.tsx, islands/NappletShell.tsx, routes/api/runtime.ts, assets/styles.css, tests/shell_resilience_test.tsx, tests/identity_service_test.ts, tests/end_to_end_test.ts]
key-decisions:
  - "Account navigation is a shell-owned sheet; it never replaces or unmounts the verified napplet frame."
  - "Sign-out revokes backend authority before one canonical identity.changed empty-pubkey envelope crosses the verified frame boundary."
  - "Signer availability and backend transport connectivity remain independently labeled in account chrome."
patterns-established:
  - "Persistent frame navigation: shell views use hidden/inert presentation around one NappletFrame instance."
  - "Identity delivery: accept only the active connection/window envelope and current registered iframe source."
requirements-completed: [SHL-03]
coverage:
  - id: D1
    description: "Home, Status, and Account remain safe-area-aware stable targets while one iframe stays mounted."
    requirement: SHL-03
    verification:
      - kind: unit
        ref: "tests/shell_resilience_test.tsx#shell reserves safe navigation and keeps one frame across views"
        status: pass
    human_judgment: false
  - id: D2
    description: "Account chrome distinguishes signed-out, signer-offline, signed-in, and backend-disconnected truth."
    requirement: SHL-03
    verification:
      - kind: unit
        ref: "tests/shell_resilience_test.tsx#account sheet distinguishes identity signer and backend state"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sign-out preserves public frame continuity while delivering one canonical verified identity transition and revoking protected authority."
    requirement: SHL-03
    verification:
      - kind: integration
        ref: "tests/identity_service_test.ts#sign-out identity delivery is exact once and verified-source bound"
        status: pass
      - kind: e2e
        ref: "tests/end_to_end_test.ts#runtime sign-out emits only the canonical identity transition"
        status: pass
    human_judgment: false
duration: 10min
completed: 2026-07-31
status: complete
---

# Phase 3 Plan 2: Persistent Mobile Shell and Canonical Sign-Out Summary

**A safe-area-aware three-target mobile shell now keeps the verified napplet mounted while account state and canonical sign-out remain truthful across signer and transport changes.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-31T00:20:00Z
- **Completed:** 2026-07-31T00:30:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added responsive identity-first Home chrome and an Account sheet covering signed-out, active, signer-offline, and backend-disconnected combinations.
- Preserved one sandboxed verified iframe across Home, Status, Account, and sign-out interactions with compact safe-area navigation for short and landscape viewports.
- Replaced the portal-only sign-out envelope with one pinned `identity.changed` empty-pubkey transition after backend revocation, while public relay reads remain available.

## Task Commits

1. **Task 1 RED: Shell navigation and account projection tests** - `7106e75`
2. **Task 1 GREEN: Persistent account navigation** - `a5cd2f9`
3. **Task 2 GREEN: Canonical verified sign-out identity** - `aeccfd7`

## Files Created/Modified

- `components/HomeHeader.tsx` - Responsive identity target with non-color signer state and wide pubkey disclosure.
- `components/AccountSheet.tsx` - Account, signer, and backend state matrix with contextual actions.
- `components/NappletFrame.tsx` - Verified current-source identity publisher.
- `islands/NappletShell.tsx` - Persistent navigation, account sheet, immediate sign-out, and canonical identity forwarding.
- `routes/api/runtime.ts` - Backend-first sign-out with canonical runtime event envelope.
- `assets/styles.css` - Opaque ink/bone/amber chrome, safe-area row, and compact viewport rules.
- `tests/shell_resilience_test.tsx`, `tests/identity_service_test.ts`, `tests/end_to_end_test.ts` - Responsive, trust-boundary, continuity, and exact-envelope coverage.

## Decisions Made

- The Account target opens a sheet so account inspection does not become a competing full-page frame lifecycle.
- Runtime events must match the active connection and window before identity can reach the registered iframe source.
- The napplet remains visible after sign-out because backend capability authority, rather than frame presence, controls protected operations.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- A legacy architecture assertion still required the approved public-data continuity copy; the copy was retained as accessible sign-out/offline context.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Persistent shell navigation and truthful account projections are ready for the remaining Phase 3 presentation and resilience plans.
- No blockers remain.

## Self-Check: PASSED

- All created files exist.
- Commits `7106e75`, `a5cd2f9`, and `aeccfd7` exist.
- The required 30-test verification and `deno task check` pass.

---
*Phase: 03-mobile-shell-resilience*
*Completed: 2026-07-31*
