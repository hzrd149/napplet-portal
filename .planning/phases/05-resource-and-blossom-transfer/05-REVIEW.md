---
phase: 05-resource-and-blossom-transfer
reviewed: 2026-07-31T00:00:00Z
depth: deep
files_reviewed: 21
files_reviewed_list:
  - deno.json
  - islands/NappletShell.tsx
  - main.ts
  - routes/api/runtime.ts
  - runtime/binary_transport.ts
  - runtime/blossom_cache.ts
  - runtime/blossom_transfer.ts
  - runtime/nap_dispatcher.ts
  - runtime/portal_runtime.ts
  - runtime/resource_policy.ts
  - runtime/resource_service.ts
  - runtime/transport.ts
  - shell/connection.ts
  - tests/artifact_resolver_test.ts
  - tests/binary_transport_test.ts
  - tests/blossom_cache_test.ts
  - tests/blossom_transfer_test.ts
  - tests/end_to_end_test.ts
  - tests/nap_dispatcher_test.ts
  - tests/resource_policy_test.ts
  - tests/resource_service_test.ts
findings:
  critical: 4
  warning: 3
  info: 0
  total: 7
status: resolved
---

# Phase 5: Code Review Report

**Reviewed:** 2026-07-31T00:00:00Z
**Depth:** deep
**Files Reviewed:** 21
**Status:** resolved

## Summary

The Phase 5 transport, resource policy, bounded reader, Blossom settlement, ownership, cancellation, and production wiring were traced across the browser iframe, WebSocket endpoint, dispatcher, services, and tests. The implementation has four ship-blocking defects: normal resource payloads cannot reach napplets, the DNS authorization remains vulnerable to rebinding, uploads bypass the destination policy entirely, and the advertised resource deadline is applied once per candidate rather than per operation. Three additional correctness and test-reliability gaps hide or misreport failures.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Production resource payloads are discarded or delivered as malformed duplicate results

**File:** `islands/NappletShell.tsx:74-91`

