---
phase: 05-resource-and-blossom-transfer
plan: "01"
subsystem: runtime-transport
tags: [websocket, binary, resource, upload, policy]
dependency_graph:
  requires: [04-installed-napplet-discovery]
  provides: [owner-bound-binary-transport, closed-transfer-policy, fixed-resource-tracer]
  affects: [05-02-resource-policy, 05-03-blossom-upload]
tech_stack:
  added: []
  patterns: [bounded-binary-frames, authenticated-owner-binding, backend-policy-snapshot]
key_files:
  created: [runtime/binary_transport.ts, tests/binary_transport_test.ts]
  modified: [runtime/transport.ts, routes/api/runtime.ts, islands/NappletShell.tsx]
key_decisions:
  - "Bind binary frames to the authenticated socket owner supplied out of band; owner identifiers never appear in untrusted bytes."
  - "Select the no-network tracer by one fixed HTTPS URL while preserving arbitrary bounded canonical request IDs."
  - "Generate RESOURCE and UPLOAD inspection data from one immutable backend transfer policy snapshot."
metrics:
  duration: 14min
  completed: 2026-07-31
status: complete
---

# Phase 5 Plan 1: Binary Resource and Transfer Policy Summary

Owner-bound binary WebSocket framing carries one fixed in-process RESOURCE payload into a canonical iframe Blob, while immutable backend limits advertise closed RESOURCE and UPLOAD capabilities without enabling network transfer.

## Performance

- **Duration:** 14 min
- **Tasks:** 2
- **Files:** 5
- **Tests:** 11 focused tests plus full Deno formatting, lint, and type checks

## Accomplishments

- Added a strict versioned binary frame codec with bounded UTF-8 IDs, 5 MiB payload enforcement, deterministic fragment/concatenation decoding, and authenticated owner binding.
- Routed a fixed HTTPS tracer identifier through the verified iframe, existing WebSocket, in-process backend bytes, and back into a canonical `resource.bytes.result` Blob without calling `fetch`.
- Added exact RESOURCE/UPLOAD control-envelope decoding and immutable canonical info snapshots for `https`, `blossom`, the Blossom upload rail, limits, MIME policy, and return fields.
- Preserved existing JSON RELAY, OUTBOX, and catalog traffic and mapped unavailable production transfers to generic canonical errors.

## Task Commits

1. **Task 1 RED: Binary resource tracer tests** - `cb85adb`
2. **Task 1 GREEN: Binary runtime seam** - `0b8e6fb`
3. **Task 2 RED: Closed policy tests** - `207c0e4`
4. **Task 2 GREEN: Policy inspection snapshots** - `a4e232c`
5. **Rule 1 fix: Preserve request correlation IDs** - `257b4a3`

## Files Created/Modified

- `runtime/binary_transport.ts` - Binary frame format, stream decoder, bounds, and owner-scoped active request registry.
- `runtime/transport.ts` - Exact RESOURCE/UPLOAD codecs and immutable backend transfer policy/info projections.
- `routes/api/runtime.ts` - Binary/text WebSocket separation, fixed in-process resource handler, and canonical info/error results.
- `islands/NappletShell.tsx` - Verified-source control interception, binary request/result handling, and canonical Blob reconstruction.
- `tests/binary_transport_test.ts` - Codec, ownership, limits, no-fetch tracer, Blob, policy, and closed-envelope coverage.

## Decisions Made

- Frame bytes contain only magic/version/kind/correlation/payload; authenticated connection/window ownership is injected by the receiving socket.
- The tracer URL is fixed and cannot select a destination; arbitrary bounded correlation IDs are retained end to end.
- HTTP remains unadvertised, and production resource/upload network execution stays unavailable until Plan 05-02 installs every-hop policy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved canonical caller correlation IDs**

- **Found during:** Overall Task 2 verification
- **Issue:** The initial tracer selected its fixed source using both URL and request ID, which unnecessarily replaced canonical caller-chosen correlation semantics.
- **Fix:** Bound tracer selection only to the fixed URL while retaining the existing 128-byte ID bound and owner-scoped duplicate protection.
- **Files modified:** `islands/NappletShell.tsx`
- **Commit:** `257b4a3`

## Known Stubs

None. Production network transfer is deliberately closed by this plan and scheduled for Plan 05-02, not represented by placeholder data or an incomplete success path.

## Threat Flags

None. The new WebSocket binary surface is covered by the plan threat model and enforces owner, kind, version, length, correlation, concurrency, and payload boundaries.

## Verification

- `deno test -A tests/binary_transport_test.ts tests/runtime_contract_test.ts tests/iframe_bridge_test.ts` — 11 passed
- `deno task check` — passed

## Self-Check: PASSED

- All five planned files exist.
- Commits `cb85adb`, `0b8e6fb`, `207c0e4`, `a4e232c`, and `257b4a3` exist in git history.
- No tracked files were deleted and unrelated `.planning/research/.cache` files were preserved.
