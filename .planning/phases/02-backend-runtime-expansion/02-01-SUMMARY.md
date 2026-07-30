---
phase: 02-backend-runtime-expansion
plan: "01"
subsystem: backend-runtime
tags: [deno, applesauce, rxjs, event-store, settings]
requires:
  - phase: 01-one-day-napplet-runtime-mvp
    provides: process-owned portal runtime, relay seam, and backend configuration defaults
provides:
  - Versioned atomic backend settings persistence with one reactive settings source
  - Process-owned Applesauce EventStore, RelayPool, unified loader, and lifecycle
  - Portal event lookup that consumes newly saved relay settings without restart
affects: [02-02-relay-cache, 02-03-blossom-cache, 02-05-settings-ui]
tech-stack:
  added: [applesauce-loaders@6.2.0]
  patterns: [serialized atomic JSON writes, BehaviorSubject state source, injected process-owned runtime]
key-files:
  created: [runtime/settings_store.ts, runtime/settings.ts, runtime/event_runtime.ts, tests/settings_test.ts]
  modified: [deno.json, deno.lock, runtime/portal_runtime.ts, tests/tracer_end_to_end_test.ts]
key-decisions:
  - "Use the human-approved exact npm:applesauce-loaders@6.2.0 production import."
  - "Keep endpoint persistence in one versioned atomic JSON snapshot and expose one BehaviorSubject-backed service."
  - "Let Applesauce EventStore own live event semantics while RelayPool and the unified loader share one deterministic lifecycle."
patterns-established:
  - "Runtime settings: validate and canonicalize before an atomic queued write, then emit only after persistence succeeds."
  - "Event runtime: inject test upstreams at the loader boundary while production owns a real RelayPool."
requirements-completed: [V2-01, V2-02, V2-03]
coverage:
  - id: D1
    description: "Versioned runtime settings persist atomically and emit canonical updates through one process-owned source."
    requirement: V2-03
    verification:
      - kind: unit
        ref: "tests/settings_test.ts#settings use runtime defaults when the snapshot is absent; settings reject corrupt and unsupported snapshots; settings canonicalize, persist queued writes, and emit reactively"
        status: pass
    human_judgment: false
  - id: D2
    description: "A process-owned Applesauce loader uses newly saved relay settings and stores a real signed event without restart."
    requirement: V2-01
    verification:
      - kind: e2e
        ref: "tests/tracer_end_to_end_test.ts#persisted settings reach a process-wide loader without restart"
        status: pass
    human_judgment: false
  - id: D3
    description: "The shared EventStore owns empty, duplicate, provenance, replacement, deletion, and teardown behavior."
    requirement: V2-02
    verification:
      - kind: integration
        ref: "tests/tracer_end_to_end_test.ts#shared EventStore owns empty, duplicate, provenance, replacement, and delete semantics"
        status: pass
    human_judgment: false
duration: 6min
completed: 2026-07-30
status: complete
---

# Phase 2 Plan 1: Persisted Settings and Applesauce Runtime Tracer Summary

**Atomic reactive endpoint settings now drive a shared Applesauce EventStore, RelayPool, and loader on the next portal operation without a restart.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-30T20:12:59Z
- **Completed:** 2026-07-30T20:18:30Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added defensive versioned settings persistence with serialized temp-file/rename writes and canonical endpoint validation.
- Added a process-owned EventRuntime whose EventStore, RelayPool, loader, model seam, and idempotent teardown share one lifecycle.
- Proved saved relay settings reach a real signed-event loader operation without restart, with EventStore semantics and all 60 repository tests passing.

## Task Commits

Each task was committed atomically:

1. **Task 1: Approve the exact loader package** - human approval recorded before dependency installation (no code commit)
2. **Task 2 RED: Specify the persisted-settings runtime tracer** - `c7dae1c` (test)
3. **Task 2 GREEN: Establish the reactive Applesauce runtime foundation** - `47b6575` (feat)

## Files Created/Modified

- `runtime/settings_store.ts` - Parses versioned snapshots and serializes atomic backend writes.
- `runtime/settings.ts` - Owns canonical runtime settings and the process-wide reactive snapshot.
- `runtime/event_runtime.ts` - Owns EventStore, RelayPool, unified loader, and terminal teardown.
- `runtime/portal_runtime.ts` - Routes event lookups through current persisted settings and the shared runtime.
- `tests/settings_test.ts` - Covers defaults, corruption/version rejection, canonical persistence, queued writes, and emissions.
- `tests/tracer_end_to_end_test.ts` - Covers saved-settings loader lookup, EventStore semantics, and idempotent teardown.
- `deno.json` - Pins the approved Applesauce loader import.
- `deno.lock` - Locks the approved loader package and dependency metadata.

## Decisions Made

- Used the exact human-approved `npm:applesauce-loaders@6.2.0` import and no similarly named substitute.
- Reused the Phase 1 atomic JSON-file persistence pattern rather than adding a second database technology.
- Passed current settings into each new loader operation so non-reactive work picks up changes naturally without forced teardown.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The Phase 1 tracer fixture is intentionally contract-shaped rather than cryptographically valid, so EventStore correctly rejected it. The loader tracer now creates a real signed Nostr event, preserving the planned signature-acceptance boundary.

## Authentication Gates

- Task 1's package-legitimacy gate was satisfied before execution: the user explicitly approved `applesauce-loaders@6.2.0`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 02-02 policy-safe NIP-65/NIP-42 routing and local-relay read-through caching on the shared runtime.
- No blockers; focused tests, full repository tests, formatting, lint, and type checking pass.

## Self-Check: PASSED

- All created files exist.
- Task commits `c7dae1c` and `47b6575` exist.
- `deno test -A tests/settings_test.ts tests/tracer_end_to_end_test.ts`, `deno task check`, and the full 60-test suite pass.

---
*Phase: 02-backend-runtime-expansion*
*Completed: 2026-07-30*
