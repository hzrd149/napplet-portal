---
phase: 01-one-day-napplet-runtime-mvp
plan: 01
subsystem: runtime
tags: [deno, fresh, kehto, napplet, nostr, websocket, tdd]
requires: []
provides:
  - Hash-verified Security Lab artifact resolution from the supplied NIP-5A coordinate
  - Source-bound opaque iframe bridge with exactly-once Kehto shell initialization
  - Backend-owned initial-plus-live RELAY tracer stream
  - Immutable loopback-safe runtime configuration and owned transport codec
affects: [phase-01-plans-02-through-06, accounts, artifacts, relay, shell]
tech-stack:
  added: [applesauce-accounts, applesauce-core, applesauce-relay, applesauce-signers, kehto, napplet-0.31, nostr-tools]
  patterns: [verified-srcdoc, source-bound-postmessage, backend-owned-stream, red-green-tdd]
key-files:
  created: [runtime/portal_runtime.ts, runtime/artifacts.ts, runtime/relay_adapter.ts, routes/api/runtime.ts, islands/NappletShell.tsx, tests/fixtures/supplied_napplet_contract.json]
  modified: [deno.json, deno.lock, routes/index.tsx]
key-decisions:
  - "Use ../napplet only as a reference source; production imports use pinned npm packages."
  - "Keep the Wave 0 runtime permissive for undeveloped Security Lab domains while exposing only identity and relay in this tracer."
  - "Fetch Blossom bytes from declared servers and let @kehto/nip fail closed on signature, aggregate, or blob mismatch."
patterns-established:
  - "Artifact identity is derived from verified manifest and blob bytes before srcdoc injection."
  - "Browser messages are accepted only from the mounted iframe WindowProxy and forwarded through one owned WebSocket."
requirements-completed: [MVP-01, MVP-02, MVP-03, MVP-04, MVP-05, AUTH-01, AUTH-03, STREAM-01, STREAM-02, STREAM-04, STREAM-05, STREAM-07, NAP-01, NAP-02, NAP-03, NAP-04, QUAL-01, QUAL-02, QUAL-03]
coverage:
  - id: D1
    description: "Resolve and launch the exact supplied Security Lab artifact only after signature, aggregate, and blob verification."
    requirement: MVP-02
    verification:
      - kind: e2e
        ref: "tests/tracer_end_to_end_test.ts#verified Security Lab completes sign-in, handshake, and continuing relay stream"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cross a source-bound opaque iframe bridge and send shell.init exactly once."
    requirement: NAP-01
    verification:
      - kind: integration
        ref: "deno task check && deno task build"
        status: pass
    human_judgment: false
  - id: D3
    description: "Deliver a stored event, EOSE boundary, and later live update without completing the same backend stream."
    requirement: STREAM-02
    verification:
      - kind: e2e
        ref: "tests/tracer_end_to_end_test.ts#verified Security Lab completes sign-in, handshake, and continuing relay stream"
        status: pass
    human_judgment: false
duration: 18min
completed: 2026-07-30
status: complete
---

# Phase 1 Plan 1: One-Day Napplet Runtime MVP Tracer Summary

**Hash-verified Security Lab srcdoc with an opaque Kehto iframe handshake and backend-owned initial-plus-live RELAY stream**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-30T12:32:13Z
- **Completed:** 2026-07-30T12:49:34Z
- **Tasks:** 3
- **Files modified:** 32

## Accomplishments

- Decoded the supplied coordinate with `nak`, fetched its signed manifest, and froze the verified event, aggregate, blob hash, servers, requirements, and observed NAP contract into a real-artifact fixture.
- Replaced the Fresh starter landing path with a mobile shell that loads only hash-verified bytes in `sandbox="allow-scripts"` and binds messages to the mounted iframe source.
- Added a backend-owned account seam, correlated transport codec, exactly-once shell handshake, and continuing relay subscription that delivers stored data, EOSE, then a distinct live update.

## Task Commits

1. **Correct relocated napplet reference source** - `c26336e` (docs)
2. **Task 3 RED: failing vertical tracer contracts** - `b115889` (test)
3. **Task 3 GREEN: verified napplet tracer** - `9c9f5ef` (feat)
4. **Task 3 correctness fix: connect the real iframe bridge** - `194c363` (fix)

## Files Created/Modified

