---
quick_id: 260730-phe
status: planned
date: 2026-07-30
---

# Quick Task 260730-phe: Restore Applesauce active account into signer runtime on startup

## Task 1: Hydrate signer service from restored accounts

- Files: `runtime/signer_service.ts`, `main.ts`, `utils.ts`
- Action: Add a restore/hydration path so persisted Applesauce active accounts update the signer service before browser status and runtime authorization checks.
- Verify: Restored identities are projected to public signer state without requiring a new sign-in action.
- Done: `SignerConnectionService.state` can become active from persisted account restoration.

## Task 2: Await restore at runtime gates

- Files: `routes/api/signin/status.ts`, `routes/api/runtime.ts`
- Action: Ensure status and `runtime.start` observe the shared restoration promise before deciding whether the user is signed in.
- Verify: Restarted app no longer returns unavailable/auth-required when a persisted active account exists.
- Done: Route checks run after restoration has completed.

## Task 3: Regression coverage

- Files: `tests/signer_service_test.ts`, `tests/end_to_end_test.ts`, or closest existing tests
- Action: Cover restored private-key and/or offline Nostr Connect account projection into signer/runtime state.
- Verify: `deno task check` and focused tests pass.
- Done: Tests fail if restored account state is not hydrated.

## Verification

- Run `deno task check`.
- Run relevant focused tests and `deno task test` if the environment allows temp account-store writes.
