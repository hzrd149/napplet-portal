---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Runtime & UX Expansion
current_phase: 3
current_phase_name: Mobile Shell Resilience
status: executing
stopped_at: Completed 03-01-PLAN.md
last_updated: "2026-07-31T00:16:42.890Z"
last_activity: 2026-07-30
last_activity_desc: Milestone v1.1 roadmap created
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 5
  completed_plans: 1
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-30)

**Core value:** A napplet can run in a mobile browser while a server-side Deno runtime handles the heavy Nostr/runtime work.
**Current focus:** Phase 3 — Mobile Shell Resilience

## Current Position

Phase: 3 — Mobile Shell Resilience
Plan: 1 of 5
Status: In progress — Plan 03-01 complete
Last activity: 2026-07-31 — Completed connection resilience and constellation presentation

## Performance Metrics

**Velocity:**

- Total plans completed: 7
- Average duration: N/A
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. One-Day Napplet Runtime MVP | 6/6 | 99min | 17min |
| 2. Backend Runtime Expansion | 1/7 | 6min | 6min |
| 3. NAP Coverage, Policy, and Production Hardening | 0/TBD | - | - |

**Recent Trend:**

- Last 5 plans: none
- Trend: N/A

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 18min | 3 tasks | 32 files |
| Phase 01 P02 | 5min | 2 tasks | 4 files |
| Phase 01 P03 | 6min | 2 tasks | 6 files |
| Phase 01 P04 | 8min | 2 tasks | 12 files |
| Phase 01 P05 | 7min | 2 tasks | 5 files |
| Phase 01 P06 | 55min | 3 tasks | 18 files |
| Phase 02 P01 | 6min | 2 tasks | 8 files |
| Phase 02 P02 | 5min | 2 tasks | 7 files |
| Phase 02 P03 | 3min | 1 tasks | 5 files |
| Phase 02 P04 | 10min | 1 tasks | 5 files |
| Phase 02 P05 | 4min | 1 tasks | 12 files |
| Phase 02 P06 | 13min | 2 tasks | 10 files |
| Phase 02 P07 | 6min | 2 tasks | 9 files |
| Phase 03 P01 | 12min | 2 tasks | 12 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table. Recent decisions affecting current work:

- [MVP Scope]: The first Phase 1 checkpoint targets one day and proves sign-in, verified sandboxed napplet launch, and initial-plus-live backend stream data; full Phase 1 completion has no one-day deadline.
- [MVP Scope]: Phase 1 retains every locked decision D-01 through D-47 and implements SHELL, IDENTITY, RELAY, and OUTBOX without pulling deferred NAP domains into scope.
- [Sign-in]: Nostr Connect QR/URI is primary; bunker URI and nsec are secondary, with nsec labeled `Not recommended` rather than developer-only.
- [Runtime Style]: Applesauce/RxJS usage should be stream-first, avoid nested subscriptions, and avoid UI flows that wait for Nostr data to be complete.
- [Cache Backends]: Runtime should support local Nostr relays and local Blossom servers so napplet events/blobs can be cached locally instead of always loading from public relays/servers.
- [Roadmap]: Future phases expand backend Nostr runtime, Kehto/napplet contracts, NAP API breadth, policy, diagnostics, and production hardening.
- [Phase 1]: Production imports use pinned npm packages; sibling packages remain reference-only.
- [Phase 1]: Verify manifest signature, aggregate, and Blossom bytes before srcdoc injection.
- [Phase 1]: Process-owned signer and relay services survive transient browser sessions.
- [Phase 1]: Reconnect preserves connection-owned windows and logical subscriptions through grace.
- [Phase 1]: RELAY and OUTBOX use composed streams with centralized dedupe and complete required publish settlement.
- [Phase 02]: Use the human-approved exact npm:applesauce-loaders@6.2.0 production import. — Package legitimacy was explicitly confirmed before installation.
- [Phase 02]: Persist endpoint settings in one versioned atomic JSON snapshot with one BehaviorSubject-backed source. — Keeps backend authority reactive without introducing a second database technology.
- [Phase 02]: Use one process-owned EventStore, RelayPool, and unified loader lifecycle. — Applesauce owns event semantics and deterministic teardown without duplicated runtime state.
- [Phase ?]: Canonical relay equality is evaluated before precedence, blocking, deduplication, or AUTH permission.
- [Phase ?]: The local relay request is an internal cache boundary; only upstream EOSE is emitted to callers.
- [Phase ?]: Cache write settlement updates sanitized health asynchronously and never gates upstream event delivery.
- [Phase ?]: Local Blossom discovery is fixed to loopback and bounded; configured HTTP(S) endpoints contribute only upstream proxy hints.
- [Phase ?]: Cached executable bytes remain untrusted until existing signature, aggregate, and blob hash verification succeeds.
- [Phase ?]: Public catalog content is an exact versioned codec containing only coordinate and accepted manifest event ID.
- [Phase ?]: Catalog mutations serialize, re-read the latest active-account replacement, and advance locally only after complete required-relay acceptance.
- [Phase ?]: Launch identity is projected only after the exact accepted manifest event ID crosses the verified artifact boundary.
- [Phase ?]: [Phase 02]: Extend version-1 runtime settings snapshots additively so existing persisted state remains valid.
- [Phase ?]: [Phase 02]: Keep server-rendered settings inside a shell-owned history view so the napplet frame stays mounted.
- [Phase ?]: [Phase 02]: Project relay and Blossom cache health independently without gating settings or launch.
- [Phase ?]: Accepted manifest event IDs remain the only launch authority; unresolved entries cannot launch.
- [Phase ?]: Catalog projections emit from one process-owned CatalogService after verified loads or fully accepted mutations.
- [Phase ?]: Native catalog dialogs invalidate on replacement event identity and return focus to the invoking card.
- [Phase ?]: Pinned @kehto/runtime 0.20.1 and @napplet/core/@napplet/nap 0.31.0 remain the sole executable contract authority.
- [Phase ?]: Sibling source availability and marker mismatch are serialized as non-blocking diagnostic evidence.
- [Phase ?]: Reset connection failures only after a validated runtime artifact proves readiness.
- [Phase ?]: Keep signer identity independent from backend transport recovery.
- [Phase ?]: Use validated PORTAL_PORT binding for isolated production transport tests.

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2+] Catalog breadth, multi-user authentication, approval UX, durable cache policy, and NAP domains beyond SHELL, IDENTITY, RELAY, and OUTBOX remain deferred.
- [Phase 2] Fresh 2.3/Vite middleware cannot exercise WebSocket upgrades under `deno task dev`; use the production build/start path for runtime transport checks.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260730-par | Fix napplet iframe element not filling the available height | 2026-07-30 | 3000f4d | [260730-par-fix-napplet-iframe-element-not-filling-t](./quick/260730-par-fix-napplet-iframe-element-not-filling-t/) |
| 260730-phe | Restore Applesauce active account into signer runtime on startup | 2026-07-30 | 0fe5bd1 | [260730-phe-restore-applesauce-active-account-into-s](./quick/260730-phe-restore-applesauce-active-account-into-s/) |
| 260730-pcm | Shorten RELAY and OUTBOX behavior reasons in Phase 01 COVERAGE.md to satisfy the verify-work preflight gate, then rerun Phase 01 verification | 2026-07-30 | 1f54bd0 | [260730-pcm-shorten-relay-and-outbox-behavior-reason](./quick/260730-pcm-shorten-relay-and-outbox-behavior-reason/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Runtime | Full Applesauce event persistence, relay sync, relay settings, Blossom settings, local relay cache, local Blossom blob cache | Deferred to Phase 2 | MVP scope alignment |
| NAP APIs | Full NAP-RELAY, NAP-STORAGE, NAP-RESOURCE, NAP-INTENT, NAP-THEME, NAP-NOTIFY, approvals | Deferred to Phase 3 | MVP scope alignment |
| Security | Production hardening, CSP/Permissions-Policy audit, full security tests | Deferred to Phase 3 | MVP scope alignment |

## Session Continuity

Last session: 2026-07-31T00:16:42.879Z
Stopped at: Completed 03-01-PLAN.md
Resume file: None
