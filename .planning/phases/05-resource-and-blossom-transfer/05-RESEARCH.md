# Phase 5: Resource and Blossom Transfer - Research

**Researched:** 2026-07-31
**Domain:** Backend-mediated NAP-RESOURCE/NAP-UPLOAD, Blossom transfers, and SSRF-safe bounded fetching
**Confidence:** HIGH for pinned contracts and repository integration; MEDIUM for Blossom SDK legitimacy, explicitly accepted for exact 5.0.0 unattended use

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Resource policy and response shape
- Advertise availability and closed server-enforced limits through the pinned contract's canonical support envelopes.
- Stream or bound bytes incrementally; never buffer an unbounded response before enforcing the size limit.
- Return canonical denied, unavailable, integrity-failed, and transport-failed results without leaking internal network details.
- Treat MIME allowlists and content sniffing as backend policy; caller hints never override observed bytes.

### URL and redirect safety
- Permit only reviewed HTTP(S), Blossom hash URLs, and BUD-10 forms understood by the pinned SDK.
- Validate every redirect hop, resolved address, destination class, timeout, size, MIME, and integrity value.
- Deny credentials, fragments, ambiguous hosts, unsupported ports/schemes, and private/link-local destinations except explicitly configured loopback cache endpoints.
- Apply tight redirect, byte, and wall-clock budgets with deterministic errors.

### Blossom cache and upload settlement
- Read configured/discovered local Blossom cache endpoints before upstream sources, while preserving existing signature, aggregate, and blob-hash verification before executable release.
- Use the reviewed pinned Blossom SDK surface where it matches the 0.31.0 NAP contracts; isolate unavoidable transport glue behind a small adapter.
- Required upstream success determines the canonical upload result; optional local-cache copies are reported independently and cannot turn required failure into success.
- Report per-server accepted/failed outcomes with stable sanitized reasons and an explicit complete versus partial result.

### Runtime lifecycle
- Keep fetch/upload authority in process-owned services and expose it only through the existing correlated WebSocket dispatcher.
- Cancel in-flight work on request cancellation, connection expiry, or service shutdown, and cap per-connection concurrency.
- Derive policy from validated runtime settings/config without creating browser-owned copies.
- Cover partial, timeout, redirect, integrity, local-cache miss, and mixed upload settlement paths with deterministic fakes.

### the agent's Discretion
Choose concrete safe default budgets, internal module boundaries, and error-code names where the pinned contract does not prescribe them, favoring existing runtime patterns and conservative mobile-friendly limits.

### Deferred Ideas (OUT OF SCOPE)
User-managed arbitrary proxy allowlists, browser-direct uploads, and generalized download caching remain outside this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RES-01 | Napplet can inspect supported resource schemes and coarse runtime limits through the pinned NAP-RESOURCE contract. | Exact `resource.info` request/result shape and conservative policy snapshot are documented below. [VERIFIED: pinned package typings] |
| RES-02 | Napplet can resolve bounded HTTP(S), Blossom, and BUD-10 resources through the backend without gaining unrestricted network access. | URL validation, redirect/DNS revalidation, incremental size enforcement, binary transport, cancellation, and canonical error mapping are specified below. [VERIFIED: pinned package typings and codebase grep] |
| RES-03 | Runtime tries configured local Blossom cache servers before upstream Blossom sources while preserving content hash, MIME, size, redirect, timeout, and SSRF policy checks. | Existing `BlossomCache`/artifact verification seams and the required policy refactor are mapped below. [VERIFIED: codebase grep] |
| UPL-01 | Napplet can inspect configured upload rails and coarse limits and submit bytes through the pinned NAP-UPLOAD contract. | Exact `upload.info`, `upload.upload`, `upload.status`, and `upload.status.changed` shapes plus binary crossing constraints are documented below. [VERIFIED: pinned package typings] |
| UPL-02 | Runtime uploads through a reviewed pinned `blossom-client-sdk` using configured Blossom servers and backend-owned authorization. | SDK 5.0.0 APIs, signer adapter, package audit, and Deno compatibility gate are documented below. [VERIFIED: npm registry and official package source] |
| UPL-03 | User receives explicit per-server upload outcomes, including partial failures, and optional local Blossom copying occurs only after required remote upload success. | A portal-owned settlement model layered over SDK callbacks/results is prescribed below. [VERIFIED: official package source; project decision] |
</phase_requirements>

## Summary

