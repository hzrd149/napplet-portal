---
phase: 04-installed-napplet-discovery
verified: 2026-07-31T01:42:59Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Complete install, review, search, and launch on a narrow mobile browser using real configured Nostr and Blossom endpoints."
    expected: "Review remains readable and focus-safe; partial/stale notices do not hide cards; search remains responsive; only the accepted artifact opens in the single sandboxed frame."
    why_human: "Visual layout, focus behavior, mobile browser feel, and live external relay/Blossom integration cannot be established by static inspection or hermetic tests."
---

# Phase 4: Installed Napplet Discovery Verification Report

**Phase Goal:** Users can build and navigate a trusted installed-napplet catalog from the portal home page.
**Verified:** 2026-07-31T01:42:59Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | A user can submit a valid `naddr`, review its verified manifest, approve installation, and see it appear without reloading. | ✓ VERIFIED | `CatalogService.previewInstall()` bounds and decodes kind 35129, derives immutable facts, and binds approval to `sourceCatalogEventId` (`runtime/catalog.ts:380-455`). Production construction injects relay-selected preview, verified artifact resolution, signing, and all-relay publication (`main.ts:108-146`). The Home form preserves input/review on failure and clears only after approval (`components/HomeView.tsx:180-222`). Focused preview/approval authority and production arbitrary-coordinate tests passed. |
| 2 | Empty, loading, partial, stale, and failed synchronization remain usable and visibly distinct. | ✓ VERIFIED | Raw accepted entries emit as `pending` before enrichment; four workers enrich keyed entries to `ready`/`unavailable`, discarding stale account/catalog completions (`runtime/catalog.ts:244-375`). `CatalogSyncOwner` replaces subscriptions by generation and maps loading/EOSE/error without clearing last-good state except on account change (`runtime/event_runtime.ts:124-190`). Runtime pushes status independently and omits catalog replacement on projection error (`routes/api/runtime.ts:87-113`). State-matrix, last-good, late-generation, and enrichment tests passed. |
| 3 | Search filters installed napplets by meaningful metadata while synchronization continues. | ✓ VERIFIED | `filterCatalogEntries()` is a synchronous local projection over title, final coordinate identifier, version, and capabilities (`components/HomeView.tsx:73-89`). Query is controlled by shell state, and streamed catalog updates replace only the projection (`islands/NappletShell.tsx:422-443`). The UI distinguishes total-empty/no-match and exposes a polite atomic count (`components/HomeView.tsx:380-437`). Search ownership, metadata, partial-entry, no-network, and query persistence tests passed. |
| 4 | Launch uses the accepted manifest event identity and rejects unresolved or superseded entries. | ✓ VERIFIED | Backend launch re-reads current active-account replacement and checks the exact catalog ID, coordinate, and accepted manifest ID before verified artifact resolution (`runtime/catalog.ts:457-492`). Wire decoding requires exact keys and bounded identities (`runtime/transport.ts:58-103`). Cards enable launch only when ready, and the shell assigns `srcdoc` and navigates only after correlated backend success (`components/HomeView.tsx:717-767`, `islands/NappletShell.tsx:516-544`). Exact-triple rejection, integrity mismatch, and accepted-manifest authority tests passed. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `runtime/catalog.ts` | Catalog truth, partial enrichment, preview/approval, exact launch | ✓ VERIFIED | 580 substantive lines; production consumer configured in `main.ts`; focused domain/runtime tests pass. |
| `runtime/relay_policy.ts` | Bounded, blocked-aware preview relay selection | ✓ VERIFIED | `previewReads()` canonicalizes, deduplicates, filters blocked relays, and caps at eight; policy tests pass. |
| `runtime/event_runtime.ts` | Generation-owned active-account catalog subscription | ✓ VERIFIED | `CatalogSyncOwner` is constructed in `main.ts`; cancellation, lifecycle status, and late-generation tests pass. |
| `runtime/transport.ts` / `routes/api/runtime.ts` | Strict correlated runtime commands and independent catalog pushes | ✓ VERIFIED | Exact-key decoder is dispatched through the configured runtime bridge; error pushes do not fabricate empty data. |
| `islands/NappletShell.tsx` | Display-only catalog state, bounded commands, trusted frame launch | ✓ VERIFIED | Registry is capped at 32 and clears timeouts/pending promises; catalog launch uses backend result only. |
| `components/HomeView.tsx` / `assets/styles.css` | Accessible install, stateful cards, local search, mobile styling | ✓ VERIFIED | Components are rendered by the shell; focused UI tests cover labels, dialog trust facts, state matrix, focus return, and result semantics. |
| `COVERAGE.md` | External boundary audit for CAT-01..CAT-04 | ✓ VERIFIED | Exists, maps all four requirements, keeps catalog commands portal-internal, and opts executable bytes out of ordinary projections. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Home install form | `CatalogService` | correlated preview → review → generation-bound approve | ✓ WIRED | `HomeView` sends server-only selectors; shell registry correlates; route dispatches through `RuntimeServiceHub`. |
| Account/settings/relay streams | catalog projection | `CatalogSyncOwner` → `CatalogService.load/mark*` → runtime push | ✓ WIRED | One production owner is created in `main.ts`; subscription replacement and late event rejection are tested. |
| Ready installed card | sandboxed iframe | exact triple → backend verified launch → `setSrcdoc` | ✓ WIRED | No executable `srcdoc` exists in ordinary catalog projection; assignment occurs after successful backend result. |
| Preserved query | streamed partial entries | pure `filterCatalogEntries()` | ✓ WIRED | Query remains island-owned and no search runtime command exists. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| Home catalog | `catalog.entries` | active-account NIP-78 EventStore replacement → `CatalogService` → WebSocket | Yes; relay events and verified artifacts, not fixture arrays | ✓ FLOWING |
| Install review | `installPreview` | policy-selected exact manifest/event and verified Blossom artifact | Yes; server-derived immutable facts | ✓ FLOWING |
| Installed launch | `srcdoc` | exact accepted manifest resolved through `PortalArtifactResolver` after backend revalidation | Yes; only verified executable bytes | ✓ FLOWING |
| Search results | `query` + current entries | browser-local controlled query over latest pushed projection | Yes; recomputed synchronously on each render | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| CAT-01..CAT-04 focused behavior | `deno test -A tests/catalog_test.ts tests/catalog_runtime_test.ts tests/catalog_ui_test.tsx tests/end_to_end_test.ts tests/relay_policy_test.ts tests/artifact_resolver_test.ts` | 36 passed, 0 failed | ✓ PASS |
| Repository quality gate | `deno task check` | fmt, lint, and type checks passed across 85/82 files | ✓ PASS |
| Production compilation | `deno task build` | Fresh client and SSR bundles built successfully | ✓ PASS |

