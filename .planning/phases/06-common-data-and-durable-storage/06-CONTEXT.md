# Phase 6: Common Data and Durable Storage - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Expose canonical NAP-COMMON helpers and durable NAP-STORAGE operations through backend-owned services. Common data remains a partial, updating Applesauce projection; storage is isolated by active account, verified napplet identity, and supported scope.

</domain>

<decisions>
## Implementation Decisions

### Common helper semantics
- Use the pinned 0.31.0 contract codecs and canonical NIP-19 representations; reject ambiguous or unsupported forms at the boundary.
- Keep stateless encode/decode helpers synchronous internally while preserving correlated runtime envelopes.
- Serve profile/common lookups as partial, stale-capable, updating projections rather than finished requests.
- Reuse the process-owned EventStore and relay loader lifecycle instead of adding napplet-specific subscriptions.

### Storage identity and scopes
- Namespace every key by active account pubkey, exact accepted napplet manifest identity, and canonical scope.
- Support shared napplet scope and per-instance scope only where the pinned contract defines them; reject invented scopes.
- Bind instance identifiers to backend-issued launch/session identity so iframe input cannot escape its namespace.
- Sign-out/replacement revokes access without deleting durable values.

### Persistence and quotas
- Use one versioned, atomically replaced local snapshot or similarly simple Deno-native durable store consistent with existing settings/catalog persistence.
- Validate keys and structured-clone/JSON-compatible values before mutation, with byte-count, key-count, and per-value limits.
- Serialize mutations per namespace, re-read current state when needed, and make list ordering deterministic.
- Failed writes leave the prior durable snapshot intact and return stable quota/storage errors.

### Lifecycle and privacy
- Storage survives WebSocket reconnects and process restarts but never crosses account or verified napplet boundaries.
- Expose no filesystem paths, other namespaces, relay internals, or signer material through errors or list results.
- Cancel common-data streams and correlated work on connection expiry while retaining process-owned cached truth.
- Test restart recovery, concurrent mutation, malformed snapshots, quota edges, account switching, and manifest replacement.

### the agent's Discretion
Choose conservative default quotas, snapshot compaction details, and projection update cadence where contracts are silent, following existing immutable service and injected-dependency patterns.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Existing account, catalog, settings, EventStore, loader, and WebSocket lifecycle services provide identity and process ownership.
- Versioned settings/catalog snapshot codecs demonstrate atomic persistence and malformed-state recovery.
- The dispatcher already supports correlated canonical messages and connection teardown.

### Established Patterns
- Applesauce reactive sources are composed rather than mirrored into competing state machines.
- Durable documents are closed, versioned, sanitized, and written atomically.
- Napplet authority derives from exact verified manifest identity, never caller-supplied labels.

### Integration Points
- Add pinned COMMON/STORAGE capability adapters and dispatcher branches.
- Attach namespace resolution to active-account plus accepted launch/session context.
- Add service, persistence, isolation, quota, reconnect, and dispatcher tests.

</code_context>

<specifics>
## Specific Ideas

Keep the first durable backend intentionally small and auditable; do not introduce a database server solely for Phase 6.

</specifics>

<deferred>
## Deferred Ideas

Cross-device storage synchronization, arbitrary binary values, migrations across napplet identities, and user-facing storage management remain outside this phase.

</deferred>