Phase 5 should add three process-owned components: a strict resource policy/fetch service, a Blossom SDK adapter, and a per-window NAP dispatcher that owns in-flight cancellation and upload status. The pinned `@napplet/core@0.31.0` and `@napplet/nap@0.31.0` contracts are closed and concrete: RESOURCE supports `info`, `bytes`, ordered `bytesMany`, and fire-and-forget cancellation; UPLOAD supports `info`, `upload`, `status`, and uncorrelated status pushes. RESOURCE results are single `Blob` values—not a streaming NAP response—so “streaming” applies internally while reading and enforcing the cap, followed by one bounded Blob result. [VERIFIED: pinned package typings]

The existing WebSocket seam cannot carry those byte contracts unchanged. The iframe uses structured clone, but `NappletShell` serializes the message through JSON; `JSON.stringify(new Blob(...))` and `JSON.stringify(new ArrayBuffer(...))` do not preserve bytes, and server results are also JSON serialized. Add a small binary wire codec at the island/server boundary while keeping the iframe-facing pinned envelopes canonical. Do not base64-expand large payloads into the existing 256,000-character JSON command allowance. [VERIFIED: codebase grep and Web platform behavior]

Use exact `blossom-client-sdk@5.0.0` behind a thin portal adapter. The legitimacy seam reports `SUS` due to roughly 320 weekly downloads and missing npm repository metadata, but the user explicitly authorized this pin after review of the npm tarball, published source/API, absence of install scripts, and expected author lineage. Record the residual supply-chain risk rather than adding a human checkpoint. The adapter classifies configured upstreams and the discovered loopback cache, drives required transfers first, validates returned descriptors, then attempts optional local copying and projects the strongest canonical settlement evidence described below. [VERIFIED: npm registry and published source; USER-AUTHORIZED RISK]

**Primary recommendation:** Implement canonical NAP envelopes at the iframe edges, a bounded binary WebSocket transport internally, and separate resource/upload services with one shared destination-policy validator and per-window abort registry. [VERIFIED: pinned package typings and codebase grep]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| RESOURCE/UPLOAD shim envelopes | Browser / Client | API / Backend | The island preserves structured-clone bytes and correlation; it owns no fetch, server, signer, or policy decision. [VERIFIED: pinned package typings and project constraints] |
| Binary WebSocket framing | Browser / Client | API / Backend | Both ends encode/decode bounded byte frames while canonical NAP messages remain unchanged at the iframe boundary. [VERIFIED: codebase grep] |
| URL, DNS, redirect, MIME, size, timeout policy | API / Backend | — | Only the process may authorize outbound network access. [VERIFIED: project constraints; CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html] |
| Blossom read ordering and hash verification | API / Backend | Local Blossom storage | The backend chooses local-first candidates and verifies returned bytes before release. [VERIFIED: codebase grep] |
| Blossom authorization and upload settlement | API / Backend | Configured Blossom servers | The active Applesauce account signs scoped events; the adapter records each remote/cache outcome. [VERIFIED: codebase grep and official package source] |
| Upload status lifetime | API / Backend | Browser / Client | Process state survives socket replacement; the client receives canonical snapshots/pushes only. [VERIFIED: project constraints and pinned package typings] |

## Project Constraints (from AGENTS.md)

