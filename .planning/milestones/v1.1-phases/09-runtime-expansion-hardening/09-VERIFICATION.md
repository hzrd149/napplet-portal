---
phase: 09-runtime-expansion-hardening
verified: 2026-07-31T10:30:00Z
status: gaps_found
score: 3/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed_with_accepted_residual_risk
  previous_score: 3/4
  gaps_closed: []
  gaps_remaining:
    - "QLT-04 real-device UAT and two-page media browser evidence"
  regressions: []
gaps:
  - truth: "Mobile-browser UAT verifies navigation, themes, connection recovery, stacked/new-tab intent behavior, and cross-tab media ownership on supported real devices."
    status: partial
    reason: "Four non-media local Chromium rows pass, but no supported physical iOS/Android run exists and the two-page media Chromium row still stops at blob-unavailable. Accepted residual risk is not verification evidence."
    artifacts:
      - path: ".planning/phases/09-runtime-expansion-hardening/UAT-MATRIX.md"
        issue: "DEV-01, DEV-02, and MEDIA-01 are explicitly NOT RUN — accepted residual risk."
      - path: "tests/browser/portal_acceptance_test.ts"
        issue: "The two-page media test exists but has not passed through the production artifact boundary."
    missing:
      - "Run DEV-01 and DEV-02 on supported iOS Safari and Android Chrome devices and record successful observations."
      - "Provide an exact verified artifact through the production Blossom boundary and pass the two-page media browser test."
---

# Phase 9: Runtime Expansion Hardening Verification Report

**Phase Goal:** The full v1.1 expansion is contract-compatible, secure at every
proxy boundary, and verified on mobile devices. **Verified:**
2026-07-31T10:30:00Z **Status:** gaps_found **Re-verification:** Yes — after
code-review fixes

## Goal Achievement

### Observable Truths

| # | Truth                                                                                                                                                                   | Status     | Evidence                                                                                                                                                                                                                                                                                                                                               |
| - | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 | Contract and dispatcher tests demonstrate parity with every pinned NAP domain used by v1.1 (QLT-01).                                                                    | ✓ VERIFIED | Independent run of `tests/contract_parity_test.ts` passed all four tests. The test imports the 100-row fixture and `CONTRACT_REGISTRY`, extracts pinned 0.31.0 declarations, checks exact set parity, rejects malformed/silent dispositions, and audits advertised grants.                                                                             |
| 2 | Adversarial tests cannot bypass URL policy, capabilities, storage isolation, signer separation, catalog authority, or sandboxing (QLT-02).                              | ✓ VERIFIED | Independent runs passed 25 focused adversarial tests across transport/transfer, authority, state isolation, browser boundary, and browser lifecycle. Post-review tests prove exact-origin WebSocket CSP, strict host script policy, and effect-free denial.                                                                                            |
| 3 | Automated coverage exercises normal, empty, partial, denied, stale, reconnect, and failure paths and `deno task check` passes (QLT-03).                                 | ✓ VERIFIED | `tests/lifecycle_matrix_test.ts` passed and joins every supported contract row to lifecycle evidence. Reconnect tests prove relay delivery moves to the rebound socket and subscription cleanup is tracked. The production multi-client smoke command exited 0; `deno task check` checked 138 formatted, 134 linted, and all typed files successfully. |
| 4 | Mobile-browser UAT verifies navigation, themes, connection recovery, stacked/new-tab intent behavior, and cross-tab media ownership on supported real devices (QLT-04). | ✗ FAILED   | After a fresh production build, four non-media Chromium rows passed. `UAT-MATRIX.md` records physical iOS/Android checks and the two-page media browser row as `NOT RUN — accepted residual risk`; the latter still ends at sanitized `blob-unavailable`. Backend media smoke is not browser/device evidence.                                          |

