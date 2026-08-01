---
quick_id: 260731-ph8
status: complete
completed: 2026-08-01
commits:
  - 570d50f
  - a5e7a41
  - 702f0d6
  - 1b99ef2
---

# Quick Task 260731-ph8 Summary

Removed dead and duplicated `runtime/` code (a dead second window bridge, a load-time napplet capability gate, three overlapping expiring-registry/atomic-write implementations) with no behavior change other than the deliberate removal of the load-time capability rejection path. `runtime/` net line count decreased by 95 lines.

## Changes

**Task 1 — Delete the dead second window bridge (`570d50f`)**
- Deleted `RuntimeServiceHub`, its `RuntimeServiceHubOptions` interface, the private `ServiceMessage` union, and the unused `IdentityRuntimeMessage` interface from `runtime/portal_runtime.ts`, plus every import they orphaned (`BehaviorSubject`, `OutboxAdapter`/`OutboxStreamMessage`/`OutboxSubscribeRequest`, `BackendRelayAdapter`/`RelayOwner`/`RelayStreamMessage`/`RelaySubscribeRequest`, `CatalogProjection`, `IntentReply`, `IntentAvailableResultMessage`/`IntentHandlersResultMessage`/`IntentChangedMessage`, `IdentitySnapshot`). It had no production importer — the real window bridge is `createPortalRuntime().openWindow`.
- Retargeted `tests/identity_service_test.ts`: the identity-broadcast test now drives `createPortalRuntime` and its real `openWindow`/`replayIdentity`/`destroyWindow` API directly; the relay-sharing test now constructs `BackendRelayAdapter` directly (that was the semantics actually under test, not hub semantics).

**Task 2 — Remove the load-time napplet capability gate (`a5e7a41`)**
- Deleted the `supported`/`missing`/`missing-capability` throw from `PortalArtifactResolver.#resolveOnce` in `runtime/artifacts.ts`; `grantedDomains` on a `"ready"` result is now always the manifest's full `requires` set.
- Removed `supportedDomains` from `ArtifactAdapterOptions` and `ProductionCatalogResolverOptions`/`createProductionCatalogResolver`'s pass-through, and removed `"missing-capability"` from `ArtifactResolutionErrorCode`.
- Removed the now-unreachable `"unsupported"` failure category from `routes/api/runtime.ts`'s `artifactFailureMessage` and `RuntimeArtifactFailureMessage`, and its matching branch in `islands/NappletShell.tsx`.
- `tests/artifact_resolver_test.ts`: deleted the middle `missing-capability` leg of the integrity test; the `invalid-signature` and `blob-hash-mismatch` legs are untouched and the test was renamed to "integrity failures fail closed".
- `hasContractGrant` (`runtime/nap_contract_registry.ts`) and its `runtime/nap_dispatcher.ts` call site — the per-message NAP authorization path — were not touched; `tests/adversarial_authority_test.ts` passes unmodified.

**Task 3 — Consolidate the expiring keyed registry into `runtime/` (`702f0d6`)**
- Created `runtime/expiring_registry.ts` (`ExpiringRegistry<T>`) as the single TTL-expiring keyed-entry implementation, with `add`/`set`/`take`/`delete`/`clear`/`size` and the exact expiry ordering (remove from map, then clear the timer, then invoke `onExpire`).
- `PendingCorrelations` in `runtime/connections.ts` now delegates to `ExpiringRegistry<undefined>` with its public API byte-for-byte unchanged (`register`/`resolve`/`destroy`/`pendingCount`); the only observable drift, as scoped by the plan, is that re-registering an id no longer emits a separate "resolved" debug line first.
- Deleted `ExpiringCorrelationRegistry` from `routes/api/runtime.ts` with no re-export shim; both intent-correlation registries now construct `ExpiringRegistry` with the route's own `MAX_PENDING_INTENT_CORRELATIONS`/`INTENT_CORRELATION_TTL_MS` policy constants.
- `tests/websocket_session_test.ts` now imports `ExpiringRegistry` from `runtime/` and constructs it with the options-object shape; every assertion is unchanged. `tests/lifecycle_matrix_test.ts` required no edits.
- `runtime/binary_transport.ts`: added an explanatory comment above `ActiveBinaryRequests` (its implementation, exports, and tests are otherwise untouched) documenting why it is out of scope for this abstraction — it is a bounded-concurrency `Set<string>` admission guard with no TTL, no timers, and no stored value.

