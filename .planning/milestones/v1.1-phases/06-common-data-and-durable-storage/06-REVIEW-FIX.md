---
phase: 06-common-data-and-durable-storage
fixed_at: 2026-07-31T05:00:00Z
review_path: .planning/phases/06-common-data-and-durable-storage/06-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-07-31T05:00:00Z
**Source review:** `.planning/phases/06-common-data-and-durable-storage/06-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 8
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: Accepted-manifest replacement does not revoke an existing window authority

**Files modified:** `runtime/catalog.ts`, `runtime/portal_runtime.ts`
**Commit:** 70cf658
**Applied fix:** Current authority now requires exact membership in accepted catalog truth; successful replacement and uninstall synchronously revoke and abort obsolete window work.

### CR-02: Account changes during signing can publish an event under the wrong identity

**Files modified:** `runtime/accounts.ts`, `runtime/common.ts`, `runtime/outbox.ts`
**Commits:** 35346da, 7f00e98, 68ec484
**Applied fix:** COMMON publication pins a host-only account generation through signing, relay selection, relay publication, result validation, and EventStore commit.

### CR-03: COMMON requests have no per-window concurrency or work quota

**Files modified:** `runtime/nap_dispatcher.ts`, `runtime/portal_runtime.ts`, `runtime/event_runtime.ts`, `runtime/common.ts`
**Commits:** 47c535a, 1b32f9c
**Applied fix:** COMMON uses the per-window operation registry, rejects duplicate IDs, caps active work at eight, cancels on authority generation changes, suppresses late settlement, and releases completed refresh cleanup entries.

### CR-04: Snapshot replacement is not crash-durable

**Files modified:** `runtime/storage_store.ts`
**Commit:** cb9a4ea
**Applied fix:** Temporary snapshots are fully written and file-synced before rename, then the containing directory is synced on platforms supporting directory fsync.

### CR-05: `common.report` constructs non-canonical NIP-56 tags

**Files modified:** `runtime/common.ts`
**Commit:** 1b32f9c
**Applied fix:** Report reasons now occupy tag index 2; event reports add a canonical associated `p` tag and relay hints are excluded from NIP-56 tags.

### WR-01: COMMON envelopes and nested inputs are not closed-decoded

**Files modified:** `runtime/nap_dispatcher.ts`
**Commit:** 47c535a
**Applied fix:** The dispatcher now accepts exactly eight COMMON operations with exact top-level and discriminated nested keys and bounded inputs.

### WR-02: One malformed cached kind-0 event breaks profile projection

**Files modified:** `runtime/common.ts`
**Commit:** 1b32f9c
**Applied fix:** Cached metadata parsing is isolated and requires a non-array object; malformed content yields a null profile without rejecting the caller.

### WR-03: Concurrent follow/unfollow requests lose contact-list updates

**Files modified:** `runtime/common.ts`
**Commit:** 1b32f9c
**Applied fix:** Contact mutations serialize per account, re-read committed truth inside the queue, and use monotonic replacement timestamps.

## Verification

- `deno task check`
- `deno task test` — 189 passed
- `deno task build`

---

_Fixed: 2026-07-31T05:00:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