- Use Deno/Fresh; keep server-rendered routes and browser interactivity in islands, with backend runtime logic out of islands. [VERIFIED: AGENTS.md]
- Prefer Applesauce and RxJS/functional stream composition; avoid nested subscriptions and duplicate reactive state machines. [VERIFIED: AGENTS.md]
- Use `../napplet` only as a reference; production imports must use pinned npm `@napplet/core@0.31.0` and `@napplet/nap@0.31.0`. [VERIFIED: AGENTS.md]
- Keep napplets sandboxed, NAP access behind the explicit proxy boundary, and persistent/complex Nostr state in the backend. [VERIFIED: AGENTS.md]
- Allow configured local relay/Blossom cache backends without treating them as trust authorities. [VERIFIED: AGENTS.md]
- Use explicit `.ts`/`.tsx` local imports, two-space Deno formatting, double quotes, Fresh `class`, and direct module imports rather than new barrels. [VERIFIED: AGENTS.md]
- Validate external/user input before calls and return explicit errors; do not log secrets, raw bodies, auth events, or internal destinations. [VERIFIED: AGENTS.md]
- Verification is `deno task check` and `deno task test`; commit only intentional files after verification. [VERIFIED: AGENTS.md and deno.json]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@napplet/core` | 0.31.0, published 2026-07-28 | Canonical value types (`ResourceInfo`, `ResourceErrorCode`, `UploadInfo`, `UploadResult`, `UploadStatus`) | Locked production contract. Package gate: SUS only because it is new; repository is the expected Napplet source. [VERIFIED: npm registry and pinned package typings] |
| `@napplet/nap` | 0.31.0, published 2026-07-28 | Exact RESOURCE/UPLOAD envelope unions and shim behavior | Locked production contract. Package gate: SUS only because it is new; repository is the expected Napplet source. [VERIFIED: npm registry and pinned package typings] |
| `blossom-client-sdk` | 5.0.0, published 2026-04-21 | BUD upload/auth/URI helpers and multi-server orchestration | Requirement UPL-02 names the ecosystem SDK; v5 has the required AbortSignal, timeout, auth callback, preflight, and callbacks. [VERIFIED: npm registry and official package source] |
| Deno Web APIs | Deno 2.9.4 | `fetch`, `ReadableStream`, `AbortSignal.any/timeout`, DNS resolution, `Blob`, WebSocket | Already installed runtime and avoids an additional fetch/stream dependency. [VERIFIED: local environment; CITED: https://docs.deno.com/api/web/fetch/] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `applesauce-accounts` | 6.2.0 | Active account and `signEvent` | Adapt `PortalAccounts.signEvent` to the SDK's signer callback for kind-24242 authorization. [VERIFIED: pinned dependency and codebase grep] |
| `nostr-tools` | 2.24.1 | Event template/types and verification primitives | Use existing types/verification only; SDK auth creation accepts a signer function returning a signed event. [VERIFIED: deno.json and official package source] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SDK `multiServerUpload` | Repeated SDK `uploadBlob` calls | Per-server calls give the clearest required/optional settlement and parallelism control, while `multiServerUpload` provides preflight/mirror behavior but is sequential after parallel HEAD and returns only successful descriptors. Prefer a thin portal orchestrator calling reviewed SDK primitives if full failure detail is required. [VERIFIED: official package source] |
| Binary WebSocket frames | Base64 in JSON | Base64 is simpler but expands data and conflicts with the current 256 KB JSON cap; binary preserves bounded bytes without altering canonical iframe envelopes. [VERIFIED: codebase grep] |

**Installation:**

```bash
deno add npm:blossom-client-sdk@5.0.0
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `blossom-client-sdk` | npm | ~2 years; v5 ~3 months | ~320/week | npm metadata says none; package author/docs point to `hzrd149/blossom-client-sdk` | SUS | Exact 5.0.0 pin authorized non-interactively after tarball/source/API/install-script review; isolate behind a thin adapter and preserve the residual risk. [VERIFIED: package-legitimacy seam; USER-AUTHORIZED RISK] |
| `@napplet/core` | npm | current package line published 2026-07-28 | ~1,352/week | `github.com/sandwichfarm/napplet` | SUS (`too-new`) | Already pinned/installed; retain locked dependency. [VERIFIED: npm registry and package-legitimacy seam] |
| `@napplet/nap` | npm | current package line published 2026-07-28 | ~1,503/week | `github.com/sandwichfarm/napplet` | SUS (`too-new`) | Already pinned/installed; retain locked dependency. [VERIFIED: npm registry and package-legitimacy seam] |

**Packages removed due to SLOP verdict:** none. [VERIFIED: package-legitimacy seam]

**Packages flagged as suspicious [SUS]:** `blossom-client-sdk`; existing locked Napplet packages also received mechanical `too-new` warnings. [VERIFIED: package-legitimacy seam]

No package exposes a `postinstall` script. [VERIFIED: npm registry]

## Exact Pinned Contract Surface

### RESOURCE

| Request | Canonical response | Notes |
|---------|--------------------|-------|
| `resource.info { id }` | `resource.info.result { id, info: { schemes, maxBytes?, maxUrls? } }` or `.error` | Advertise only enabled `https` and `blossom` plus the BUD-10 form represented by `blossom`; do not advertise `http` publicly even if configured loopback cache uses it internally. [VERIFIED: pinned package typings] |
| `resource.bytes { id, url }` | `.result { id, blob, mime }` or `.error { id, error, message? }` | Result is one Blob; enforce size incrementally before creating it. [VERIFIED: pinned package typings] |
| `resource.bytesMany { id, urls }` | `.result { id, items[] }` or top-level `.error` | Preserve input order/length; valid individual failures do not discard successful siblings. [VERIFIED: pinned package typings] |
| `resource.cancel { id }` | no response | Abort work and release quota; ignore late completions. [VERIFIED: pinned package typings and shim source] |

