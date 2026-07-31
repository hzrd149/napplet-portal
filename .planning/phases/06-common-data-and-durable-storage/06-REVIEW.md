---
phase: 06-common-data-and-durable-storage
reviewed: 2026-07-31T04:05:00Z
depth: deep
files_reviewed: 14
files_reviewed_list:
  - components/NappletFrame.tsx
  - islands/NappletShell.tsx
  - main.ts
  - routes/api/runtime.ts
  - runtime/common.ts
  - runtime/event_runtime.ts
  - runtime/nap_dispatcher.ts
  - runtime/portal_runtime.ts
  - runtime/storage.ts
  - runtime/storage_store.ts
  - tests/common_runtime_integration_test.ts
  - tests/common_storage_runtime_test.ts
  - tests/common_test.ts
  - tests/storage_test.ts
findings:
  critical: 5
  warning: 3
  info: 0
  total: 8
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-07-31T04:05:00Z
**Depth:** deep
**Files Reviewed:** 14
**Status:** issues_found

## Summary

The implementation has five ship-blocking correctness, security, and durability defects. Existing window authority is not tied to the catalog's current accepted manifest, asynchronous signing has an account-switch authorization race, COMMON work can be amplified without a per-window bound, NIP-56 report tags are malformed, and the storage replacement is atomic but not crash-durable. Three additional contract and state-consistency defects affect exact COMMON decoding, corrupt cached profiles, and concurrent contact mutations.

The focused Phase 6 suite passed (20 tests), and `deno task check` passed. Those gates do not exercise the failures below.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Accepted-manifest replacement does not revoke an existing window authority

**File:** `runtime/portal_runtime.ts:321-324`
**Issue:** The per-dispatch authority validator checks only object identity in `windowAuthorities` and the active account pubkey. It never checks that `candidate.manifestEventId` is still the catalog entry's currently accepted manifest. `catalog.approve` and `catalog.uninstall` can change that accepted truth without clearing the authority; only a later successful `catalog.launch`, sign-out, or window destruction replaces/revokes it. A window launched under an obsolete or uninstalled manifest therefore retains COMMON/STORAGE access, including its old capability grants and signer-backed actions. This violates the phase's exact-manifest authority boundary.
**Fix:** Make current accepted-manifest membership part of `isCurrent`, or subscribe to catalog mutations and revoke every authority whose `(account, coordinate, manifestEventId)` no longer matches the current catalog. Revocation must call `abortWindow`/cancel owned work before the catalog mutation is reported successful.

### CR-02: Account changes during signing can publish an event under the wrong identity

**File:** `runtime/common.ts:285-292`
**Issue:** `#publish` checks the expected pubkey immediately before awaiting `publisher.publish`, but never checks it afterward or verifies `result.event.pubkey`. The production publisher asynchronously reads identity and invokes `PortalAccounts.signEvent` (`main.ts:154-186`). If sign-out/sign-in or account replacement happens during that await, the old window's request can be signed or routed using the new account and its NIP-65 relay set, then returned as success and inserted into the shared EventStore. This is a cross-account authorization and privacy race.
**Fix:** Pass the expected account identity/generation into the publisher. The publisher must pin that identity through signing and relay selection, reject a signed event whose `pubkey` differs, and recheck the generation before any relay publication and again before success is committed to EventStore.

### CR-03: COMMON requests have no per-window concurrency or work quota

**File:** `runtime/nap_dispatcher.ts:390-405`
**Issue:** Unlike resource/upload work, every authorized COMMON request is dispatched immediately with no duplicate-ID check, active-operation limit, abort controller, or generation settlement guard. Each `getProfile`/`follows` creates a relay subscription and stores another cleanup (`runtime/common.ts:110-171`), while each action can start signer and multi-relay publication work. A sandboxed napplet can issue an unbounded number of concurrent requests over one socket, exhausting relay connections, signer prompts, memory, and outbound work despite the phase's quota/security goals. The cleanup set also retains completed refresh callbacks until window teardown.
**Fix:** Put COMMON requests under a bounded per-window operation registry, reject duplicate correlation IDs, cap active reads/actions, and remove refresh cleanup entries when they time out or complete. Abort/cancel by authority generation and suppress late settlement after revocation.

