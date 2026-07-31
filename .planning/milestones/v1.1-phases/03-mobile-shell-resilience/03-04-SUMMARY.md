---
phase: 03-mobile-shell-resilience
plan: "04"
subsystem: ui
tags: [css-custom-properties, accessibility, contrast, fresh, preact]
requires:
  - phase: 03-mobile-shell-resilience
    provides: first-paint data-theme and global browser theme-color contract
provides:
  - Accessible ink, bone, and electric-amber semantic token sets for light and dark themes
  - Tokenized reusable, runtime, profile, sign-in, and settings shell surfaces
  - Automated surface inventory, contrast matrix, non-color semantics, and metadata ownership checks
affects: [03-mobile-shell-resilience, shell-branding, mobile-uat]
tech-stack:
  added: []
  patterns: [closed semantic color vocabulary, CSS-only resolved-theme consumption, automated contrast inventory]
key-files:
  created: [tests/shell_theme_surface_test.tsx]
  modified: [assets/styles.css, routes/index.tsx, routes/signin.tsx, routes/settings.tsx, tests/settings_route_test.tsx]
key-decisions:
  - "Resolve every shell color through one closed semantic token vocabulary under html[data-theme], without adding component theme state."
  - "Keep connection and signer meaning in text and geometry while color remains supplementary."
  - "Leave routes/_app.tsx as the sole owner of browser theme-color metadata."
patterns-established:
  - "Theme consumption: shell-owned CSS consumes semantic variables and never observes or persists theme state itself."
  - "Accessibility gate: normal text pairings meet 4.5:1 and strong border/accent UI pairings meet 3:1 in both themes."
requirements-completed: [SHL-01]
coverage:
  - id: D1
    description: "Reusable home and account surfaces share accessible ink, bone, and electric-amber themes."
    requirement: SHL-01
    verification:
      - kind: unit
        ref: "tests/shell_theme_surface_test.tsx#reusable home and account surfaces consume semantic tokens"
        status: pass
      - kind: unit
        ref: "tests/shell_theme_surface_test.tsx#ink bone and electric amber tokens meet shell contrast thresholds"
        status: pass
    human_judgment: false
  - id: D2
    description: "Napplet chrome and profile states change theme without remounting the frame or losing non-color status meaning."
    requirement: SHL-01
    verification:
      - kind: unit
        ref: "tests/shell_theme_surface_test.tsx#napplet chrome and profile presentation share shell tokens"
        status: pass
      - kind: unit
        ref: "tests/shell_resilience_test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "Home, sign-in, and settings routes consume the global theme contract without competing browser metadata."
    requirement: SHL-01
    verification:
      - kind: unit
        ref: "tests/shell_theme_surface_test.tsx#server-rendered routes consume tokens without theme-color conflicts"
        status: pass
      - kind: unit
        ref: "tests/settings_route_test.tsx"
        status: pass
      - kind: other
        ref: "deno task check"
        status: pass
    human_judgment: false
duration: 6min
completed: 2026-07-31
status: complete
---

# Phase 3 Plan 4: Shell Theme Surface Migration Summary

**One accessible semantic ink, bone, and electric-amber palette now themes every shell-owned route and runtime state while the verified napplet frame and global browser theme owner remain stable.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-31T00:31:00Z
- **Completed:** 2026-07-31T00:37:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Defined closed light and dark semantic tokens with automated WCAG contrast checks for normal text, borders, focus, and accent controls.
- Migrated home, account, catalog, connection, profile, navigation, notice, sign-in, and settings presentation without adding another theme state or remount path.
- Removed fixed route-level theme-color metadata so the pre-paint application wrapper remains the single browser-chrome authority.

## Task Commits

1. **Task 1 RED: Reusable shell surface tests** - `a4c1963`
2. **Task 1 GREEN: Reusable shell theme tokens** - `5e7f046`
3. **Task 2 RED: Runtime shell theme tests** - `419e04b`
4. **Task 2 GREEN: Runtime chrome and profile themes** - `3474e06`
5. **Task 3 RED: Server-rendered route theme tests** - `ae52a33`
6. **Task 3 GREEN: Server-rendered route themes** - `9b604f4`

## Files Created/Modified

- `assets/styles.css` - Closed light/dark semantic token sets and tokenized shell surface states.
- `routes/index.tsx` - Removed duplicate fixed theme-color metadata.
- `routes/signin.tsx` - Removed duplicate fixed theme-color metadata.
- `routes/settings.tsx` - Removed duplicate fixed theme-color metadata.
- `tests/shell_theme_surface_test.tsx` - Surface inventory, contrast, iframe continuity, state semantics, and metadata ownership coverage.
- `tests/settings_route_test.tsx` - Explicit accessible success and error state semantics.

## Decisions Made

- Used CSS variables beneath the proven `html[data-theme]` boundary, keeping preference and DOM application exclusively in `shell/theme.ts`.
- Preserved explicit text, underline, node/link geometry, and stroke patterns so signer and connection states never depend on color alone.
- Kept all color changes discrete; existing view opacity transitions remain, but color, background, and border values are not interpolated.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The surface inventory helper initially inspected only the first combined CSS selector block. It was corrected to inspect every declaration block for each surface before the final green commit.

## Known Stubs

None.

## Threat Flags

None - the migration adds no network, authentication, file-access, schema, or trust-boundary surface.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 05 can replace the remaining starter brand assets against the same semantic palette and stable global shell metadata.
- Focused tests, the full Deno quality gate, and a production Fresh build pass; no blockers remain.

## Self-Check: PASSED

- All six created or modified files exist.
- Commits `a4c1963`, `5e7f046`, `419e04b`, `3474e06`, `ae52a33`, and `9b604f4` exist.
- All 19 focused tests, `deno task check`, and the production build pass.

---
*Phase: 03-mobile-shell-resilience*
*Completed: 2026-07-31*
