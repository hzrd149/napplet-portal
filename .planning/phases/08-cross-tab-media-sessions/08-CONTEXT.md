# Phase 8: Cross-Tab Media Sessions - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement canonical NAP-MEDIA session control with one backend coordinator that arbitrates playback ownership across connected tabs. Tabs render and enact media commands, but backend session generations remain authoritative.

</domain>

<decisions>
## Implementation Decisions

### Session model
- Use pinned 0.31.0 MEDIA envelopes and one process-owned coordinator keyed by active account and canonical session identity.
- Track origin connection, current owner connection, monotonic generation, playback metadata/state, and last accepted command.
- Broadcast immutable current-state projections to every eligible connected tab after each accepted transition.
- Keep media source validation within Phase 5 resource policy where URLs/blobs are involved.

### Ownership arbitration
- Starting a new session or transferring ownership increments the generation and issues stop/revoke to the prior owner before confirming the new owner.
- Resolve concurrent start/transfer commands through one serialized reducer with deterministic ordering.
- Require generation checks on every owner command so delayed or restored tabs cannot reclaim playback.
- Idempotent repeats settle without duplicate playback or extra ownership changes.

### Cross-tab transport and shell controls
- Use the existing backend WebSocket connections as the canonical coordination fabric; browser-only channels may optimize UI but never decide ownership.
- Show compact shell-owned now-playing state and transfer/stop actions in every connected tab.
- A tab enacts playback only while its connection and generation match the authoritative owner projection.
- Reconnect receives a snapshot before it can issue owner commands and does not silently resume stale playback.

### Closure and failure behavior
- Closing/expiring the origin connection ends its session and broadcasts a terminal state.
- Owner loss without origin loss stops playback and leaves an explicit transferable paused/stopped state only if the pinned contract permits it.
- Delivery failures, hidden tabs, reconnect races, duplicate commands, and shutdown settle deterministically without two owners.
- Test reducer invariants with fake connections plus production transport smoke coverage across at least two clients.

### the agent's Discretion
Choose timeout/grace details, compact control layout, and internal reducer/module boundaries where contracts are silent, prioritizing deterministic single ownership over seamless but ambiguous continuation.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- PortalRuntime already owns connection generations, reconnect grace, correlated dispatch, and per-connection teardown.
- Shell navigation and status surfaces can host shared now-playing controls without entering the napplet iframe.
- Existing injected connection/clock test patterns support deterministic race testing.

### Established Patterns
- Backend truth survives transient browser sessions; browser islands project it rather than owning durable state.
- Generation guards prevent stale socket work from mutating current authority.
- Canonical runtime messages are validated before state transitions and settle once.

### Integration Points
- Add a MediaSessionCoordinator to the process-owned runtime and MEDIA dispatcher/capabilities.
- Broadcast snapshots/transitions through the established WebSocket protocol.
- Add shell controls plus reducer, race, reconnect, closure, and multi-client transport tests.

</code_context>

<specifics>
## Specific Ideas

Model coordination as a small pure reducer wrapped by a delivery service so ownership invariants can be exhaustively tested without real media elements.

</specifics>

<deferred>
## Deferred Ideas

Background audio service workers, lock-screen integrations, playlists, remote-cast protocols, and cross-device ownership remain outside this phase.

</deferred>
