---
phase: 03-mobile-shell-resilience
verified: 2026-07-31T00:55:00Z
status: passed
score: 16/16 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Exercise cold launch, disconnect/reconnect, offline/online, background/foreground, Home, Status, and Account on a supported narrow mobile browser with ordinary and reduced motion."
    expected: "Connection truth remains understandable, controls remain reachable above safe areas, the iframe is not obscured, and reduced motion preserves the same state meaning without continuous animation."
    why_human: "DOM, controller, and CSS tests prove structure and state transitions but cannot establish actual mobile viewport composition, animation feel, or user comprehension."
  - test: "Inspect the portal mark in browser chrome and the ready ritual in both light and dark themes at phone and favicon scale."
    expected: "The constellation-gate mark is recognizable, visually coherent, and distinct from Fresh starter branding in both themes."
    why_human: "Geometry and metadata are mechanically linked, but recognizability and visual coherence are perceptual judgments."
---

# Phase 3: Mobile Shell Resilience Verification Report

**Phase Goal:** Users can understand and recover the mobile shell's backend connection while using coherent portal navigation and branding.
**Verified:** 2026-07-31T00:55:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

The four ROADMAP success criteria are included in the plan truths below; PLAN wording adds the testable detail without reducing roadmap scope.

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Cold launch projects pending, connected, bootstrapping, and ready; reconnect uses the abbreviated fracture/rebuild grammar. | ✓ VERIFIED | `ConnectionController` advances only on shaped runtime messages; `shell_resilience_test.tsx` exercises every truth state and cold/reconnect distinction. |
| 2 | One serialized controller owns at most one socket and timer, retains the opaque token, and resumes the backend grace namespace. | ✓ VERIFIED | Generation/current-socket guards in `shell/connection.ts`; controller and WebSocket tests pass; built-server smoke resumes the same connection/window identifiers. |
| 3 | Hidden and offline tabs cancel retry work without losing continuity and resume one guarded attempt when eligible. | ✓ VERIFIED | Lifecycle branches and event wiring in `shell/connection.ts` / `NappletShell.tsx`; named fake-clock test passes. |
| 4 | Repeated failure exposes Retry with quiet recovery; intentional closure cannot reopen the socket. | ✓ VERIFIED | Failure threshold, low-frequency retry, and stop generation guards are exercised by two named controller tests. |
| 5 | Bottom connection target and sheet expose accessible plain-language truth without operational secrets or color-only meaning. | ✓ VERIFIED | `ConnectionSheet.tsx` renders one projected sentence and contextual action; presentation tests cover disclosure exclusions, accessible names, roles, and SVG geometry. |
| 6 | Open napplet navigation has stable Home, connection, and Account targets in a safe-area-aware row that does not overlay iframe content. | ✓ VERIFIED | `NappletShell.tsx` renders the ordered controls outside the content row; shell resilience and architecture tests assert target order, sizing, grid rows, and safe-area CSS. |
| 7 | Home and Account can open while the same verified napplet iframe remains mounted. | ✓ VERIFIED | One unconditional `NappletFrame` instance receives `hidden`/`inert`; navigation/frame-continuity tests pass. |
| 8 | Account chrome distinguishes identity, signer availability, and backend transport state. | ✓ VERIFIED | Separate `profile.status`, `profile.signerStatus`, and connection projections feed `HomeHeader`/`AccountSheet`; state-matrix test passes. |
| 9 | Sign-out keeps the frame, emits exactly one canonical empty-pubkey `identity.changed`, and preserves canonical denial/public continuity. | ✓ VERIFIED | Backend-first sign-out and verified-frame publisher are covered by identity integration and end-to-end tests. |
| 10 | System is default; System, Light, and Dark persist per browser and apply immediately independent of account. | ✓ VERIFIED | Closed preference enum/controller in `shell/theme.ts`; validation, persistence, and account-independent control tests pass. |
| 11 | Theme resolves before body paint, follows OS changes in System mode, and safely handles unavailable storage. | ✓ VERIFIED | Static head bootstrap precedes body; theme tests exercise storage failures and media-query listener cleanup. |
| 12 | One global theme-color follows resolved theme and no theme preference crosses the napplet boundary. | ✓ VERIFIED | `_app.tsx` owns one meta tag; theme helpers update it; isolation/source tests find no runtime or frame theme message. |
| 13 | All shell-owned routes, chrome, focus, errors, and runtime states consume the same active theme without metadata conflicts. | ✓ VERIFIED | Semantic CSS variables under `html[data-theme]`; route/surface inventory and metadata ownership tests pass. |
| 14 | Shell surfaces use accessible ink/bone/amber tokens with non-color state and focus semantics. | ✓ VERIFIED | Automated contrast matrix meets declared thresholds; source and render tests assert text/geometry/focus semantics. |
| 15 | Fresh branding is replaced by one constellation-gate geometry shared by ready state, portal identity, static logo, and favicon. | ✓ VERIFIED | `PortalMark` is imported by `ConnectionConstellation`; stable geometry IDs match `static/logo.svg`; `_app.tsx` references only `/logo.svg`. |
| 16 | The mark is scalable and palette-compatible in both themes. | ✓ VERIFIED | SVG viewBox/current-color structure and light/dark palette compatibility pass `portal_brand_test.tsx`; perceptual recognition remains human check #2. |

