---
phase: 01-one-day-napplet-runtime-mvp
plan: 02
subsystem: auth
tags: [applesauce-accounts, nip-46, nsec, rxjs, persistence]
requires:
  - phase: 01-one-day-napplet-runtime-mvp
    provides: verified runtime tracer and backend transport seam
provides:
  - Versioned sensitive account snapshot with atomic serialized writes
  - Server-owned Nostr Connect, bunker, and nsec account lifecycle
  - Global browser-safe identity observable with offline and unavailable states
affects: [identity-service, publishing, profile-ui, websocket-broadcast]
tech-stack:
  added: []
  patterns: [opaque-account-serialization, active-id-sidecar, safe-identity-projection]
key-files:
  created: [runtime/account_store.ts, tests/account_store_test.ts, tests/accounts_test.ts]
  modified: [runtime/accounts.ts]
key-decisions:
  - "Persist Applesauce account JSON unchanged alongside a portal-owned activeAccountId."
  - "Require the process-wide relay subscription/publish methods when constructing PortalAccounts so NIP-46 never creates a second pool."
  - "Treat restored NIP-46 accounts as active/offline until connectivity succeeds."
patterns-established:
  - "Sensitive snapshots use a 0700 directory, 0600 temporary file, serialized queue, and atomic rename."
  - "Only IdentitySnapshot crosses browser-facing observables; manager accounts and signer objects remain server-only."
requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, NAP-02, QUAL-02]
coverage:
  - id: D1
    description: "Round-trip complete NIP-46 and private-key account state with active selection through an atomic sensitive snapshot."
    requirement: AUTH-04
    verification:
      - kind: unit
        ref: "tests/account_store_test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Run Nostr Connect, bunker, and nsec server-side with newest-successful account globally active."
    requirement: AUTH-01
    verification:
      - kind: integration
        ref: "tests/accounts_test.ts#Nostr Connect leads with URI then activates and broadcasts globally"
        status: pass
      - kind: integration
        ref: "tests/accounts_test.ts#bunker and Not recommended nsec paths run server-side and newest wins"
        status: pass
    human_judgment: false
  - id: D3
    description: "Restore unavailable NIP-46 as active/offline and broadcast unavailable on sign-out while public reads continue."
    requirement: AUTH-06
    verification:
      - kind: integration
        ref: "tests/accounts_test.ts#restored unavailable NIP-46 remains active offline and retries"
        status: pass
      - kind: integration
        ref: "tests/accounts_test.ts#sign-out broadcasts unavailable and rejects signing without stopping public reads"
        status: pass
    human_judgment: false
duration: 5min
completed: 2026-07-30
status: complete
---

# Phase 1 Plan 2: Server-Owned Account Lifecycle Summary

**Applesauce-backed Nostr Connect, bunker, and nsec authority with atomic sensitive persistence and a public-only global identity stream**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-30T12:52:30Z
- **Completed:** 2026-07-30T12:57:22Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added a versioned `{ version, activeAccountId, accounts }` snapshot that preserves complete Applesauce signer records behind restrictive host filesystem permissions.
- Implemented all three backend sign-in paths with newest-successful activation, persistence, and one process-wide identity observable.
- Preserved restored NIP-46 accounts as active/offline, retained public reads after sign-out, and rejected signer operations whenever authority is unavailable.

## Task Commits

1. **Task 1 RED: account snapshot contracts** - `70f27f4` (test)
2. **Task 1 GREEN: sensitive account snapshot** - `0a9bdc4` (feat)
3. **Task 2 RED: global lifecycle contracts** - `05c60c2` (test)
4. **Task 2 GREEN: global account authority** - `9637fa3` (feat)

## Files Created/Modified

- `runtime/account_store.ts` - Versioned, validated, queued atomic sensitive snapshot adapter.
- `runtime/accounts.ts` - Applesauce manager, sign-in commands, restore/retry/sign-out, signing gate, and safe identity projection.
- `tests/account_store_test.ts` - Persistence, permissions, queue ordering, redaction, and transport-isolation tests.
- `tests/accounts_test.ts` - Three sign-in paths, global activation/broadcast, offline restore, persistence, and sign-out tests.

## Decisions Made

- Reused the caller's process-wide Nostr subscription/publish methods for NIP-46 rather than constructing a second relay pool in the account module.
- Stored Applesauce's serialized records without transforming signer fields; only active selection is maintained by the portal.
- AUTH-05 read-only account mode remains explicitly deferred as directed by the plan; public relay/outbox reads are independent of signer availability.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used installed Applesauce sources after a stale reference path**
- **Found during:** Task 2 required reading
- **Issue:** `../hyprgate-gui/apps/shell/src/lib/auth/auth-actions.ts` no longer exists in the workspace.
- **Fix:** Used the exact installed Applesauce 6.2 declarations and implementation as the version-specific authority, including the required global NIP-46 connection methods.
- **Files modified:** `runtime/accounts.ts`, `tests/accounts_test.ts`
- **Verification:** `deno task check` and all account lifecycle tests pass.
- **Committed in:** `9637fa3`

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** The implementation follows the pinned dependency API directly and preserves the intended architecture.

## Issues Encountered

- Applesauce `NostrConnectAccount.fromJSON()` requires subscription and publish methods to be configured before restoration. `PortalAccounts` now requires and installs the process-wide methods before registering/restoring account types.

## User Setup Required

None - the account snapshot path and live relay methods are supplied by the runtime composition layer.

## Next Phase Readiness

- Identity and publishing plans can consume `PortalAccounts.identity$` and `signEvent()` without browser access to signer state.
- The profile UI can project active/offline/unavailable status and sign-out without adding account switching.

## Self-Check: PASSED

- All four task files exist.
- Commits `70f27f4`, `0a9bdc4`, `05c60c2`, and `9637fa3` exist.
- `deno task check` and the prescribed 9 account tests pass.

---
*Phase: 01-one-day-napplet-runtime-mvp*
*Completed: 2026-07-30*
