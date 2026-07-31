---
phase: 08-cross-tab-media-sessions
fixed_at: 2026-07-31T05:49:12Z
review_path: .planning/phases/08-cross-tab-media-sessions/08-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 8: Code Review Fix Report

**Fixed at:** 2026-07-31T05:49:12Z
**Source review:** `.planning/phases/08-cross-tab-media-sessions/08-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 5
- Fixed: 5
- Skipped: 0
- Verification: `deno task check`, full `deno task test`, production build, and standalone production media smoke passed

## Fixed Issues

### CR-01: Shell revocation and hidden-tab stopping cross an inaccessible sandbox boundary

**Files modified:** `islands/NappletShell.tsx`, `tests/media_shell_test.tsx`
**Commit:** 281eb16
**Applied fix:** Removed all opaque iframe document access. Revocation, hidden-tab pause, and retry now use source-bound canonical `media.command` bridge messages, while canonical state remains napplet-reported truth.
**Status:** fixed; requires human verification of browser media integration.

### CR-02: Transfer grants authority but never enacts playback in the new owner tab

**Files modified:** `islands/NappletShell.tsx`, `tests/media_shell_test.tsx`
**Commit:** 0234604
**Applied fix:** Added a current-actor/current-generation grant path that queues an early grant until its matching snapshot, ignores foreign and stale grants, and enacts one canonical play command in the registered iframe.
**Status:** fixed; requires human verification of browser media integration.

### CR-03: Create publishes playing before any browser playback succeeds

**Files modified:** `runtime/media_reducer.ts`, `tests/media_sessions_test.ts`
**Commit:** 06388ad
**Applied fix:** New sessions now project stopped state. Napplet autoplay is an enactment grant, and playing becomes authoritative only after a valid current-owner state acknowledgement.
**Status:** fixed; requires human verification of autoplay rejection behavior.

### CR-04: Eligible tabs lose the required emergency Stop action when the owner omits a capability

**Files modified:** `components/MediaControls.tsx`, `tests/media_shell_test.tsx`
**Commit:** 95653c0
**Applied fix:** Kept the portal Stop action available for every nonterminal session independently of optional napplet playback capabilities.

### WR-01: Production smoke passes without proving its advertised ordering and race gates

**Files modified:** `tests/media_transport_smoke_test.ts`
**Commit:** e8b3479
**Applied fix:** Added a shared receive sequence, exact stop-before-grant assertion, first and duplicate result consumption, duplicate-effect exclusion, inactive-recipient isolation, both transfer arrival orders, stale-report no-projection proof, and post-expiry rejection.

---

_Fixed: 2026-07-31T05:49:12Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
