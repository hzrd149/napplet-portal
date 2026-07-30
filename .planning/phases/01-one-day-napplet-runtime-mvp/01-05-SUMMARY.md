---
phase: 01-one-day-napplet-runtime-mvp
plan: 05
subsystem: runtime
tags: [rxjs, nostr, relay, outbox, nip-65, identity]
requires:
  - phase: 01-02
    provides: process-wide account authority and public identity stream
  - phase: 01-03
    provides: connection/window ownership and reconnect lifecycle
provides:
  - Store-first continuing RELAY streams with exact provenance and one EOSE
  - Continuing OUTBOX streams over preset plus NIP-65 routing without EOSE
  - A singleton identity/relay/outbox service hub with ordered teardown
  - Canonically settled signed and encrypted publishing seams
affects: [01-06, relay-streams, outbox-publishing, runtime-composition]
tech-stack:
  added: []
  patterns: [rxjs-composed-stream, centralized-dedupe, acknowledgement-settlement]
key-files:
  created: [runtime/outbox.ts, tests/relay_stream_test.ts, tests/identity_service_test.ts]
  modified: [runtime/relay_adapter.ts, runtime/portal_runtime.ts]
key-decisions:
  - "RELAY cache and raw pool sources merge into one RxJS subscription with per-logical-stream dedupe and finalize cleanup."
  - "OUTBOX exposes no EOSE and treats every deduplicated preset/NIP-65 write relay as required for publish success."
patterns-established:
  - "Only raw pool message.from values become relayHints; cache events omit provenance."
  - "Window teardown precedes service teardown, which precedes cache/runtime authority teardown."
requirements-completed: [STREAM-01, STREAM-02, STREAM-03, STREAM-04, STREAM-05, STREAM-06, STREAM-07, NAP-02, NAP-03, NAP-04, QUAL-02]
coverage:
  - id: D1
    description: "RELAY streams cached values first, dedupe live copies, preserve raw provenance, emit one EOSE, and continue delivering."
    requirement: STREAM-01
    verification:
      - kind: unit
        ref: "tests/relay_stream_test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Connection/window/subId ownership remains independent through close and replay-safe reconnect."
    requirement: STREAM-07
    verification:
      - kind: unit
        ref: "tests/relay_stream_test.ts#same subId and reconnect replay"
        status: pass
    human_judgment: false
  - id: D3
    description: "IDENTITY broadcasts safe snapshots and OUTBOX routes continuing reads and settled publishes through one authority."
    requirement: NAP-02
    verification:
      - kind: integration
        ref: "tests/identity_service_test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "RELAY preserves signed events unchanged while encrypted publishing encrypts and signs on the backend before settlement."
    requirement: NAP-03
    verification:
      - kind: unit
        ref: "tests/relay_stream_test.ts#RELAY forwards signed events unchanged"
        status: pass
    human_judgment: false
duration: 7min
completed: 2026-07-30
status: complete
---

# Phase 01 Plan 05: Continuing RELAY and OUTBOX Runtime Summary

**One RxJS-based backend authority now composes store-first RELAY streams, no-EOSE OUTBOX streams, browser-safe identity broadcasts, and acknowledgement-settled publishing.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-30T13:16:37Z
- **Completed:** 2026-07-30T13:23:12Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Merged synchronous store results and raw live pool messages into one continuing RxJS subscription with centralized event-ID dedupe.
- Preserved exact observed `message.from` relay hints, omitted unknown cache provenance, emitted one nonterminal RELAY EOSE, and exposed no OUTBOX EOSE.
- Added connection/window/subId ownership, immediate close, idempotent teardown, and replay-safe reconnect behavior.
- Added preset plus NIP-65 OUTBOX routing, signer availability gating, unchanged signed RELAY forwarding, backend encrypted signing, and required-relay acknowledgement settlement.
- Added one runtime service hub for browser-safe identity broadcasts and shared RELAY/OUTBOX authority across windows.

## Task Commits

1. **Task 1 RED: Continuing RELAY contracts** - `010d5c2` (test)
2. **Task 1 GREEN: Store-first RELAY adapter** - `2a6a225` (feat)
3. **Task 2 RED: Identity and OUTBOX contracts** - `2e3a233` (test)
4. **Task 2 GREEN: Runtime service composition** - `c012539` (feat)
5. **Task 2 fix: Replay-safe cleanup** - `8503e9c` (fix)

## Files Created/Modified

- `runtime/relay_adapter.ts` - RxJS RELAY composition, provenance, dedupe, ownership, close, and publish settlement.
- `runtime/outbox.ts` - Preset/NIP-65 continuing stream router and backend-signed publish settlement.
- `runtime/portal_runtime.ts` - Shared IDENTITY/RELAY/OUTBOX service hub and ordered window/service teardown.
- `tests/relay_stream_test.ts` - Store/live ordering, provenance, EOSE, ownership, reconnect, signed, and encrypted publish contracts.
- `tests/identity_service_test.ts` - Identity broadcasts, singleton authority, OUTBOX routing, signer gating, and settlement contracts.

## Decisions Made

- Kept dependency ports narrow and injected so Plan 01-06 can attach the process-wide Applesauce pool/store without rebuilding service semantics.
- Modeled relay acceptance as explicit per-relay outcomes and returned success only when every required deduplicated target accepts.
- Used one composed RxJS subscription per logical stream; no nested subscriptions or wait-for-completeness flows were introduced.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Made repeated window/OUTBOX cleanup idempotent**
- **Found during:** Task 2 teardown verification
- **Issue:** Explicit OUTBOX close followed by window teardown could emit `outbox.closed` twice, and re-registering an existing window ID did not first release its prior services.
- **Fix:** Added a close guard, close-before-window-replacement, and a reconnect replay regression test.
- **Files modified:** `runtime/outbox.ts`, `runtime/portal_runtime.ts`, `tests/relay_stream_test.ts`
- **Verification:** Eight focused tests, `deno task check`, and the full 30-test suite pass.
- **Committed in:** `8503e9c`

---

**Total deviations:** 1 auto-fixed (1 bug).
**Impact on plan:** The fix strengthens the required ownership and teardown semantics without changing architecture or scope.

## Issues Encountered

- The planned Hyprgate reference checkout is not present beside this repository. Current Kehto relay handler/result sources and the phase coverage contract supplied the authoritative behavior instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-06 can inject the real singleton Applesauce pool/store/account/cache into these tested ports and route the Fresh WebSocket through `RuntimeServiceHub`.
- The open responsive UI verification ledger entry remains assigned to Plan 01-06's final browser checkpoint.

## Self-Check: PASSED

- All five created/modified implementation and test files exist.
- All five task commits are present.
- `deno task check`, eight focused tests, and all 30 project tests pass.

---
*Phase: 01-one-day-napplet-runtime-mvp*
*Completed: 2026-07-30*
