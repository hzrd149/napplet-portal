---
phase: 03-mobile-shell-resilience
plan: "03"
subsystem: ui
tags: [theme, first-paint, local-storage, accessibility, preact]
requires:
  - phase: 03-mobile-shell-resilience
    provides: persistent account sheet and mobile shell navigation
provides:
  - Validated browser-local System, Light, and Dark theme contract
  - Stable pre-paint document bootstrap and global browser theme-color ownership
  - Accessible account theme controls with live System observation
affects: [03-mobile-shell-resilience, shell-palette, browser-chrome]
tech-stack:
  added: []
  patterns: [closed-enum browser persistence, hashable pre-paint bootstrap, scoped media-query lifecycle]
key-files:
  created: [shell/theme.ts, components/ThemeControls.tsx, tests/theme_test.ts]
  modified: [routes/_app.tsx, components/AccountSheet.tsx, assets/styles.css]
key-decisions:
  - "Theme persistence is browser-local and accepts only system, light, or dark; storage failure safely resolves to System."
  - "One static head script owns first-paint data-theme, color-scheme, and the global theme-color value."
  - "OS preference observation exists only while System is selected and is disposed on preference change or unmount."
patterns-established:
  - "Theme boundary: shell/theme.ts is the sole preference, resolution, persistence, and DOM application contract."
  - "Theme isolation: shell preferences never enter runtime or iframe message paths."
requirements-completed: [SHL-01]
coverage:
  - id: D1
    description: "A validated browser-local preference resolves before body paint and safely defaults to System."
    requirement: SHL-01
    verification:
      - kind: unit
        ref: "tests/theme_test.ts#theme preference validation and resolution are closed and deterministic"
        status: pass
      - kind: unit
        ref: "tests/theme_test.ts#document bootstrap precedes body and owns one stable theme-color"
        status: pass
    human_judgment: false
  - id: D2
    description: "Accessible System, Light, and Dark controls persist immediately and follow OS changes only in System mode."
    requirement: SHL-01
    verification:
      - kind: unit
        ref: "tests/theme_test.ts#theme controller persists choices and observes OS only in System mode"
        status: pass
      - kind: unit
        ref: "tests/theme_test.ts#theme controls are accessible and account-independent"
        status: pass
    human_judgment: false
  - id: D3
    description: "One global browser theme-color follows fixed resolved values without sending theme data across the napplet boundary."
    requirement: SHL-01
    verification:
      - kind: unit
        ref: "tests/theme_test.ts#theme application uses fixed document values and one global meta owner"
        status: pass
    human_judgment: false
duration: 8min
completed: 2026-07-31
status: complete
---

# Phase 3 Plan 3: First-Paint Theme Contract Summary

**A closed browser-local theme contract now applies System, Light, or Dark before first paint, updates browser chrome, and exposes accessible account controls without crossing the napplet boundary.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-31T00:21:00Z
- **Completed:** 2026-07-31T00:29:35Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added guarded theme preference validation, persistence, resolution, and fixed DOM application helpers with System as the safe default.
- Added one stable head bootstrap before body markup so `data-theme`, `color-scheme`, and mobile `theme-color` match on first paint.
- Added three accessible account-level choices with immediate application, browser-local persistence, and a System-only OS preference listener that is cleaned up correctly.

## Task Commits

1. **Task 1 RED: Theme contract tests** - `6473a1a`
2. **Task 1 GREEN: Safe first-paint theme** - `3525715`
3. **Task 2 GREEN: Persistent account theme controls** - `268eb59`

## Files Created/Modified

- `shell/theme.ts` - Closed-enum preference, guarded storage, resolution, DOM application, listener controller, and stable bootstrap.
- `components/ThemeControls.tsx` - Accessible System, Light, and Dark radio control with immediate persistence and live System observation.
- `components/AccountSheet.tsx` - Account-independent theme control placement.
- `routes/_app.tsx` - System-compatible SSR defaults, one global theme-color, and pre-body bootstrap.
- `assets/styles.css` - Discrete segmented-control styling without color interpolation.
- `tests/theme_test.ts` - Focused first-paint, storage, DOM, isolation, controls, and listener lifecycle coverage.

## Decisions Made

- Kept all values closed and predefined so untrusted storage can never become markup or arbitrary CSS.
- Used a static self-contained bootstrap suitable for CSP nonce/hash authorization rather than adding server/browser synchronization or weakening policy.
- Kept theme availability independent of account and signer state by mounting the control unconditionally in the Account sheet.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Deno's `react-no-danger` rule rejects the raw inline-script seam required for pre-paint execution. The route uses a narrowly documented file-level lint exception for the static exported script; no dynamic content enters it.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04 can migrate shell-owned surfaces onto the stable `data-theme` contract without changing persistence or browser lifecycle behavior.
- No blockers remain.

## Self-Check: PASSED

- All six created or modified files exist.
- Commits `6473a1a`, `3525715`, and `268eb59` exist.
- All six focused theme tests and `deno task check` pass.

---
*Phase: 03-mobile-shell-resilience*
*Completed: 2026-07-31*
