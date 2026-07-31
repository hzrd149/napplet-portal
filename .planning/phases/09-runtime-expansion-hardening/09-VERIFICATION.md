---
phase: 09-runtime-expansion-hardening
verified: 2026-07-31T08:30:00Z
status: passed_with_accepted_residual_risk
score: 3/4 requirements satisfied; 1/4 incomplete with accepted residual risk
behavior_unverified: 1
overrides_applied: 0
---

# Phase 9: Runtime Expansion Hardening Verification Report

**Phase Goal:** Close contract, security, lifecycle, browser automation, and
traceability gaps without claiming unavailable physical/live observations ran.
**Verdict:** QLT-01, QLT-02, and QLT-03 are satisfied. QLT-04 is not fully
satisfied because supported real-device UAT and the two-page media browser
observation did not complete; this is an explicitly accepted release risk, not a
pass.

## Goal Achievement

| Requirement | Canonical status                 | Evidence-backed result                                                                                                                                                                                                                                                                                |
| ----------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QLT-01      | Complete                         | `tests/contract_parity_test.ts` joins 100 exact pinned 0.31.0 codec/action rows across ten domains to production ownership and dispatcher evidence; sibling repositories remain reference-only.                                                                                                       |
| QLT-02      | Complete                         | Plans 09-02 through 09-06 close hostile transfer, capability/catalog/signer, state isolation, browser sandbox/policy, and async-generation matrices with fail-closed tests.                                                                                                                           |
| QLT-03      | Complete                         | `tests/lifecycle_matrix_test.ts`, the full Deno suite/check, production build, and built two-client smoke cover normal, empty, partial, denied, stale, reconnect, replacement, failure, and shutdown seams.                                                                                           |
| QLT-04      | Pending — accepted residual risk | Four non-media local Chromium rows pass. Physical iOS/Android observations were not run. The two-page media browser row remains `NOT RUN — accepted residual risk` after one bounded closure still ended at `blob-unavailable`; built Deno two-client media smoke passes but is not browser evidence. |

## Automated Evidence

| Gate                                                                                                                     | Result     | Scope                                                               |
| ------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------- |
| `deno task check`                                                                                                        | PASS       | Formatting, lint, and TypeScript                                    |
| `deno task test`                                                                                                         | PASS       | Serial Deno suite: 272 passed, 0 failed; browser runs separately    |
| `deno task build`                                                                                                        | PASS       | Fresh client and server production build                            |
| `deno test -A tests/production_multiclient_smoke_test.ts`                                                                | PASS       | Built reconnect and two-client media transport                      |
| `deno run -A npm:@playwright/test@1.62.1 test tests/browser/portal_acceptance_test.ts --grep-invert "two browser pages"` | PASS (4/4) | Local Chromium viewport/theme/focus, history, reconnect, and intent |
| `deno test -A tests/requirement_traceability_test.ts`                                                                    | PASS       | 33 unique mappings, no stale completion contradictions              |

The complete five-row Playwright command is not represented as passing: its
media row cannot reach media creation because the built browser path reports
sanitized `blob-unavailable`. The independent `pinnedFetch` response-lifecycle
deadlock was fixed in `89c04d7`; focused pinned-fetch and resolver tests pass,
but that fix did not close the browser observation.

The release run stabilized test discovery and external artifact contention by
keeping Playwright under its dedicated runner and setting `DENO_JOBS=1` for the
Deno suite. The parser-blocking intent reservation bootstrap now severs
`window.opener` immediately and waits for `DOMContentLoaded` before touching the
status node; focused intent tests and all four non-media Chromium rows pass.

## Canonical Ledger Reconciliation

- All 33 v1.1 requirement IDs map exactly once.
- Phase 4 CAT, Phase 5 RES/UPL, Phase 6 COM/STO, Phase 7 INT, and Phase 8 MED
  requirements are Complete based on their canonical passed verification
  artifacts.
- Phase 5 is recorded as 4/4 plans complete; Phases 6 and 8 are marked complete
  from passed goal-backward verification.
- Phase 9 has 9/9 plans executed, while its phase/QLT-04 outcome remains
  incomplete with accepted residual risk.
- Historical performance metrics were preserved; unsupported timing/count
  history was not reconstructed.

## Residual Risks

The canonical scripts, owners, environments, rationale, and consequences are in
`UAT-MATRIX.md`:

- DEV-01: physical safe areas, themes, reconnect, and backgrounding.
- DEV-02: physical touch/popup/autoplay, intent, and cross-tab media.
- LIVE-01: public relay and public/local Blossom interoperability.
- LIVE-02: live COMMON evolution and target-deployment STORAGE restart.
- MEDIA-01: local Chromium two-page media closure after exact verified artifact
  availability.

## Threat Review

- Evidence uses a closed status vocabulary and never upgrades an unexecuted
  observation to pass (T-09-11).
- Manual scripts prohibit secrets, tokens, authorization headers, private
  payloads, and personal production data (T-09-12).
- Exact `@playwright/test@1.62.1` remains the user-authorized residual SUS pin;
  no broader dependency authorization is inferred (T-09-SC).

## Final Assessment

The automated contract, security, lifecycle, production, and non-media browser
gates support release of those surfaces. Release acceptance must explicitly
carry QLT-04 as incomplete: physical/mobile and media-browser behavior may still
differ from deterministic backend and local Chromium evidence.
