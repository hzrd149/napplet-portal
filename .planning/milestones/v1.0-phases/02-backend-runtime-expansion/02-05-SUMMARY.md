---
phase: 02-backend-runtime-expansion
plan: "05"
subsystem: settings-ui
tags: [fresh, preact, backend-settings, relay-policy, accessibility]
requires:
  - phase: 02-backend-runtime-expansion
    plan: "02"
    provides: canonical relay policy, blocked precedence, and per-relay AUTH
provides:
  - Backend-persisted Fresh runtime settings route with atomic canonical saves
  - Accessible relay, AUTH, Blossom, validation, and independent cache-health presentation
  - Profile-to-settings browser history flow that preserves the mounted napplet frame
affects: [02-06-runtime-integration, operator-settings, cache-health]
tech-stack:
  added: []
  patterns: [server-rendered Fresh form, additive versioned settings snapshot, in-shell persistent iframe navigation]
key-files:
  created: [routes/settings.tsx, islands/SettingsSaveButton.tsx, tests/settings_route_test.tsx]
  modified: [runtime/settings.ts, runtime/settings_store.ts, main.ts, utils.ts, components/ProfileView.tsx, islands/NappletShell.tsx, assets/styles.css, tests/shell_architecture_test.ts]
key-decisions:
  - "New routing-policy fields extend the version-1 settings snapshot additively so existing persisted snapshots and callers remain valid."
  - "The shell loads the server-rendered settings route in a dedicated settings view so browser history can return to Profile without remounting the napplet frame."
  - "Local relay and Blossom health project independently and never gate rendering, saving, or napplet use."
requirements-completed: [V2-03, V2-06]
coverage:
  - id: D1
    description: "Runtime settings immediately renders the canonical backend snapshot and atomically saves canonical relay, AUTH, cache, and Blossom values."
    requirement: V2-03
    verification:
      - kind: integration
        ref: "tests/settings_route_test.tsx#runtime settings renders the immediate canonical snapshot and independent health; settings form canonicalizes valid values atomically"
        status: pass
    human_judgment: false
  - id: D2
    description: "Invalid values are retained with field-associated errors and exact summary copy while active settings remain unchanged."
    requirement: V2-03
    verification:
      - kind: unit
        ref: "tests/settings_route_test.tsx#invalid settings retain every submitted value with field errors; settings uses exact success and validation summaries"
        status: pass
    human_judgment: false
  - id: D3
    description: "Canonical AUTH rows enforce blocked precedence, explicit opt-in, and the empty state."
    requirement: V2-06
    verification:
      - kind: integration
        ref: "tests/settings_route_test.tsx#blocked AUTH rows override selection and empty state is explicit"
        status: pass
    human_judgment: false
  - id: D4
    description: "At 320px URL fields contain overflow, AUTH URLs truncate accessibly, and controls remain at least 44px."
    requirement: V2-03
    verification:
      - kind: manual_procedural
        ref: "Open /settings at a 320px viewport and inspect URL fields, AUTH rows, and controls"
        status: unknown
    human_judgment: true
    rationale: "Responsive overflow and target sizing require browser layout evidence."
duration: 4min
completed: 2026-07-30
status: complete
---

# Phase 2 Plan 5: Backend-Owned Runtime Settings Summary

**A mobile-first Fresh settings route now persists canonical routing, AUTH, local-cache, and Blossom policy atomically while keeping cache health non-blocking and the napplet iframe mounted.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-30T20:39:42Z
- **Completed:** 2026-07-30T20:43:59Z
- **Tasks:** 1 TDD tracer task
- **Files modified:** 12

## Accomplishments

- Added server-rendered GET/POST `/settings` with immediate backend snapshots, canonical URL validation, atomic persistence, retained invalid submissions, exact status copy, and field-associated errors.
- Added relay routing, explicit NIP-42 AUTH, blocked override, Blossom server, and independent local-cache health presentation with accessible native controls.
- Added Profile navigation through browser history while retaining the existing two-destination bottom navigation and persistent napplet mount.
- Passed 82 repository tests plus formatting, lint, and TypeScript checks.

## Task Commits

1. **RED: Define runtime settings route, policy, and shell behavior** - `b865f62` (test)
2. **GREEN: Implement backend-owned runtime settings UI** - `02f42bd` (feat)
3. **Rule 2: Wire independent production cache-health snapshots** - `bba0b89` (fix)

## Files Created/Modified

- `routes/settings.tsx` - Fresh GET/POST route, parser, validation, server-rendered form, AUTH rows, and health summary.
- `islands/SettingsSaveButton.tsx` - Submit-only `Saving…` affordance.
- `runtime/settings.ts` - Fully resolved routing-policy settings and backward-compatible save inputs.
- `runtime/settings_store.ts` - Additive version-1 snapshot fields with strict parsing.
- `main.ts`, `utils.ts` - Process settings service and browser-safe independent cache-health request state.
- `components/ProfileView.tsx`, `islands/NappletShell.tsx` - Profile action and history-backed settings view with persistent napplet mount.
- `assets/styles.css` - 40rem mobile-first form layout, status colors, internal overflow, and 44px controls.
- `tests/settings_route_test.tsx`, `tests/shell_architecture_test.ts` - Route behavior and persistent-shell architecture coverage.

## Decisions Made

- Kept the existing snapshot version and made the new fields optional on read, then normalized them into a complete runtime value; this avoids invalidating Phase 02-01 persisted state.
- Used the Fresh route itself as the authority for form rendering and submission, with only the submit-state affordance hydrated in the browser.
- Preserved the napplet by keeping settings navigation inside the shell and presenting the server route in a dedicated settings frame.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Wired production cache-health state**
- **Found during:** Post-GREEN stub and threat-surface scan
- **Issue:** Route tests covered healthy, degraded, and checking states, but the initial composition root always supplied checking values.
- **Fix:** Added non-blocking loopback Blossom discovery and reactive local-relay configuration projection so the two health rows resolve independently in production.
- **Files modified:** `main.ts`
- **Verification:** Focused route/shell suite and `deno task check`
- **Commit:** `bba0b89`

**Total deviations:** 1 auto-fixed missing critical behavior. **Impact:** Production now matches the independently updating health contract without delaying settings rendering.

## Issues Encountered

None.

## Authentication Gates

None.

## User Setup Required

None - the optional local relay and Blossom endpoints remain editable and absence does not block use.

## Next Phase Readiness

- Plan 02-06 can consume the expanded reactive settings snapshot for live runtime operations.
- Browser UAT remains appropriate for the 320px overflow and target-size backstops.

## Self-Check: PASSED

- Created route, island, and test artifacts exist.
- Commits `b865f62`, `02f42bd`, and `bba0b89` exist.
- Focused 16-test tracer verification, `deno task check`, and the full 82-test suite pass.

---
*Phase: 02-backend-runtime-expansion*
*Completed: 2026-07-30*
