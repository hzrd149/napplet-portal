---
quick_id: 260730-phe
status: complete
date: 2026-07-30
commit: 0fe5bd1
---

# Quick Task 260730-phe Summary

Fixed account restoration drift by deriving runtime signer state from the Applesauce-backed account identity stream instead of maintaining a separate active-account state machine.

## Changes

- `PortalAccounts.identity$` now derives from `AccountManager.active$`, so restored Applesauce active accounts project into portal identity state.
- `SignerConnectionService` now keeps only transient pending/error state for remote-signer attempts and projects active/offline identity from `PortalAccounts.identity$`.
- Startup, sign-in status, and `runtime.start` share and await account restoration before deciding whether a user is signed in.
- Added regression coverage for restored accounts hydrating signer state without a fresh sign-in and for runtime/status gates awaiting restore.
- Added project guidance to keep service structures simple and prefer Applesauce reactive sources like `active$`/`accounts$` as the source of truth.

## Verification

- `deno task check` passed.
- `deno test -A tests/signer_service_test.ts` passed.
- `TMPDIR="$PWD/.tmp-tests" deno test -A tests/accounts_test.ts tests/end_to_end_test.ts tests/signer_service_test.ts` passed.
- The same focused account tests fail without `TMPDIR` override because the environment reports `Disk quota exceeded (os error 122)` when writing temp account snapshots under `/tmp`.

## Commits

- `0fe5bd1` - `fix: hydrate signer state from restored accounts`
