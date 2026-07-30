---
phase: 01-one-day-napplet-runtime-mvp
plan: 04
subsystem: ui
tags: [fresh, preact, mobile, iframe, websocket, accessibility]
requires:
  - phase: 01-02
    provides: browser-safe account identity projection
  - phase: 01-03
    provides: verified artifact and reconnectable WebSocket namespaces
provides:
  - Persistent source-bound opaque iframe bridge
  - Approved mobile sign-in, Home, Profile, notice, and navigation shell
  - Safe-area and responsive UI primitives with reduced-motion handling
affects: [01-05, 01-06, mobile-shell, iframe-bridge]
tech-stack:
  added: []
  patterns: [imperative-verified-srcdoc, persistent-hidden-view, browser-safe-projection]
key-files:
  created: [components/HomeView.tsx, components/ProfileView.tsx, tests/iframe_bridge_test.ts, tests/shell_architecture_test.ts]
  modified: [components/NappletFrame.tsx, islands/NappletShell.tsx, routes/index.tsx, routes/_app.tsx, routes/api/runtime.ts, runtime/accounts.ts, runtime/portal_runtime.ts, assets/styles.css]
key-decisions:
  - "Assign iframe srcdoc imperatively only after registering its exact contentWindow with verified dTag/aggregate identity."
  - "Keep Home, Profile, and napplet views mounted and switch them with inert/visibility state so iframe memory and source identity survive navigation."
patterns-established:
  - "The browser island owns only UI, history, postMessage, and WebSocket lifecycle; backend account/runtime authority remains server-side."
  - "Portal navigation occupies an in-flow 64px plus safe-area row below an unconstrained content viewport."
requirements-completed: [MVP-01, MVP-02, MVP-03, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-06, STREAM-05, NAP-01, NAP-02, QUAL-01, QUAL-02]
coverage:
  - id: D1
    description: "Verified iframe identity is registered before srcdoc, the sandbox is exactly allow-scripts, and source/unknown messages fail silently."
    requirement: NAP-01
    verification:
      - kind: unit
        ref: "tests/iframe_bridge_test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The island keeps one iframe mounted across Home/Profile/navigation and contains no backend account, signer, pool, store, or Kehto runtime imports."
    requirement: QUAL-01
    verification:
      - kind: unit
        ref: "tests/shell_architecture_test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The approved mobile sign-in, responsive overflow, safe-area, focus, long-text, and reduced-motion presentation matches the UI contract."
    requirement: MVP-03
    verification:
      - kind: integration
        ref: "deno task build"
        status: pass
    human_judgment: true
    rationale: "Viewport appearance and safe-area behavior require the final Phase 1 browser inspection checkpoint."
duration: 8min
completed: 2026-07-30
status: complete
---

# Phase 01 Plan 04: Mobile Runtime Shell Summary

**A source-bound opaque iframe now persists behind an accessible 100dvh mobile shell with sign-in, Home/Profile navigation, in-flow notices, safe-area layout, and responsive identity states.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-30T13:07:15Z
- **Completed:** 2026-07-30T13:14:47Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Registered verified dTag/aggregate identity against the exact `contentWindow` before assigning verified srcdoc bytes.
- Added one source-bound bridge that silently rejects foreign/unknown messages, initializes shell once, and forwards only IDENTITY/RELAY/OUTBOX domains.
- Replaced the starter screen with sign-in, one-tile/empty Home, active/offline Profile, persistent navigation, retry notices, copy feedback, and sign-out confirmation.
- Added 100dvh fallback, safe-area navigation, 44px controls, exact palette/type scale, long-text containment, focus rings, and reduced-motion behavior.

## Task Commits

1. **Task 1 RED: Persistent iframe bridge contracts** - `f544df8` (test)
2. **Task 1 GREEN: Source-bound persistent bridge** - `019faed` (feat)
3. **Task 2: Approved mobile runtime shell** - `c1497bf` (feat)

## Files Created/Modified

- `components/NappletFrame.tsx` - Exact sandbox, verified identity registration, imperative srcdoc, and pure bridge helpers.
- `islands/NappletShell.tsx` - Persistent iframe, history, socket, sign-in, notices, navigation, and dialog controller.
- `components/HomeView.tsx` - One configured tile or documented configuration-empty state.
- `components/ProfileView.tsx` - Browser-safe active/offline identity and sign-out surface.
- `routes/index.tsx` - Environment-configured SSR shell entry.
- `routes/_app.tsx` - Product metadata and shared page canvas.
- `routes/api/runtime.ts` - Browser-safe public account response and sign-out message.
- `runtime/accounts.ts` / `runtime/portal_runtime.ts` - Tracer-compatible server-side sign-out seam.
- `assets/styles.css` - Mobile shell layout, responsive states, safe areas, focus, and reduced motion.
- `tests/iframe_bridge_test.ts` / `tests/shell_architecture_test.ts` - Security, persistence, authority, structure, and copy contracts.

## Decisions Made

- Kept all production imports on pinned npm packages; sibling sources were reference-only.
- Used imperative iframe assignment because JSX `srcDoc` cannot prove the required identity-before-bytes ordering.
- Kept the iframe mounted even before and between visible napplet views; visibility plus `inert` controls interaction without destroying its window.
- Left final real-signer composition and multi-viewport browser approval to Plan 01-06's explicit end-to-end checkpoint.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added browser-safe identity and sign-out route messages**
- **Found during:** Task 2 (Profile and sign-out integration)
- **Issue:** The tracer WebSocket returned verified napplet identity but no public account projection and exposed no sign-out command, preventing accurate Profile/sign-out state.
- **Fix:** Included only `{pubkey,status}` in the artifact response and added a server-side sign-out message without exposing signer or serialized account data.
- **Files modified:** `routes/api/runtime.ts`, `runtime/accounts.ts`, `runtime/portal_runtime.ts`
- **Verification:** `deno task check`, all 23 tests, and production build pass.
- **Committed in:** `c1497bf`

---

**Total deviations:** 1 auto-fixed (1 missing critical functionality).
**Impact on plan:** The narrow server projection was necessary for correct Profile/sign-out behavior and preserved the browser/server authority boundary.

## Issues Encountered

- Automated checks validate structural responsive backstops and the production bundle; visual inspection at 320/390/768/1440px and safe-area emulation remains intentionally owned by Plan 01-06's blocking final UI checkpoint.

## User Setup Required

None - no new external service configuration required.

## Next Phase Readiness

- The browser bridge is ready for Plan 01-05's IDENTITY/RELAY/OUTBOX runtime delivery.
- Plan 01-06 must compose the real process-wide account runtime and perform the prescribed responsive browser approval.

## Self-Check: PASSED

- All created and modified files exist.
- All three task commits are present.
- `deno task check`, five focused tests, all 23 tests, and `deno task build` pass.

---
*Phase: 01-one-day-napplet-runtime-mvp*
*Completed: 2026-07-30*
