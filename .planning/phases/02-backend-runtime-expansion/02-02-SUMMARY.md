---
phase: 02-backend-runtime-expansion
plan: "02"
subsystem: backend-runtime
tags: [deno, applesauce, rxjs, relay-policy, local-cache]
requires:
  - phase: 02-backend-runtime-expansion
    plan: "01"
    provides: shared EventStore, RelayPool, loader lifecycle, and reactive endpoint settings
provides:
  - Canonical direction-aware relay policy with blocked precedence and explicit per-relay AUTH
  - Reactive installed Applesauce MailboxesModel-to-pool observable path
  - Bounded local-first relay reads with non-blocking observed cache writes
affects: [02-03-blossom-cache, 02-05-settings-ui, 02-06-runtime-integration]
tech-stack:
  added: []
  patterns: [policy-before-pool boundary, concat local-first streams, serialized observed cache writes]
key-files:
  created: [runtime/relay_policy.ts, runtime/relay_cache.ts, tests/relay_policy_test.ts, tests/relay_cache_test.ts]
  modified: [runtime/event_runtime.ts, runtime/outbox.ts, runtime/relay_adapter.ts]
key-decisions:
  - "Canonical relay equality is evaluated before precedence, blocking, deduplication, or AUTH permission."
  - "The local relay request is an internal cache boundary; only upstream EOSE is emitted to callers."
  - "Cache write settlement updates sanitized health asynchronously and never gates upstream event delivery."
requirements-completed: [V2-02, V2-04, V2-06]
coverage:
  - id: D1
    description: "Installed MailboxesModel replacement emissions drive official OutboxMap and FilterMap pool inputs without portal-owned mailbox state."
    requirement: V2-06
    verification:
      - kind: integration
        ref: "tests/relay_policy_test.ts#installed mailbox model drives pool observable maps on replacement"
        status: pass
    human_judgment: false
  - id: D2
    description: "Blocked relay precedence and exact opt-in AUTH are enforced at the canonical policy boundary."
    requirement: V2-06
    verification:
      - kind: unit
        ref: "tests/relay_policy_test.ts#relay policy canonicalizes precedence, blocking, empty sets, and AUTH; blocked relay is removed before any pool operation input"
        status: pass
    human_judgment: false
  - id: D3
    description: "Local completion gates upstream opening while cache failures remain bounded, sanitized, and non-fatal."
    requirement: V2-04
    verification:
      - kind: integration
        ref: "tests/relay_cache_test.ts#local EOSE opens upstream with the exact backend timeout; local failure degrades health and falls through to upstream"
        status: pass
    human_judgment: false
  - id: D4
    description: "Upstream delivery precedes cache acknowledgement while preserving provenance, dedupe, EOSE, and owner isolation."
    requirement: V2-02
    verification:
      - kind: integration
        ref: "tests/relay_cache_test.ts#upstream delivery precedes observed cache acknowledgement with provenance and dedupe; close remains isolated per owner"
        status: pass
    human_judgment: false
duration: 5min
completed: 2026-07-30
status: complete
---

# Phase 2 Plan 2: Policy-Safe Local-First Relay Cache Summary

**Canonical NIP-65 routing now blocks ineligible relays before pool access, while an exact 1,500 ms local-cache boundary falls through to live upstream streams without gating delivery on cache writes.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-30T20:21:05Z
- **Completed:** 2026-07-30T20:25:49Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added canonical direction-aware relay resolution with deterministic NIP-65/default/fallback precedence, blocked overrides, deduplication, and exact per-relay AUTH opt-in.
- Proved the installed Applesauce `MailboxesModel`, `createOutboxMap`, `createFilterMap`, `outboxSubscription`, and `subscriptionMap` observable seam reacts to replacement relay-list events without duplicated portal state.
- Added a bounded local-first read-through cache with the exact 1,500 ms backend timeout, non-blocking serialized writes, sanitized health degradation, provenance retention, dedupe, singular EOSE, and isolated ownership teardown.
- Passed all 67 repository tests plus formatting, lint, and TypeScript checks.

## Task Commits

1. **Task 1: Enforce blocked-relay precedence and opt-in AUTH** - `ddd6ea4` (feat)
2. **Task 2: Expand subscriptions into bounded local-first read-through streams** - `07b8c16` (feat)

## Files Created/Modified

- `runtime/relay_policy.ts` - Canonical relay resolution, blocked precedence, AUTH permission, and observable filter-map boundary.
- `runtime/relay_cache.ts` - Exact-timeout local reads, upstream sequencing, observed write queue, and sanitized health.
- `runtime/event_runtime.ts` - Applies relay policy before loader reads.
- `runtime/outbox.ts` - Applies direction-aware policy before OUTBOX subscriptions and publishes.
- `runtime/relay_adapter.ts` - Sequences memory, bounded local cache, and live upstream while preserving wire ownership.
- `tests/relay_policy_test.ts` - Covers installed model/pool APIs, replacement emissions, precedence, canonical equality, blocking, and AUTH.
- `tests/relay_cache_test.ts` - Covers timeout options, EOSE gating, failures, delivery order, write rejection, provenance, dedupe, and close isolation.

## Decisions Made

- Canonicalize relay URLs before every equality or precedence decision so blocking and AUTH cannot be bypassed by spelling variants.
- Treat local EOSE as an internal cache-completion signal; callers receive one upstream EOSE while the stream remains live.
- Keep the local timeout as an exported backend constant, not an operator setting, because it bounds optional-cache latency rather than routing policy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed an unused type import found by the full quality gate**
- **Found during:** Task 2 verification
- **Issue:** The Task 1 installed-API probe retained an unused `Observable` type import, causing `deno task check` to fail lint.
- **Fix:** Removed the unused import and reran all focused tests and the complete quality gate.
- **Files modified:** `tests/relay_policy_test.ts`
- **Verification:** `deno task check`
- **Commit:** `07b8c16`

**Total deviations:** 1 auto-fixed bug. **Impact:** No behavior or scope change; the repository quality gate is clean.

## Issues Encountered

None.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Relay policy and optional event-cache seams are ready for Blossom caching and later operator settings UI integration.
- No blockers; focused verification, full repository tests, and the complete static quality gate pass.

## Self-Check: PASSED

- All four created artifacts and three modified integration files exist.
- Task commits `ddd6ea4` and `07b8c16` exist.
- `deno test -A tests/relay_policy_test.ts tests/relay_cache_test.ts tests/relay_stream_test.ts`, `deno task check`, and the full 67-test suite pass.

---
*Phase: 02-backend-runtime-expansion*
*Completed: 2026-07-30*