**Task 4 — Extract one atomic snapshot-write helper (`1b99ef2`)**
- Created `runtime/atomic_file.ts` (`resolveTemporaryPath`, `writeFileAtomically`) holding the single temp-path derivation and write-chmod-rename-cleanup sequence previously duplicated across three stores.
- `AccountStore`, `SettingsStore`, and `NappletStorageStore` now delegate to `writeFileAtomically` via thin wrappers. The `durable` split is preserved exactly: only `NappletStorageStore` uses the durable path (file `sync()`, directory `fsync()`, `beforeRename` hook, `isCurrent` staleness guard). `AccountStore` and `SettingsStore` were not upgraded to durable writes.
- Each store keeps its own exact thrown error message string, its own debug namespace output, and its own per-instance write-serialization queue (`#writeQueue` / `#writeTail`), all left untouched as out of scope.
- No test file required changes for this task.

## Verification

Both gates (`deno task check` then the full `deno task test`, 297 tests, `DENO_JOBS=1 deno test -A --ignore=tests/browser`) were run and passed after every individual task, and once more after all four tasks landed together.

- `deno task check`: passed after every task.
- `deno task test`: 297 passed, 0 failed, after every task.
- Exactly three test files were touched across the whole plan: `tests/identity_service_test.ts`, `tests/artifact_resolver_test.ts`, `tests/websocket_session_test.ts` (confirmed via `git diff --name-only` against the tests/ directory across all four commits).
- `runtime/nap_contract_registry.ts`, `runtime/nap_dispatcher.ts`, and `tests/adversarial_authority_test.ts` are byte-for-byte unmodified.
- `runtime/` net line count decreased by 95 lines (10710 → 10615).

## Deviations from Plan

**1. [Plan self-inconsistency, resolved per the more specific instruction] `runtime/binary_transport.ts` comment addition**

The plan's Task 3 `<action>` explicitly instructs adding an explanatory comment above `ActiveBinaryRequests` in `runtime/binary_transport.ts`, and Task 3's own `<done>` criteria requires that file to "carry a comment explaining why it is out of scope." The plan's top-level `<verification>` section (item 5) separately states `runtime/binary_transport.ts` "is unmodified" alongside `nap_contract_registry.ts`/`nap_dispatcher.ts`/`adversarial_authority_test.ts`, which are genuinely untouched.

These two statements conflict at the byte level. I followed the specific, detailed per-task instruction (which spells out the exact comment content) over the top-level checklist line, on the reading that "unmodified" there means "implementation/exports/tests unchanged" — consistent with the Task 3 `<done>` criteria's own use of "unchanged" in the same sentence that requires the comment. `ActiveBinaryRequests`'s implementation, exports, and `tests/binary_transport_test.ts` are untouched; only a doc comment was added.

No other deviations. All four tasks executed as specified, including the two intentional test edits scoped explicitly by the plan (Task 1's two rewritten tests, Task 2's one deleted assertion leg) and the deliberate behavior removal in Task 2 (load-time capability gate).

## Self-Check

- `runtime/expiring_registry.ts` — FOUND
- `runtime/atomic_file.ts` — FOUND
- Commit `570d50f` — FOUND in `git log --oneline --all`
- Commit `a5e7a41` — FOUND in `git log --oneline --all`
- Commit `702f0d6` — FOUND in `git log --oneline --all`
- Commit `1b99ef2` — FOUND in `git log --oneline --all`

## Self-Check: PASSED

## Commits

- `570d50f` - `refactor(260731-ph8): delete dead RuntimeServiceHub window bridge`
- `a5e7a41` - `refactor(260731-ph8): remove load-time napplet capability gate`
- `702f0d6` - `refactor(260731-ph8): consolidate TTL-expiring registries into runtime/`
- `1b99ef2` - `refactor(260731-ph8): extract shared atomic snapshot-write helper`