Canonical resource error codes are `invalid-request`, `not-found`, `blocked-by-policy`, `timeout`, `too-large`, `unsupported-scheme`, `decode-failed`, `network-error`, and `quota-exceeded`. There is no canonical `integrity-failed`; map hash/MIME-integrity rejection to `decode-failed` with a generic message. Map DNS/private/redirect policy denial to `blocked-by-policy`, deadline to `timeout`, missing blob/404 to `not-found`, and upstream I/O/5xx to `network-error`. [VERIFIED: pinned package typings]

### UPLOAD

| Request | Canonical response | Notes |
|---------|--------------------|-------|
| `upload.info { id }` | `upload.info.result { id, info?: { rails, maxBytes?, mimeTypes? }, error? }` | Advertise `blossom` only; `returns` may list stable fields such as `url`, `fallbackUrls`, `sha256`, `size`, `mimeType`, `nip94`. [VERIFIED: pinned package typings] |
| `upload.upload { id, request }` | `upload.upload.result { id, result?, error? }` | Request data is `Blob | ArrayBuffer` by structured clone; top-level error means no upload was created. [VERIFIED: pinned package typings] |
| `upload.status { id, uploadId }` | `upload.status.result { id, status?, error? }` | Scope `uploadId` to the verified napplet/window/account; never allow cross-tenant probing. [VERIFIED: pinned package typings; project security constraints] |
| server push | `upload.status.changed { status }` | No correlation ID; only push statuses owned by that window. [VERIFIED: pinned package typings] |

`UploadResult` has no partial state or per-server settlement property, but its optional `error` is valid even for `ok: true`/`status: "complete"`. Canonical settlement therefore uses `url` for the first accepted required server, ordered `fallbackUrls` for subsequent accepted required servers and then the accepted optional-local URL, plus deterministic sanitized tokens for every terminal outcome. The closed grammar is at most eight required tokens followed by one local token: `required[N]=accepted|network-error|timeout|rejected|descriptor-mismatch|cancelled` and `local=accepted|unavailable|network-error|timeout|rejected|descriptor-mismatch|cancelled|not-attempted`. Tokens are semicolon-delimited in configured ordinal order and the entire ASCII string is capped at 512 characters. Complete required success with local failure remains `ok: true`/`complete` and carries the local failure token; partial/full required failure is `ok: false`/`failed` and carries every required token plus `local=not-attempted`. This exposes every required and optional-local outcome canonically without hostnames, response bodies, exceptions, or extension fields. Backend diagnostics may retain richer structured detail, while Phase 9 only audits parity. [VERIFIED: exact pinned typings and shim source]

## Architecture Patterns

### System Architecture Diagram

```text
sandboxed napplet
  │ structured-clone canonical RESOURCE/UPLOAD envelope (Blob preserved)
  ▼
NappletShell island
  │ JSON control + bounded binary frame on existing owned WebSocket
  ▼
runtime endpoint closed codec ──► per-window request/abort/quota registry
                                      │
                  ┌───────────────────┴──────────────────┐
                  ▼                                      ▼
        ResourceService                         BlossomTransferService
    URL/DNS/redirect policy                 SDK adapter + active signer
    incremental body limiter                required upstream settlement
    MIME sniff + hash verify                descriptor/hash verification
                  │                                      │
                  ▼                                      ▼
     local cache → reviewed upstreams         configured upstreams → optional local copy
                  └───────────────────┬──────────────────┘
                                      ▼
                     canonical result/status envelope
                         + bounded binary Blob frame
                                      ▼
                              sandboxed napplet
```

### Recommended Project Structure

```text
runtime/
├── resource_policy.ts       # URL/DNS/redirect classification and limits
├── resource_service.ts      # scheme dispatch, bounded read, MIME/hash validation
├── blossom_transfer.ts      # SDK adapter and required/optional settlement
├── nap_dispatcher.ts        # RESOURCE/UPLOAD closed codecs and per-window lifecycle
├── binary_transport.ts      # control metadata and binary frame correlation
└── blossom_cache.ts         # reuse/refactor local-first cache primitive
tests/
├── resource_policy_test.ts
├── resource_service_test.ts
├── blossom_transfer_test.ts
├── nap_dispatcher_test.ts
└── binary_transport_test.ts
```

### Pattern 1: Manual Redirect Loop with Revalidation

