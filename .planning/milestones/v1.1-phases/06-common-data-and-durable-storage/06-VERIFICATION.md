---
phase: 06-common-data-and-durable-storage
verified: 2026-07-31T00:00:00Z
status: passed
score: 10/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 6: Common Data and Durable Storage Verification Report

**Phase Goal:** Napplets can use common Nostr helpers and durable isolated key-value state without taking backend authority into the browser.
**Verified:** 2026-07-31
**Status:** passed
**Re-verification:** No — initial goal-backward verification after review fixes

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | A verified napplet can invoke the exact eight pinned COMMON operations and receives one correlated result. | ✓ VERIFIED | `runtime/nap_dispatcher.ts` exact-key decoders and `runtime/common.ts` eight-case service; `common_test.ts` parity/action tests and `common_runtime_integration_test.ts` all pass. |
| 2 | NIP-19 supports only the six public canonical forms and never exposes nsec. | ✓ VERIFIED | `encodePublicNip19`/decode validation in `runtime/common.ts`; the named six-form plus nsec-rejection test passes. |
| 3 | Profile and follows expose current partial/stale cached truth while bounded Applesauce relay work updates shared truth. | ✓ VERIFIED | `CommonService` reads `EventRuntime.eventStore` immediately and starts bounded refreshes; cached-empty, later sanitized profile, deterministic follows, and shared-store preservation tests pass. |
| 4 | Follow, unfollow, react, and report use backend signer/outbox authority with stable denial/publication failures. | ✓ VERIFIED | Production composition in `main.ts` connects `CommonService` to `signerAccounts` and a RelayPolicy-backed `OutboxAdapter`; success, denial, and required-publication failure integration tests pass. |
| 5 | COMMON work is generation/window bound and cancellation does not destroy the process EventStore. | ✓ VERIFIED | `NapDispatcher.abortWindow` cancels window work; `CommonService.cancel` tears down owned refreshes; the named generation/expiry test passes and asserts the shared runtime remains alive. |
| 6 | Storage implements exact set/get/keys/remove over string values in shared and instance scopes only. | ✓ VERIFIED | Exact envelope validation and all four dispatch branches are in `runtime/nap_dispatcher.ts`; dispatcher behavior, missing-null, lexical keys, and invalid-scope tests pass. |
| 7 | Storage namespaces are isolated by active account and exact verified manifest identity; instance scope additionally uses only the backend-issued instance ID. | ✓ VERIFIED | `runtime/storage.ts` namespace tuple includes account, coordinate, manifest event, d-tag, aggregate hash, scope, and conditional instance ID; launch authority is produced server-side in `runtime/portal_runtime.ts`. Authority/isolation tests pass. |
| 8 | Storage survives reconnect and process restart without browser or shell ownership. | ✓ VERIFIED | Production uses process-owned `.data/napplet-storage.json`; reconnect retains the backend window authority, and restart tests reopen a new service/store and recover shared and instance values. |
| 9 | Storage mutations serialize globally and publish memory only after atomic durable persistence. | ✓ VERIFIED | `StorageService.#mutationTail` performs copy/validate/write/commit; `NappletStorageStore` uses synced random sibling temp files plus atomic rename. Concurrent cross-namespace, rename-failure rollback, recovery, malformed-state, and restart tests pass. |
| 10 | Quotas, deterministic serialization, revocation, and non-deletion invariants hold. | ✓ VERIFIED | UTF-8 key/value, per-namespace key, and cross-scope aggregate quotas are prospective; canonical sorting is tested across restart; stale/sign-out/manifest authority fails closed while durable namespaces remain untouched. |