**Score:** 3/4 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact                                     | Expected                                  | Status     | Details                                                                                                                      |
| -------------------------------------------- | ----------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `runtime/nap_contract_registry.ts`           | Ten-domain production contract registry   | ✓ VERIFIED | Substantive 100-row registry; imported by parity and lifecycle tests and consulted by production grant lookup.               |
| `tests/fixtures/v1_1_contract_matrix.json`   | Codec-derived canonical matrix            | ✓ VERIFIED | Imported by `contract_parity_test.ts`; exact pinned-literal extraction test passed.                                          |
| `tests/adversarial_*_test.ts`                | Closed hostile-input matrices             | ✓ VERIFIED | Five substantive suites executed independently; 25/25 tests passed.                                                          |
| `tests/lifecycle_matrix_test.ts`             | Complete lifecycle evidence join          | ✓ VERIFIED | Both tests passed, including every-supported-row coverage.                                                                   |
| `tests/production_multiclient_smoke_test.ts` | Built-server reconnect/media transport    | ✓ VERIFIED | Command exited 0 and exercised the built WebSocket boundary.                                                                 |
| `playwright.config.ts`                       | Exact local-Chromium built-server harness | ✓ VERIFIED | Exact Playwright 1.62.1 runner, loopback base URL, and production web server are wired.                                      |
| `tests/browser/portal_acceptance_test.ts`    | Browser acceptance matrix                 | ⚠ PARTIAL  | Four non-media rows pass after `deno task build`; the media row exists but does not have passing evidence.                   |
| `UAT-MATRIX.md`                              | Honest automated/manual/not-run ledger    | ✓ VERIFIED | Clearly separates automated evidence from DEV/LIVE/MEDIA residuals and supplies owner, environment, script, and consequence. |

### Key Link Verification

| From                                    | To                      | Via                                              | Status  | Details                                                                                                                                                               |
| --------------------------------------- | ----------------------- | ------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pinned `@napplet/*@0.31.0` declarations | contract fixture        | literal extraction                               | ✓ WIRED | `contract_parity_test.ts` reads installed declarations and compares exact literals with the fixture.                                                                  |
| Contract fixture                        | production registry     | exact set join                                   | ✓ WIRED | Both are imported into the same parity audit; missing, invented, or silent rows fail.                                                                                 |
| Runtime WebSocket route                 | proxy/service owners    | authenticated bridge dispatch                    | ✓ WIRED | `routes/api/runtime.ts` validates outer connection/window context, then dispatches through the portal bridge; specialized media/intent paths remain generation-bound. |
| Dispatcher                              | COMMON/STORAGE services | server-derived window/account/instance authority | ✓ WIRED | `portal_runtime.ts` constructs authority and `nap_dispatcher.ts` derives owner and storage namespace before effects.                                                  |
| Napplet iframe                          | browser bridge          | exact `contentWindow` source binding             | ✓ WIRED | `NappletFrame.tsx` and `NappletShell.tsx` bind message source to the current sandboxed frame and route backend work over authenticated transport.                     |
| Relay subscription                      | resumed connection      | `connections.send` plus `trackSubscription`      | ✓ WIRED | Review fix is present in `routes/api/runtime.ts`; named reconnect/cleanup regression test passed.                                                                     |
| Browser acceptance                      | built Fresh server      | Playwright `webServer`                           | ✓ WIRED | A clean build followed by the four non-media tests passed 4/4. Media artifact availability remains unresolved.                                                        |

### Data-Flow Trace (Level 4)

| Artifact         | Data                                       | Source                                                            | Produces Real Data                                                     | Status    |
| ---------------- | ------------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------- | --------- |
| Contract parity  | canonical discriminants                    | pinned package declarations plus fixture                          | Yes; exact 100-row join                                                | ✓ FLOWING |
| Runtime services | napplet requests/stream updates            | authenticated WebSocket and server-owned account/window authority | Yes; partial/reconnect/lifecycle tests exercise delivery               | ✓ FLOWING |
| Browser shell    | connection, intent, theme, and media state | built Fresh server and browser WebSocket                          | Yes for four non-media rows; media startup cannot resolve its artifact | ⚠ PARTIAL |

### Behavioral Spot-Checks