**What:** Call fetch with `redirect: "manual"`, validate the initial URL and every `Location` target, resolve all A/AAAA addresses before each hop, reject any disallowed address, and cap hop count. Deno fetch follows redirects by default, while OWASP recommends disabling automatic redirects and validating resolved addresses to prevent redirect and DNS-pinning bypasses. [CITED: https://docs.deno.com/api/web/fetch/] [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html]

**When to use:** Every HTTP(S) resource fetch, including URLs produced from Blossom/BUD-10 hints. The configured exact loopback cache origin is a separate allowlisted destination class, never a general exception. [VERIFIED: project decisions]

### Pattern 2: Incremental Limit, Then Canonical Blob

**What:** Check `Content-Length` when present, then consume `response.body` chunk-by-chunk, abort/cancel immediately when accumulated bytes exceed the closed cap, sniff from a bounded prefix, hash while consuming, and construct a Blob only after checks pass. [VERIFIED: pinned package's single-Blob response contract; CITED: https://docs.deno.com/api/web/fetch/]

**When to use:** All RESOURCE reads. `response.arrayBuffer()` in current `blossom_cache.ts` is not suitable because it buffers before enforcing a cap. [VERIFIED: codebase grep]

### Pattern 3: Owned In-flight Registry

**What:** Key controllers by `connectionId/windowId/requestId`; reject duplicate IDs, cap active count, combine manual abort with a wall-clock deadline, abort on `resource.cancel`, window expiry, replacement, and runtime destroy, and delete entries in `finally`. [VERIFIED: existing `ConnectionRegistry` ownership/subscription pattern and Deno AbortSignal API]

**When to use:** RESOURCE requests and uploads. Socket close alone should not cancel during reconnect grace; connection expiry should. This requires a cleanup callback from the existing connection/window registry, not only the route's WebSocket close listener. [VERIFIED: codebase grep and locked context]

### Pattern 4: Explicit Upload Settlement

**What:** Validate and hash bytes first; execute configured required servers using reviewed SDK primitives with one shared abort signal and server-scoped auth; accept only descriptors whose `sha256` and `size` match; classify every server as accepted/failed with sanitized stable reason; only after required success attempt optional local copying. [VERIFIED: official package source and project decisions]

**When to use:** `upload.upload`. Do not equate the SDK result `Map` with full settlement because failed servers are omitted and exposed only through callbacks/errors. [VERIFIED: official package source]

### Anti-Patterns to Avoid

- **JSON-stringifying Blob/ArrayBuffer:** bytes become unusable; encode a bounded binary frame. [VERIFIED: current island transport and pinned contract]
- **Automatic redirects:** a validated public URL can redirect to a forbidden destination. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html]
- **Hostname-only SSRF checks:** resolve and classify every A/AAAA result at every hop; a literal-host regex alone misses DNS rebinding and IPv6 forms. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html]
- **Trusting `Content-Length`/`Content-Type`:** both are advisory; enforce actual bytes and sniffed content. [VERIFIED: locked context]
- **Using current `BlossomCache.fetch` unchanged:** it calls `arrayBuffer`, follows redirects implicitly upstream, and does not validate size/MIME/destination/hash itself. Artifact resolution verifies hash later, but generic RESOURCE needs the checks inside its boundary. [VERIFIED: codebase grep]
- **Treating SDK success as policy success:** validate returned descriptor and calculate required/optional settlement explicitly. [VERIFIED: official package source and locked context]
- **Cancel on transient socket close:** this defeats reconnect grace; cancel on explicit request, window expiry, or service shutdown. [VERIFIED: existing connection lifecycle and locked context]

## Conservative Default Budgets

These values are project recommendations, not contract requirements: advertise `maxBytes: 5_242_880` (5 MiB), `maxUrls: 8`, allow 2 active byte-bearing operations per window, 10 seconds wall-clock per resource, 30 seconds per upload, and at most 3 redirects. Limit URL text to 2,048 characters, status retention to 10 minutes or 64 terminal uploads per window, and only ports 80/443 for public HTTP(S); exact configured loopback cache endpoints may use their configured port. [ASSUMED]

