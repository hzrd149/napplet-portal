---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 1
current_phase_name: One-Day Napplet Runtime MVP
status: paused
stopped_at: "Phase 1 Plan 01-01 Task 1: blocking-human package legitimacy approval required before installation"
last_updated: "2026-07-30T12:03:11.731Z"
last_activity: 2026-07-30
last_activity_desc: Phase 1 plans finalized for the full locked runtime MVP, with a one-day target only for the first vertical tracer checkpoint.
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 6
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-30)

**Core value:** A napplet can run in a mobile browser while a server-side Deno runtime handles the heavy Nostr/runtime work.
**Current focus:** Phase 1: One-Day Napplet Runtime MVP

## Current Position

Phase: 1 of 3 (One-Day Napplet Runtime MVP)
Plan: TBD in current phase
Status: Paused at blocking-human package verification checkpoint
Last activity: 2026-07-30 - Phase 1 plans finalized for the full locked runtime MVP, with a one-day target only for the first vertical tracer checkpoint.

Progress: [----------] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: N/A
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. One-Day Napplet Runtime MVP | 0/TBD | - | - |
| 2. Backend Runtime Expansion | 0/TBD | - | - |
| 3. NAP Coverage, Policy, and Production Hardening | 0/TBD | - | - |

**Recent Trend:**

- Last 5 plans: none
- Trend: N/A

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table. Recent decisions affecting current work:

- [MVP Scope]: The first Phase 1 checkpoint targets one day and proves sign-in, verified sandboxed napplet launch, and initial-plus-live backend stream data; full Phase 1 completion has no one-day deadline.
- [MVP Scope]: Phase 1 retains every locked decision D-01 through D-47 and implements SHELL, IDENTITY, RELAY, and OUTBOX without pulling deferred NAP domains into scope.
- [Sign-in]: Nostr Connect QR/URI is primary; bunker URI and nsec are secondary, with nsec labeled `Not recommended` rather than developer-only.
- [Runtime Style]: Applesauce/RxJS usage should be stream-first, avoid nested subscriptions, and avoid UI flows that wait for Nostr data to be complete.
- [Cache Backends]: Runtime should support local Nostr relays and local Blossom servers so napplet events/blobs can be cached locally instead of always loading from public relays/servers.
- [Roadmap]: Future phases expand backend Nostr runtime, Kehto/napplet contracts, NAP API breadth, policy, diagnostics, and production hardening.

### Pending Todos

None yet.

### Blockers/Concerns

- The user-supplied napplet coordinate/artifact is a blocking Wave 0 prerequisite; no authored or synthetic example may substitute for its contract fixture.
- Plan verification proceeded by explicit user override with two accepted findings: the Wave 0 tracer task is larger than the checker threshold, and artifact-dependent research questions remain execution prerequisites until the supplied artifact is available.
- Catalog breadth, multi-user authentication, approval UX, durable cache policy, and NAP domains beyond SHELL, IDENTITY, RELAY, and OUTBOX remain deferred.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Runtime | Full Applesauce event persistence, relay sync, relay settings, Blossom settings, local relay cache, local Blossom blob cache | Deferred to Phase 2 | MVP scope alignment |
| NAP APIs | Full NAP-RELAY, NAP-STORAGE, NAP-RESOURCE, NAP-INTENT, NAP-THEME, NAP-NOTIFY, approvals | Deferred to Phase 3 | MVP scope alignment |
| Security | Production hardening, CSP/Permissions-Policy audit, full security tests | Deferred to Phase 3 | MVP scope alignment |

## Session Continuity

Last session: 2026-07-30T12:07:39.453Z
Stopped at: Phase 1 Plan 01-01 Task 1: blocking-human package legitimacy approval required before installation
Resume file: .planning/phases/01-one-day-napplet-runtime-mvp/.continue-here.md