### Probe Execution

No Phase 4 probe scripts are declared or implied. Step 7c: SKIPPED.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| CAT-01 | 04-01..04-04 | Install by reviewed verified `naddr` | ✓ SATISFIED | Backend preview/approval authority, production resolver, correlated UI flow, passing tests. |
| CAT-02 | 04-01..04-04 | Preserve partial/stale/empty/loading/error catalog states | ✓ SATISFIED | Raw-first enrichment, last-good status separation, incremental push, state-matrix tests. |
| CAT-03 | 04-01..04-04 | Launch only accepted manifest identity | ✓ SATISFIED | Exact-triple backend validation and success-only frame assignment with rejection tests. |
| CAT-04 | 04-04 | Search meaningful metadata during synchronization | ✓ SATISFIED | Pure local filter, retained query, no network dispatch, accessibility tests. |

No additional Phase 4 requirements are orphaned in `REQUIREMENTS.md`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | No unreferenced `TBD`, `FIXME`, or `XXX`; no user-visible placeholder or hollow data flow found in Phase 4 artifacts. | ℹ️ Info | None. Guard-clause `return null` matches are decoders/optional rendering, not stubs. |

### Disconfirmation Pass

- Partial requirement sought: installed launch is intentionally disabled until enrichment reaches `ready`; accepted membership nevertheless remains visible, satisfying CAT-02 without weakening CAT-03.
- Misleading-test check: component source-string assertions alone would not prove authority. Backend domain/runtime tests independently execute stale-generation, exact-identity, integrity, concurrency, and lifecycle cases.
- Uncovered environment path: hermetic tests do not prove real mobile layout/focus behavior or public relay/Blossom interoperability; the unattended run accepts the automated proxy evidence here and retains broader real-device/live-service UAT for Phase 9.

### Human Verification Required

#### 1. Real mobile catalog flow

**Test:** On a narrow mobile browser with real configured Nostr and Blossom endpoints, sign in, install a valid `naddr`, inspect the review, approve it, search while synchronization updates, and launch the ready card.

**Expected:** Review facts remain readable; stale/partial state never erases known cards; dialog invalidation restores focus; search remains responsive; launch opens exactly one sandboxed frame containing the accepted artifact.

**Why human:** Visual layout, focus behavior, mobile interaction quality, and live third-party service integration cannot be established by static inspection or hermetic automated tests.

### Gaps Summary

No implementation blockers or warnings were found. All four roadmap truths and CAT-01..CAT-04 have substantive, wired, behaviorally tested code. Final status is `passed`; the real-browser/mobile and external-service exercise above remains an explicit Phase 9 hardening check.

---

_Verified: 2026-07-31T01:42:59Z_
_Verifier: the agent (gsd-verifier)_