The planner should keep all values centralized in backend policy and test the advertised values against enforcement. If product needs exceed 5 MiB, increase the cap deliberately with binary transport and memory/concurrency measurements rather than changing only `resource.info`. [ASSUMED]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Blossom URI parsing | Regex accepting vaguely hash-like strings | SDK `parseBlossomURI`/`blossomURIFromURL`, followed by portal policy validation | BUD-10 includes `xs`, `as`, extension, and optional size. [VERIFIED: official package source] |
| Blossom auth event construction/header | Custom kind-24242 JSON/base64 | SDK `createUploadAuth` and `encodeAuthorizationHeader` with `PortalAccounts.signEvent` | Keeps tag/server/hash/expiration semantics in the reviewed SDK. [VERIFIED: official package source and codebase grep] |
| Upload HTTP negotiation | Custom HEAD/auth/payment retry state machine | SDK `uploadBlob`/reviewed multi-server primitives | SDK handles BUD-06 preflight and auth retry; portal still owns settlement and descriptor validation. [VERIFIED: official package source] |
| MIME classification | Caller hint or upstream header | A maintained byte-signature classifier already accepted by the project, or a narrow first-party allowlist for the exact supported media signatures | Caller/upstream metadata is untrusted. No suitable dependency is currently installed, so planner must make this an explicit Wave 0 decision rather than silently invent broad sniffing. [VERIFIED: codebase grep; ASSUMED] |
| SSRF policy | URL regex alone | URL parser + DNS resolution + IP classification + manual redirect loop + network egress controls where deployed | SSRF protection is multi-layered. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html] |

## Common Pitfalls

### Pitfall 1: Contract/Wire Mismatch
**What goes wrong:** RESOURCE results or upload requests arrive as `{}` because JSON does not preserve Blob/ArrayBuffer. **How to avoid:** add binary transport tests before service implementation. **Warning signs:** codec tests only use strings/objects. [VERIFIED: pinned contract and codebase grep]

### Pitfall 2: Cancel ID Ambiguity
**What goes wrong:** `resource.cancel` aborts another window's request or a reused late request. **How to avoid:** namespace by owner plus ID, reject duplicates while active, delete deterministically, and ignore unknown/late cancel. [VERIFIED: existing ownership model]

### Pitfall 3: Redirect/DNS TOCTOU
**What goes wrong:** validation resolves a public address but fetch resolves a different private address, or a redirect crosses classes. **How to avoid:** manual redirects, validate each hop/all answers, and use network-level egress restrictions or a fetch connector pinned to the validated address where available. Deno's ordinary fetch API does not expose an address-pinning option in the reviewed docs. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html] [ASSUMED]

### Pitfall 4: bytesMany Becomes All-or-Nothing
**What goes wrong:** one failed URL rejects successful siblings. **How to avoid:** validate envelope globally, then settle each URL independently in input order; use a top-level error only for malformed/over-quota requests. [VERIFIED: pinned package typings]

### Pitfall 5: Upload Result Overclaims Replication
**What goes wrong:** one accepted server yields `complete` despite failed required servers, or optional cache failure flips remote success. **How to avoid:** define required-server policy centrally and test complete, partial required failure, and optional-copy failure separately. [VERIFIED: locked context]

### Pitfall 6: Descriptor Is Trusted
**What goes wrong:** a server returns a URL/hash/size for different bytes. **How to avoid:** pre-hash input, validate descriptor hash/size, restrict returned URLs to accepted server origins/hash paths, and sanitize all errors. [VERIFIED: sibling reference CLI tests and project trust model]

### Pitfall 7: Upload Status Leaks Across Napplets
**What goes wrong:** guessed `uploadId` reveals another window/account's progress or URLs. **How to avoid:** store owner tuple with each upload and return a generic unavailable error for foreign/expired IDs. [VERIFIED: project ownership model]

## Code Examples

### Canonical RESOURCE dispatch shape

```typescript
// Source: @napplet/nap@0.31.0 pinned typings
switch (message.type) {
  case "resource.info":
    return { type: "resource.info.result", id: message.id, info: policy.info };
  case "resource.cancel":
    requests.cancel(owner, message.id);
    return undefined;
  case "resource.bytes":
    return await resources.bytes(owner, message);
  case "resource.bytesMany":
    return await resources.bytesMany(owner, message);
}
```

### SDK signer adapter

```typescript
// Source: blossom-client-sdk@5.0.0 package typings + runtime/accounts.ts
const onAuth = async (server: URL, sha256: string) =>
  await createUploadAuth(
    (template) => accounts.signEvent(template),
    sha256,
    { servers: [server.hostname], expiration: nowSeconds + 60 },
  );
```

### Combined cancellation/deadline

