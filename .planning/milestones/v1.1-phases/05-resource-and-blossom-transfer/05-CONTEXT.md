# Phase 5: Resource and Blossom Transfer - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Expose pinned NAP RESOURCE and UPLOAD envelopes through the backend runtime, with bounded reads and explicit multi-server Blossom upload settlement. This phase owns transport policy and outcomes; it does not expand catalog authority or move network access into napplet frames.

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `runtime/blossom_cache.ts` already provides loopback discovery, local-first reads, upstream fallback, and sanitized health.
- `runtime/artifacts.ts` already retains signature, aggregate, and blob-hash verification after cache reads.
- Existing WebSocket command correlation, capability dispatch, runtime settings, and test helpers provide the integration seam.

### Established Patterns
- Process-owned services expose immutable projections; browser islands receive only canonical correlated messages.
- Closed codecs validate all untrusted messages before dispatch, and tests use deterministic injected dependencies.
- Local caches improve availability but never become an independent trust authority.

### Integration Points
- Extend the NAP dispatcher/capability registry and pinned contract adapter for RESOURCE and UPLOAD.
- Reuse validated Blossom settings and the existing cache boundary for server ordering.
- Add focused policy, dispatcher, and transport tests under `tests/`.

</code_context>

<specifics>
## Specific Ideas

Favor explicit settlement detail over a single upload boolean, and preserve the project's stream-first behavior by making progress/cancellation possible where supported by the pinned envelopes.

</specifics>

<deferred>
## Deferred Ideas

User-managed arbitrary proxy allowlists, browser-direct uploads, and generalized download caching remain outside this phase.

</deferred>