| Behavior                                                                     | Command                                                                                                                                     | Result                                                                                         | Status        |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------- |
| Contract, hostile boundaries, lifecycle, reconnect, and production transport | `deno test -A` with the ten focused Phase 9/review suites                                                                                   | Exit 0; parity 4, traceability 1, adversarial 25, lifecycle 2, reconnect 7, production smoke 4 | ✓ PASS        |
| Format, lint, and type integrity                                             | `deno task check`                                                                                                                           | Exit 0                                                                                         | ✓ PASS        |
| Production build and non-media Chromium acceptance                           | `deno task build && deno run -A npm:@playwright/test@1.62.1 test tests/browser/portal_acceptance_test.ts --grep-invert "two browser pages"` | Build succeeded; 4/4 tests passed                                                              | ✓ PASS        |
| Two-page media browser ownership                                             | MEDIA-01 command in `UAT-MATRIX.md`                                                                                                         | Not passed; artifact startup ends at `blob-unavailable`                                        | ✗ FAIL        |
| Supported physical mobile UAT                                                | DEV-01 and DEV-02 scripts                                                                                                                   | Not run                                                                                        | ? NEEDS HUMAN |

### Probe Execution

No Phase 9 plan or summary declares a `probe-*.sh`; probe execution is not
applicable.

### Requirements Coverage

| Requirement | Source Plans               | Status      | Evidence                                                                                    |
| ----------- | -------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| QLT-01      | 09-01, 09-09               | ✓ SATISFIED | Exact pinned contract/registry and 33-ID traceability tests pass.                           |
| QLT-02      | 09-02–09-06, 09-09         | ✓ SATISFIED | All five adversarial matrices pass, including review-fix regressions.                       |
| QLT-03      | 09-02, 09-06, 09-07, 09-09 | ✓ SATISFIED | Lifecycle matrix, reconnect tests, production smoke, build, and check pass.                 |
| QLT-04      | 09-08, 09-09               | ✗ BLOCKED   | Required physical device observations are absent and browser cross-tab media is unresolved. |

All four Phase 9 requirement IDs are claimed by plans; no orphaned Phase 9
requirements were found. The 33-ID traceability test passed with no duplicate or
stale completion contradiction.

### Anti-Patterns Found

No unreferenced `TBD`, `FIXME`, or `XXX` markers were found in the Phase 9
runtime, route, component, island, test, or browser-harness files. No
placeholder or empty implementation was found on a user-visible Phase 9 data
path.

Disconfirmation findings:

- A Playwright run without rebuilding failed because stale `_fresh` output
  lacked `client/logo.svg`; the documented build-first gate rebuilt the artifact
  and then passed 4/4. Browser evidence is therefore reproducible only through
  the documented build-first command.
- The production multi-client smoke proves backend media ownership but cannot
  substitute for playback behavior in two browser pages.
- Live relay/Blossom and target-deployment persistence remain external-service
  risks documented separately in the UAT matrix; they do not supply QLT-04
  device evidence.

### Human Verification Required

#### 1. Supported mobile shell and reconnect

**Test:** Run DEV-01 on supported iOS Safari and Android Chrome hardware.
**Expected:** Safe areas, orientations, themes, reduced motion, backgrounding,
network loss, and reconnect behave without duplicate work or layout failure.
**Why human:** Local Chromium emulation cannot reproduce physical browser
chrome, safe areas, background throttling, or supported-device policy.

#### 2. Physical intent and cross-tab media interaction

**Test:** Run DEV-02 on both supported device/browser families, including
touch-initiated popup modes, history/focus recovery, autoplay, two-tab transfer,
backgrounding, and close/reconnect. **Expected:** Intent modes remain truthful
and media transfer stops the old owner before granting playback to the new
owner. **Why human:** Touch activation, popup/autoplay policy, backgrounding,
and real playback are device/browser behaviors.

#### 3. Local Chromium two-page media closure

**Test:** Supply the exact verified artifact through the production Blossom
boundary and run MEDIA-01. **Expected:** Both pages start the napplet, the first
owner receives stop before the second receives the incremented-generation grant,
and no browser/CSP errors occur. **Why human:** The current deterministic
environment cannot provide the required production artifact; the existing run
stops at `blob-unavailable` before the behavior under test.

### Gaps Summary

Phase 9 proves contract parity, hostile-boundary security, lifecycle coverage,
production transport, and four non-media browser flows. It does not achieve the
full stated goal of mobile-device verification. QLT-04 remains an explicit,
accepted release risk, but under the verification contract it is still a
blocking goal gap rather than a pass or an override.

---

_Verified: 2026-07-31T10:30:00Z_ _Verifier: the agent (gsd-verifier)_