```typescript
// Source: Deno AbortSignal documentation and existing signer_service.ts pattern
const controller = new AbortController();
const signal = AbortSignal.any([
  controller.signal,
  AbortSignal.timeout(policy.wallClockMs),
]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| RESOURCE errors listed as 8 codes in package README | 0.31.0 typings include `invalid-request` as a ninth code | Current pinned 0.31.0 | Generate behavior from typings, not the older README prose. [VERIFIED: pinned package README and typings] |
| Blossom SDK 4.1.0 | 5.0.0 | 2026-04-21 | v5 source includes current multi-server preflight/rejection callbacks and BUD-10 helpers; pin exactly. [VERIFIED: npm registry and official package source] |
| Current cache `arrayBuffer()` and implicit redirect behavior | Incremental bounded reads and manual redirect validation | Phase 5 | Required for generic untrusted RESOURCE, not merely trusted artifact hashes. [VERIFIED: codebase grep and locked context] |

**Deprecated/outdated:** Do not copy the sibling CLI's bespoke upload implementation into production; use it only as behavioral evidence for descriptor verification, because UPL-02 locks the ecosystem SDK. [VERIFIED: project constraints and codebase grep]

## Resolved Assumptions

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 — RESOLVED | Use 5 MiB/8 URL/2 concurrent/10s/30s/3 redirect defaults, centralized and tested against advertised enforcement. | Conservative Default Budgets | User delegated conservative safe defaults. |
| A2 — RESOLVED | Use a narrow first-party passive signature table for PNG, JPEG, GIF, WebP, AVIF, plain text, JSON, and PDF; reject active/unknown types. | Don't Hand-Roll | Avoids another unreviewed dependency. |
| A3 — RESOLVED | Ordinary Deno fetch cannot prove address pinning; disable production network use in 05-01, revalidate every hop/all answers in 05-02, and retain network egress as defense in depth. | Pitfall 3 | Residual rebinding risk is explicit and revisited in Phase 9. |

## Resolved Questions

1. **RESOLVED — Required servers:** Every configured non-loopback Blossom server is required, matching existing OUTBOX all-required semantics. Optional exact-loopback copying starts only after every required server accepts. [USER-AUTHORIZED DEFAULT]

2. **RESOLVED — Per-server representation:** Add no fields. Accepted required destinations use `url` and ordered `fallbackUrls`; an accepted optional-local destination is appended last. The optional canonical `error` field carries the bounded stable required/local token grammar for mixed outcomes and may accompany `ok: true`/`complete`. Thus Phase 5 exposes every required and optional-local outcome; Phase 9 only audits parity. [VERIFIED: exact pinned typings/shim]

3. **RESOLVED — MIME set:** Support PNG, JPEG, GIF, WebP, AVIF, plain text, JSON, and PDF by observed bytes; reject HTML, SVG, script, unknown, and conflicting types. [USER-AUTHORIZED DEFAULT]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Deno | runtime/tests | ✓ | 2.9.4 | — [VERIFIED: local environment] |
| npm | registry/package audit | ✓ | 10.9.8 | Deno npm resolver after pinning [VERIFIED: local environment] |
| `@napplet/core` | contracts | ✓ | 0.31.0 | none; locked [VERIFIED: node_modules] |
| `@napplet/nap` | envelopes/shims | ✓ | 0.31.0 | none; locked [VERIFIED: node_modules] |
| `blossom-client-sdk` | upload/BUD helpers | ✗ | registry 5.0.0 | executor adds exact authorized pin behind adapter and records lock resolution [VERIFIED: npm registry; USER-AUTHORIZED RISK] |
| Local Blossom server | cache integration tests | runtime discovery only; not required for unit tests | default probe `127.0.0.1:24242` | deterministic fake fetch/server [VERIFIED: codebase grep] |

**Missing dependencies with no fallback:** none for planning; exact SDK installation is authorized for unattended execution. [VERIFIED: environment audit; USER-AUTHORIZED RISK]

**Missing dependencies with fallback:** live Blossom service; deterministic fake transports cover automated tests. [VERIFIED: established test pattern]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Active backend Applesauce account is required for Blossom authorization; signer never crosses the boundary. [VERIFIED: codebase and project constraints] |
| V3 Session Management | yes | Existing same-origin WebSocket owner tuple/reconnect token plus per-window operation ownership. [VERIFIED: codebase grep] |
| V4 Access Control | yes | Capability/domain check and `(connectionId, windowId, napplet identity, account)` scoping before dispatch/status. [VERIFIED: project architecture] |
| V5 Input Validation | yes | Closed codecs; URL/DNS/IP/redirect validation; byte/MIME/hash/descriptor validation. [VERIFIED: pinned contracts and locked context] |
| V6 Cryptography | yes | Web Crypto SHA-256 and SDK/Applesauce signed events; never hand-roll hashes or signatures. [VERIFIED: codebase and official SDK source] |

### Known Threat Patterns for Deno/Fresh Resource Proxy

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF to loopback/private/link-local/metadata | Information Disclosure / Elevation | Allowlisted schemes, all-address DNS classification, exact cache-origin exception, manual redirects, network egress defense. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html] |
| Redirect or DNS rebinding bypass | Spoofing / Information Disclosure | Revalidate each hop and actual destination; cap redirects. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html] |
| Memory/network exhaustion | Denial of Service | Header precheck plus incremental byte cap, wall deadline, concurrency and aggregate quotas, abort cleanup. [VERIFIED: locked context] |
| MIME confusion/active content | Tampering | Byte sniff, allowlist, canonical MIME, reject mismatch; caller/upstream hints are non-authoritative. [VERIFIED: locked context] |
| Malicious Blossom descriptor | Spoofing / Tampering | Verify SHA-256, size, URL origin/path, and NIP-94 fields before acceptance. [VERIFIED: sibling CLI tests and project trust model] |
| Cross-window cancellation/status probing | Tampering / Information Disclosure | Owner-namespaced IDs and generic unavailable errors. [VERIFIED: existing ownership model] |
| Signed auth replay/overbreadth | Spoofing / Elevation | Short expiration, exact hash and server tags, backend-only signer, bounded reuse store. [VERIFIED: official package source and Blossom BUD-11 docs] |

## Validation Architecture

Skipped because `.planning/config.json` explicitly sets `workflow.nyquist_validation` to `false`. [VERIFIED: project config]

Even though the formal section is disabled, the phase plan must add focused Deno tests because RES/UPL and QLT requirements demand them. Start with Wave 0 binary codec and closed envelope fixtures, then policy/service/dispatcher tests. Required cases: malformed/oversized frames, Blob and ArrayBuffer round-trip, exact `info`, ordered mixed `bytesMany`, cancel/late completion, duplicate IDs, per-window quota, every forbidden IP class (IPv4/IPv6), credentials/fragments/ports, DNS multi-answer rejection, redirect-to-private, redirect cap, absent/lying content length, mid-stream overflow, timeout, MIME mismatch, Blossom cache miss/fallback/hash mismatch, SDK auth scoping, descriptor mismatch, every-required success, mixed required failure, optional cache failure, status ownership/expiry, connection grace versus expiry, and shutdown cancellation. [VERIFIED: requirements, locked context, and existing test conventions]

Suggested quick commands are individual files such as `deno test -A tests/resource_policy_test.ts` and `deno test -A tests/blossom_transfer_test.ts`; the phase gate remains `deno task check && deno task test`. [VERIFIED: deno.json]

## Sources

### Primary (HIGH confidence)

- `node_modules/@napplet/core/dist/index.d.ts` — exact 0.31.0 resource/upload values. [VERIFIED: pinned package typings]
- `node_modules/@napplet/nap/dist/resource/types.d.ts`, `dist/upload/types.d.ts`, and compiled shim sources — exact envelopes, cancellation, and status behavior. [VERIFIED: pinned package source]
- `runtime/transport.ts`, `routes/api/runtime.ts`, `islands/NappletShell.tsx`, `runtime/connections.ts`, `runtime/blossom_cache.ts`, `runtime/artifacts.ts`, and tests — current transport/lifecycle/cache integration. [VERIFIED: codebase grep]
- `blossom-client-sdk@5.0.0` published tarball source and typings — exact SDK APIs and implementation flow. [VERIFIED: npm registry and official package source]
- https://github.com/hzrd149/blossom — canonical BUD index/endpoints. [CITED: https://github.com/hzrd149/blossom]
- https://docs.deno.com/api/web/fetch/ and https://docs.deno.com/examples/fetch_timeout/ — fetch redirect/signal behavior. [CITED: https://docs.deno.com/api/web/fetch/] [CITED: https://docs.deno.com/examples/fetch_timeout/]

### Secondary (MEDIUM confidence)

- https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html — redirect, DNS, address, and scheme SSRF controls. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html]
- https://github.com/hzrd149/blossom-server — implementation evidence for current BUD endpoints and auth structure. [CITED: https://github.com/hzrd149/blossom-server]

### Tertiary (LOW confidence)

- None; planning resolved the former policy questions with the user's authorized conservative defaults and the exact canonical `error` token representation.

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — locked Napplet packages and Deno are verified; the SDK API/source is verified and its remaining legitimacy risk is explicitly accepted for exact 5.0.0 unattended use.
- Architecture: HIGH — derived from exact pinned envelopes and current repository transport/lifecycle.
- Pitfalls: HIGH — directly demonstrated by source/contract mismatch and authoritative SSRF guidance.

**Research date:** 2026-07-31
**Valid until:** 2026-08-07 (fast-moving package and security-sensitive integration)
