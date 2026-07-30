---
phase: 01-one-day-napplet-runtime-mvp
plan: 03
subsystem: runtime
tags: [deno, fresh, websocket, nip-5d, blossom, artifact-cache]
requires:
  - phase: 01-01
    provides: verified-artifact and transport tracer seams
provides:
  - Verified configured napplet resolver with fail-closed capability policy
  - Process-memory verified blob cache and held-version retry lifecycle
  - Server-issued reconnectable connection, window, and subscription ownership
  - Fresh WebSocket boundary with grace-scoped cleanup
affects: [01-04, 01-05, 01-06, artifact-loading, runtime-sessions]
tech-stack:
  added: []
  patterns: [verified-before-srcdoc, server-issued namespaces, detach-grace-expiry]
key-files:
  created: [tests/artifact_resolver_test.ts, tests/websocket_session_test.ts]
  modified: [runtime/artifacts.ts, runtime/connections.ts, runtime/portal_runtime.ts, routes/api/runtime.ts]
key-decisions:
  - "A resolved artifact promise is held for the process lifetime until explicit retry, preventing silent version changes within a session."
  - "Reconnect replaces only the socket sender while preserving the connection/window/subscription namespace through a bounded grace period."
patterns-established:
  - "Artifact failures expose named codes and never carry executable HTML."
  - "Cleanup deletes window and subscription ownership before invoking unsubscribe hooks."
requirements-completed: [MVP-02, MVP-04, MVP-05, STREAM-07, NAP-01, NAP-04, QUAL-02]
coverage:
  - id: D1
    description: "Configured NIP-5D artifacts are signature, aggregate, and blob verified before srcdoc exposure, cached only after verification, and held until retry."
    requirement: MVP-02
    verification:
      - kind: integration
        ref: "tests/artifact_resolver_test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "WebSocket reconnect retains server-owned window and subscription namespaces without duplication or cross-tab leakage."
    requirement: STREAM-07
    verification:
      - kind: unit
        ref: "tests/websocket_session_test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The complete runtime regression suite preserves the verified Security Lab tracer and backend stream behavior."
    requirement: NAP-04
    verification:
      - kind: e2e
        ref: "deno test -A"
        status: pass
    human_judgment: false
duration: 6min
completed: 2026-07-30
status: complete
---

# Phase 01 Plan 03: Verified Artifact and Reconnect Lifecycle Summary

**NIP-5D signature/aggregate/blob verification now feeds a held in-memory artifact cache, while server-issued WebSocket namespaces survive bounded reconnects without leaking subscriptions across tabs.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-30T12:59:23Z
- **Completed:** 2026-07-30T13:05:22Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added a configurable resolver that merges configured and manifest Blossom sources, verifies through pinned `@kehto/nip`, and exposes no HTML on named failures.
- Added an injected process-memory cache, configured-empty state, and explicit retry boundary around the held verified version.
- Added server-issued connection/window/reconnect identifiers, connection-scoped subscription keys, socket replacement, and ordered grace expiry.
- Bound the WebSocket artifact response to the resolver-computed dTag and aggregate rather than fixture-declared identity.

## Task Commits

Each TDD task was committed with separate RED and GREEN commits:

1. **Task 1 RED: Artifact resolver contracts** - `fe914b0` (test)
2. **Task 1 GREEN: Verified artifact resolver/cache** - `f69c870` (feat)
3. **Task 2 RED: WebSocket lifecycle contracts** - `c4f109a` (test)
4. **Task 2 GREEN: Reconnectable owned sessions** - `8a5f1d9` (feat)

## Files Created/Modified

- `runtime/artifacts.ts` - Resolver adapter, named failures, verified cache, held-version and retry semantics.
- `runtime/connections.ts` - Connection/window/subscription registry and correlation timeout helper.
- `routes/api/runtime.ts` - WebSocket upgrade validation, reconnect attachment, generated namespaces, and verified identity response.
- `runtime/portal_runtime.ts` - Generalized shell-ready receive type for canonical NAP messages.
- `tests/artifact_resolver_test.ts` - Supplied fixture resolution, source merge, cache, integrity, capability, and empty-config tests.
- `tests/websocket_session_test.ts` - Reconnect, ownership, cleanup ordering, and timeout correlation tests.

## Decisions Made

- Kept production imports on pinned npm packages; sibling `../kehto` was used only to inspect the canonical NIP-5D contract.
- Made capability enforcement adapter-configurable so production can pass the Phase 1 coverage allowlist while the legacy supplied-fixture tracer remains compatible until its route wiring is expanded.
- Preserved logical backend subscriptions while detached; reconnect changes the delivery socket rather than recreating subscriptions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Broadened the runtime shell receive boundary**
- **Found during:** Task 2 (Fresh WebSocket route integration)
- **Issue:** `NappletMessage` does not carry a string index signature and could not be passed to the tracer bridge's `Record<string, unknown>` parameter.
- **Fix:** Narrowed the bridge input to the only property it reads, `{ readonly type?: unknown }`.
- **Files modified:** `runtime/portal_runtime.ts`
- **Verification:** `deno task check` and all 18 tests pass.
- **Committed in:** `8a5f1d9`

---

**Total deviations:** 1 auto-fixed (1 blocking issue).
**Impact on plan:** The type-boundary adjustment was required for canonical NAP messages and did not expand runtime authority or dependencies.

## Issues Encountered

- The supplied artifact fixture records metadata but not its 531 KB verified blob, so its integration test retrieves the real content from the recorded Blossom sources before exercising cache behavior.

## User Setup Required

None - no new external service configuration required.

## Next Phase Readiness

- The owned connection/window seam is ready for the full RELAY/OUTBOX adapters in following plans.
- Production startup still needs to inject the Phase 1 supported-domain allowlist when it adopts `PortalArtifactResolver`; the adapter already fails closed when that policy is supplied.

## Self-Check: PASSED

- All six created/modified implementation and test files exist.
- All four task commits are present in git history.
- `deno task check`, the prescribed six tests, and the complete 18-test suite pass.

---
*Phase: 01-one-day-napplet-runtime-mvp*
*Completed: 2026-07-30*