**Score:** 16/16 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `shell/connection.ts` | Serialized connection controller and retry policy | ✓ VERIFIED | 316 substantive lines; imported and instantiated by `NappletShell`; six behavioral tests pass. |
| `ConnectionConstellation.tsx` / `ConnectionSheet.tsx` | Semantic connection presentation | ✓ VERIFIED | Substantive components imported and rendered by shell; state/copy/accessibility tests pass. |
| `HomeHeader.tsx` / `AccountSheet.tsx` | Identity-first navigation/account chrome | ✓ VERIFIED | Imported and rendered by shell with live profile/connection props and working actions. |
| `shell/theme.ts` / `ThemeControls.tsx` | Browser-local first-paint and interactive theme contract | ✓ VERIFIED | Helper is wired to `_app.tsx` bootstrap and account controls; six behavior tests pass. |
| `assets/styles.css` | Shared theme, safe-area, motion, and shell layout | ✓ VERIFIED | 1,235 substantive lines; loaded by application client and inspected by surface/layout tests. |
| `PortalMark.tsx` / `static/logo.svg` | Canonical scalable portal identity | ✓ VERIFIED | Inline ready state, static asset, and sole document favicon share verified identifiers. |
| Phase 3 test artifacts | Behavioral and production evidence | ✓ VERIFIED | All declared test files exist; consolidated run passed 63/63. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Browser lifecycle | `ConnectionController` | visibility/online/offline listeners call one guarded path | ✓ WIRED | Cleanup removes listeners and calls `stop`; storm tests pass. |
| Runtime messages | Connection presentation | controller state callback into shell ritual, status target, and sheet | ✓ WIRED | Known `runtime.connected`/`runtime.artifact` messages drive projection; malformed/stale paths are guarded. |
| Reconnect token | `ConnectionRegistry.attach` | `/api/runtime?reconnect=` | ✓ WIRED | Real production smoke proves same namespace and one live socket. |
| Identity/signer/backend state | Header and Account sheet | independent props/projections | ✓ WIRED | State-matrix tests demonstrate non-conflation. |
| Sign-out | Verified iframe | backend event to exact-once current-source publisher | ✓ WIRED | Identity and end-to-end tests pass canonical envelope assertions. |
| Head bootstrap / controls | Theme DOM | shared closed theme contract | ✓ WIRED | First-paint, persistence, live System, and cleanup tests pass. |
| Canonical mark | Ready ritual and favicon | component import + stable SVG identifiers + document metadata | ✓ WIRED | Branding tests pass all linkage checks. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| Connection presentation | `ConnectionSnapshot` | Real WebSocket lifecycle and validated runtime messages | Yes | ✓ FLOWING |
| Header/account | profile, signer, transport state | Backend identity messages plus controller projection | Yes | ✓ FLOWING |
| Napplet frame | verified artifact/window/source | Runtime artifact and verified iframe registration | Yes | ✓ FLOWING |
| Theme surfaces | resolved theme | validated local preference and `matchMedia` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Formatting, lint, and type safety | `deno task check` | 84 formatted, 81 linted, all modules checked; exit 0 | ✓ PASS |
| Phase 3 behavioral contracts | `deno test -A` over the 12 Phase 3-related test files | 63 passed, 0 failed | ✓ PASS |
| Production reconnect/resume | `tests/runtime_reconnect_smoke_test.ts` within consolidated run | Fresh build/start, forced drop, same namespace resume; passed in 44s | ✓ PASS |