- `runtime/config.ts` - Immutable loopback-only startup configuration and endpoint normalization.
- `runtime/transport.ts` - Size-bounded, ownership-checked browser/backend envelope codec.
- `runtime/artifacts.ts` - Canonical `@kehto/nip` signature, aggregate, and blob verification.
- `runtime/accounts.ts` - Minimal backend-owned active public identity seam.
- `runtime/connections.ts` - Connection/window/source ownership registry.
- `runtime/relay_adapter.ts` - Stored-first stream with EOSE and continuing live tail.
- `runtime/portal_runtime.ts` - Narrow tracer composition and exactly-once handshake.
- `routes/api/runtime.ts` - Owned WebSocket artifact and relay proxy.
- `islands/NappletShell.tsx` - Source-bound browser bridge and mobile shell.
- `components/NappletFrame.tsx` - Opaque `sandbox="allow-scripts"` iframe.
- `tests/fixtures/supplied_napplet_contract.json` - Evidence derived from the verified Security Lab artifact.
- `tests/runtime_contract_test.ts`, `tests/config_test.ts`, `tests/tracer_end_to_end_test.ts` - Contract, security, and tracer gates.

## Decisions Made

- The relocated `../napplet` tree is reference-only. Application imports resolve exact pinned npm packages.
- The artifact declares `identity`, `inc`, `relay`, `resource`, `storage`, and `theme`; Wave 0 exposes only the tracer's `identity` and `relay` domains. Plans 02–06 expand the same runtime rather than replacing it.
- Host-owned namespace injection occurs outside the verified artifact bytes and before authored scripts, following the canonical Kehto helper.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected relocated sibling source references**
- **Found during:** Task 2 artifact checkpoint
- **Issue:** Planning references still pointed at the removed `../napplet-web` path.
- **Fix:** Updated every tracked reference to `../napplet` and made the reference-only/npm-import boundary explicit.
- **Files modified:** `AGENTS.md` and tracked planning/research documents
- **Verification:** No stale path remains and no production path/workspace import targets `../napplet`.
- **Committed in:** `c26336e`

**2. [Rule 3 - Blocking] Scoped the quality task to application sources**
- **Found during:** Task 3 GREEN verification
- **Issue:** `deno fmt --check .` treated generated planning Markdown as application source and blocked the prescribed gate.
- **Fix:** Kept format/lint/type checks comprehensive for application, runtime, UI, and test paths while excluding planning artifacts.
- **Files modified:** `deno.json`
- **Verification:** `deno task check` passes.
- **Committed in:** `9c9f5ef`

**3. [Rule 1 - Bug] Connected the mounted iframe to the backend WebSocket stream**
- **Found during:** Tracer feedback gate
- **Issue:** The first GREEN implementation mounted verified srcdoc but its real island path did not yet forward source-bound messages.
- **Fix:** Bound `postMessage` to the exact iframe WindowProxy, sent one `shell.init`, forwarded identity/relay envelopes, and returned query/subscription events through the WebSocket.
- **Files modified:** `components/NappletFrame.tsx`, `islands/NappletShell.tsx`, `routes/api/runtime.ts`
- **Verification:** Full check, focused tracer tests, and production build pass.
- **Committed in:** `194c363`

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug).
**Impact on plan:** All changes were necessary for a reproducible and genuinely connected tracer; no synthetic napplet was introduced.

## Issues Encountered

- Deno's 24-hour minimum dependency age rejected the verified Kehto release. The human explicitly approved retrying the same exact pins with `--minimum-dependency-age=0`; no version or source changed.
- Git lacked repository-local author configuration. The repository's existing author identity was reused locally without changing global configuration.

## User Setup Required

None - the supplied coordinate and declared Blossom servers are captured in the verified fixture.

## Next Phase Readiness

- Plans 02–06 can expand the committed account, artifact, connection, transport, relay, and shell modules.
- Security Lab's additional `inc`, `resource`, `storage`, and `theme` requirements remain intentionally outside this Wave 0 tracer and must be covered by the locked later plans before full Phase 1 acceptance.

## Self-Check: PASSED

- All key created files exist.
- Commits `c26336e`, `b115889`, `9c9f5ef`, and `194c363` exist.
- `deno task check`, the focused three-test suite, and `deno task build` pass.

---
*Phase: 01-one-day-napplet-runtime-mvp*
*Completed: 2026-07-30*