**Score:** 10/10 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `runtime/common.ts` | Exact COMMON codec/service and projections/actions | ✓ VERIFIED | Substantive eight-operation implementation, imported by production composition and dispatcher. |
| `runtime/storage_store.ts` | Closed canonical snapshot codec and atomic replacement | ✓ VERIFIED | Strict v1 parser, canonical serializer, permission-aware temp/write/sync/rename path. |
| `runtime/storage.ts` | Isolated string storage, quotas, serialized mutations | ✓ VERIFIED | Real snapshot-backed reads and copy-persist-commit mutations. |
| `runtime/nap_dispatcher.ts` | Authority-first COMMON/STORAGE dispatch | ✓ VERIFIED | Exact request validation, capability/current-authority checks, operation lifecycle, canonical responses. |
| `runtime/portal_runtime.ts` | Backend-issued verified window identity | ✓ VERIFIED | Catalog launch output creates immutable authority; sign-out, replacement, expiry revoke it. |
| Phase 6 test files | Behavioral coverage of contracts and invariants | ✓ VERIFIED | 20 focused tests pass; included in the repository-wide gate. |

### Key Link and Data-Flow Verification

| From | To | Status | Evidence |
|---|---|---|---|
| Catalog launch / runtime route | Portal launch authority | ✓ WIRED | Only successful backend `catalog.launch` output is registered; browser messages cannot supply namespace identity. |
| Portal runtime | NapDispatcher | ✓ WIRED | Every COMMON/STORAGE forward carries the exact stored `WindowCapabilityContext`, rechecked against account and accepted manifest. |
| NapDispatcher | CommonService / StorageService | ✓ WIRED | Exact operation switches call injected production services and return correlated results. |
| CommonService | EventRuntime / EventStore / Outbox | ✓ FLOWING | Reads use the shared process store; refreshes feed it; mutations sign and publish through backend policy. |
| StorageService | NappletStorageStore | ✓ FLOWING | Mutations persist the complete canonical snapshot before publishing new in-memory truth. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Phase 6 focused behavior | `deno test -A tests/storage_test.ts tests/common_test.ts tests/common_storage_runtime_test.ts tests/common_runtime_integration_test.ts` | 20 passed, 0 failed | ✓ PASS |
| Full workspace regression | `deno task test` | 189 passed, 0 failed | ✓ PASS |
| Format, lint, and type checking | `deno task check` | 103 formatted, 100 linted, all modules checked | ✓ PASS |

### Probe Execution

No Phase 6 probe scripts are declared. Behavioral proof is supplied by the named Deno tests above.

### Requirements Coverage

| Requirement | Status | Evidence |
|---|---|---|
| COM-01 | ✓ SATISFIED | Six-form NIP-19 codec and exact COMMON helper/action surface pass focused and integration tests. |
| COM-02 | ✓ SATISFIED | Applesauce-backed shared EventStore projections return partial cached truth and accept later relay-fed truth. |
| STO-01 | ✓ SATISFIED | Exact set/get/keys/remove contract is implemented and behaviorally tested. |
| STO-02 | ✓ SATISFIED | Backend-derived account/manifest/instance namespaces, closed scopes, deterministic serialization, and quotas are tested. |
| STO-03 | ✓ SATISFIED | Filesystem-backed snapshot reload and reconnect authority retention are tested; state is process/backend owned. |

### Anti-Patterns Found

No unreferenced TBD/FIXME/XXX markers, placeholder implementations, hollow data paths, sibling-package production imports, or browser-owned authority were found in the Phase 6 implementation files.

### Human Verification Required

None for the Phase 6 contract. Real-relay, production multi-client, hostile-boundary, and device-level evidence is explicitly owned by Phase 9 Runtime Expansion Hardening and does not reduce this phase's automated result.

### Disconfirmation Pass

- The closest partial-risk area is live relay timing: Phase 6 proves immediate partial data and later shared-store projection deterministically, while real-network timing remains Phase 9 evidence.
- The eight-operation parity assertion alone only enumerates names, but it is backed by dispatcher switches plus independent codec, mutation, denial, and production publication tests.
- External relay timeout/failure diversity is not exhaustive here; Phase 6 does cover stable required-publication failure, and Phase 9 owns adversarial expansion.

### Gaps Summary

No blocking gaps. All roadmap success criteria and COM-01/COM-02/STO-01/STO-02/STO-03 are implemented, wired to production composition, and exercised by passing behavioral tests.

---

_Verified: 2026-07-31_
_Verifier: gsd-verifier_