### CR-04: Snapshot replacement is not crash-durable

**File:** `runtime/storage_store.ts:128-135`
**Issue:** The store writes a temp file and renames it but never syncs the temp file or parent directory. A successful `storage.set` can therefore be acknowledged and published to in-memory truth while the bytes or directory entry remain only in the OS cache; a process/host crash can restore the old snapshot, an empty file, or no file. Atomic rename prevents torn readers during normal execution, but it does not provide the promised durable commit.
**Fix:** Open the temporary file explicitly, write and `sync()` it, close it, rename it, then sync the containing directory on platforms that support directory fsync. Only publish `#snapshot = next` and acknowledge success after that durable sequence completes; fail closed on any required sync error.

### CR-05: `common.report` constructs non-canonical NIP-56 tags

**File:** `runtime/common.ts:247-266`
**Issue:** NIP-56 places the report reason directly after the event ID or pubkey (`["e", id, reason]` / `["p", pubkey, reason]`). The implementation inserts `target.relay` before the reason, producing `["e", id, relay, reason]` and `["p", pubkey, relay, reason]`. Consumers therefore interpret the relay string as the report type and may ignore every report. Event targets also discard the contract's optional target pubkey instead of adding the associated `p` report tag.
**Fix:** Emit canonical reason tags with the reason in index 2. For event reports, add the corresponding `p` tag when `target.pubkey` is supplied and valid. Treat `target.relay` as advisory routing metadata rather than inserting it into the NIP-56 report tag.

## Warnings

### WR-01: COMMON envelopes and nested inputs are not closed-decoded

**File:** `runtime/nap_dispatcher.ts:390-405`
**Issue:** Storage uses exact-key validation, but COMMON accepts any `common.*` record and forwards it to `CommonService`. Individual handlers validate only selected fields, so extra top-level keys, extra nested encode/target keys, and invented `common.*` operation names cross the public boundary. This contradicts the phase's exact eight-operation/exact-key contract and makes later contract evolution ambiguous.
**Fix:** Decode the pinned `CommonOutboundMessage` union before service invocation. Enforce the exact keys for each operation and each discriminated nested object, bounded strings/arrays, and reject all other `common.*` types with one stable correlated error.

### WR-02: One malformed cached kind-0 event breaks profile projection

**File:** `runtime/common.ts:122-132`
**Issue:** `JSON.parse(event.content)` is unconditional. A validly signed kind-0 event may contain malformed JSON or a JSON primitive; either case throws or yields a value unsuitable for field projection, and the outer catch turns the whole `getProfile` request into `invalid-request`. The caller's request is valid and cached relay data is untrusted, so corrupt cache content must not be blamed on the napplet or suppress the partial/null projection.
**Fix:** Parse cached metadata in a local guarded block, require a non-array object, and return `profile: null` (while preserving the raw event result if desired) when metadata is malformed.

### WR-03: Concurrent follow/unfollow requests lose contact-list updates

**File:** `runtime/common.ts:174-205`
**Issue:** Each contact mutation independently reads the same cached kind-3 event, constructs a replacement, and awaits publication. Two concurrent requests can therefore publish divergent replacements from the same base. With second-level timestamps, EventStore/relay replaceable-event tie handling may retain either result, so one successful requested change is lost even though both callers receive success.
**Fix:** Serialize kind-3 mutations per account. Re-read the latest committed contact event inside the serialized section, assign a monotonic `created_at`, publish, and update EventStore before allowing the next mutation to derive its template.

---

_Reviewed: 2026-07-31T04:05:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