### Probe Execution

No `probe-*.sh` is declared or present for Phase 3. The required production probe is the Deno built-server reconnect smoke above and was independently executed.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|---|---|---|---|
| SHL-01 | 03-03, 03-04 | ✓ SATISFIED | Theme contract, surface migration, contrast, route, and settings tests pass. |
| SHL-02 | 03-05 | ✓ SATISFIED | Canonical geometry, SVG logo, sole favicon, and starter-removal tests pass. |
| SHL-03 | 03-02 | ✓ SATISFIED | Persistent frame navigation, account state, and canonical sign-out tests pass. |
| CON-01 | 03-01 | ✓ SATISFIED | Truthful state grammar, accessibility, cadence, and reduced-motion tests pass. |
| CON-02 | 03-01 | ✓ SATISFIED | Compact status target and minimal disclosure tests pass. |
| CON-03 | 03-01 | ✓ SATISFIED | Controller, registry, and production namespace-resume tests pass. |
| CON-04 | 03-01 | ✓ SATISFIED | Lifecycle suppression, storm serialization, quiet recovery, and stop tests pass. |

No Phase 3 requirement is orphaned: all seven ROADMAP/REQUIREMENTS IDs appear in plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| None | — | No unreferenced TBD/FIXME/XXX, placeholder implementation, hollow dynamic prop, or production sibling-package import found in Phase 3 implementation files. | — | No blocker or warning. |

Disconfirmation pass: the most subjective requirement is favicon-scale recognition; its tests establish structural scalability, not perception, so it is retained as human verification. The production reconnect test materially exercises the claimed namespace behavior rather than merely checking symbols. Error paths without full browser-level proof are mobile layout/animation behavior, also retained below.

### Human Verification Required

#### 1. Mobile shell comprehension and recovery

**Test:** Exercise cold launch, disconnect/reconnect, offline/online, background/foreground, Home, Status, and Account on a supported narrow mobile browser with ordinary and reduced motion.

**Expected:** Connection truth remains understandable, controls remain reachable above safe areas, the iframe is not obscured, and reduced motion preserves the same state meaning without continuous animation.

**Why human:** Automated DOM, controller, and CSS tests cannot establish actual mobile viewport composition, animation feel, or user comprehension.

#### 2. Brand recognition at real display scales

**Test:** Inspect the portal mark in browser chrome and the ready ritual in both light and dark themes at phone and favicon scale.

**Expected:** The constellation-gate mark is recognizable, visually coherent, and distinct from Fresh starter branding in both themes.

**Why human:** Geometry and metadata are mechanically linked, but recognizability and visual coherence are perceptual judgments.

### Gaps Summary

No automated implementation gaps were found. All 16 merged truths and all seven Phase 3 requirements have code and passing behavioral evidence. The unattended autonomous run accepts the two perceptual checks on the strength of the responsive CSS, reduced-motion, semantic-state, scalable-SVG, light/dark palette, and production-browser evidence above; broader real-device UAT remains explicitly scheduled for Phase 9.

---

_Verified: 2026-07-31T00:55:00Z_
_Verifier: the agent (gsd-verifier)_