**Issue:** `decodeResourceBinaryResult` accepts a payload only when its ID was previously opened in `ActiveBinaryRequests`, then reconstructs every accepted response as `text/plain`. The shell opens that registry only for the fixed tracer URL at lines 318-335. Normal `resource.bytes` and all `resource.bytesMany` requests are forwarded as JSON at lines 338-371 without registering their IDs (or the server's `${id}:${index}` child IDs). On success the server sends a JSON `resource.bytes.result`/`resource.bytesMany.result` without Blob data first and then binary frames (`routes/api/runtime.ts:113-133`). The shell forwards that incomplete JSON result to the iframe at lines 494-533, while the following binary frames fail `requests.settle()` and are discarded. Consequently the fixed tracer passes, but the implemented production RESOURCE API cannot return arbitrary bytes; even if registration were added, all non-text MIME types would be corrupted to `text/plain`.

**Fix:** Define one correlated response protocol that joins metadata and bytes before emitting exactly one canonical NAP result. Register every normal request, retain server-provided MIME and batch-index metadata by correlation ID, accept the corresponding binary frames, and post the completed Blob result only after all expected frames arrive. Add an actual browser/WebSocket integration test for one PNG `resource.bytes` response and a mixed `bytesMany` response.

### CR-02: DNS validation is a check-then-use SSRF defense that does not constrain the address fetched

**File:** `runtime/resource_service.ts:470-485`

**Issue:** `ResourceDestinationPolicy.authorize()` resolves and validates public A/AAAA answers, but returns only the URL. `fetch()` then performs a separate DNS resolution and is not pinned to any authorized address. An attacker-controlled hostname can answer the policy lookup with a public address and rebind before the fetch lookup to loopback, link-local, RFC1918, or cloud metadata space. The comment acknowledges the gap, but production starts Deno with `-A` and this phase does not install the required egress control, so the stated SSRF boundary is not actually enforced. Revalidating redirect URLs does not close the same race on each hop.

**Fix:** Make authorization and connection atomic: use an HTTP client/connector that dials one of the validated IPs while preserving the original Host/SNI, or enforce an OS/container egress allowlist that blocks all forbidden ranges and verify it in deployment tests. Do not describe DNS pre-resolution alone as an SSRF boundary.

### CR-03: Blossom uploads bypass the destination policy and permit private-network requests

**File:** `runtime/blossom_transfer.ts:286-310`

**Issue:** Required upload servers are rejected only when the literal hostname is `localhost`, `::1`, or starts with `127.`. Production filtering repeats the same textual check (`main.ts:149-157`). Configured names resolving to private or link-local addresses, literal `10/8`, `172.16/12`, `192.168/16`, IPv4-mapped IPv6, and other forbidden ranges pass through to `Actions.uploadBlob`. Settings also permit HTTP URLs and arbitrary ports. This creates a server-side request primitive carrying a valid signed Blossom authorization event and attacker-controlled upload bytes to internal services.

**Fix:** Apply a dedicated upload destination policy before signing and before every network hop. Require the intended scheme/ports, reject credentials/fragments, resolve all A/AAAA answers through the same forbidden-range checks, prevent DNS rebinding as described in CR-02, and either disable redirects or authorize each redirect target. Validate settings on save as well as at use time.

### CR-04: The resource deadline resets for every Blossom candidate

**File:** `runtime/resource_service.ts:425-440`

**Issue:** `#blossomRead` tries the local cache and up to eight upstream servers sequentially, while each call to `#fetchBytes` creates a fresh `resourceDeadlineMs` timer at lines 462-466. A request advertised and configured with a 10-second deadline can therefore occupy a dispatcher slot for roughly 90 seconds. Two such requests exhaust the per-window active-operation quota for that duration. This violates the resource bound and makes cancellation/availability behavior depend on the number of configured servers.

**Fix:** Create one deadline signal at the public operation boundary and pass that same signal through every candidate and redirect. Each attempt may have a shorter per-attempt timeout, but it must never extend the absolute operation deadline.

## Warnings

### WR-01: Binary upload transport silently drops canonical request fields

**File:** `routes/api/runtime.ts:208-216`

**Issue:** The browser accepts a full `UploadRequest` but serializes only its raw `data` into the binary frame (`islands/NappletShell.tsx:350-363`). The server reconstructs a new request containing only `rail` and `data`, silently losing `mimeType`, `filename`, `caption`, `noTransform`, and `metadata`. Napplets receive behavior different from the pinned API contract, and future policy decisions cannot use the caller's declared options.

**Fix:** Add a bounded metadata header/envelope correlated with the binary body, validate it with `decodeUploadRequest`, and reconstruct the complete request. Alternatively reject unsupported optional fields explicitly instead of accepting and discarding them.

### WR-02: Caller cancellation is reported as a timeout by the resource service

**File:** `runtime/resource_service.ts:486-493`

**Issue:** Any aborted combined signal is converted to `ResourceServiceError("timeout")`, including an already-aborted caller signal and explicit `resource.cancel`. The dispatcher currently suppresses responses for its own controller, but direct service consumers and batch-item results cannot distinguish cancellation from an expired deadline, undermining stable error semantics and observability.

**Fix:** Track the deadline controller separately from the external signal. Return/throw a distinct cancellation result when the caller signal aborted, and use `timeout` only when the deadline controller fired.

### WR-03: Production transport coverage is source-text matching, so broken data flow passes

**File:** `tests/end_to_end_test.ts:172-207`

**Issue:** The test named “production runtime wires the complete RESOURCE and UPLOAD seam” merely checks whether action-name strings and constructor names occur in concatenated source files. It passes despite CR-01 because it never sends a normal resource request through the iframe/WebSocket endpoint or verifies that a Blob with the correct MIME and bytes returns exactly once. This is a test reliability defect, not merely missing coverage: the assertion claims an end-to-end property it does not exercise.

**Fix:** Replace the source inspection with behavioral integration tests against the built Fresh server (or a faithful socket harness) covering normal bytes, batches, upload metadata, cancellation, reconnect ownership, malformed frames, and correct MIME reconstruction.

---

_Reviewed: 2026-07-31T00:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
