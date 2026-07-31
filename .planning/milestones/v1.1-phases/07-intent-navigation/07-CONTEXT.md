# Phase 7: Intent Navigation - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Derive trusted intent handlers from accepted installed manifests and let napplets invoke them through shell-owned navigation. The shell selects focus/reuse, new-tab, or stacked-frame behavior while preserving sandboxing, history, and backend runtime ownership.

</domain>

<decisions>
## Implementation Decisions

### Handler discovery
- Build the handler registry only from exact accepted manifest events already admitted by CatalogService.
- Decode handler declarations with pinned 0.31.0 contracts and omit malformed, superseded, unresolved, or uninstalled entries.
- Project handler availability reactively as catalog truth changes, preserving last-good partial state during transient sync failures.
- Use stable verified napplet identity plus declared archetype as the canonical handler key.

### Invocation and policy
- Validate the invoking napplet session, requested archetype, payload envelope, and target handler before navigation.
- Return canonical handled, unavailable, denied, and failed outcomes with correlation and sanitized reasons.
- Default deterministically when multiple handlers exist, while allowing an explicit installed target only if policy permits it.
- Never deliver intent payloads to a handler until its exact accepted artifact is verified for launch.

### Shell navigation modes
- Keep mode selection in shell/backend policy: reuse/focus an existing matching surface when safe, otherwise use the declared allowed mode.
- New-tab launch uses a constrained portal URL and backend-issued correlation, not caller-supplied arbitrary URLs.
- Stacked iframe navigation preserves sandbox attributes and gives the shell explicit back/close ownership.
- Browser history represents shell-visible navigation without reloading or remounting unrelated active napplet state.

### Failure and lifecycle behavior
- Catalog replacement or uninstall immediately removes authority for future invocations and safely fails in-flight unresolved launches.
- Popup blocking, closed tabs, verification failures, denied modes, and stale generations settle once with canonical outcomes.
- Focus/reuse never crosses account or verified napplet identity boundaries.
- Test registry churn, competing handlers, stale caller/target sessions, blocked popup, stack history, and reconnect behavior.

### the agent's Discretion
Choose the deterministic handler ordering, bounded intent payload size, and compact shell controls where the pinned contracts do not dictate them, reusing existing catalog and navigation patterns.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- CatalogService already projects accepted manifest identity and gates exact verified launch bytes.
- The shell history/account/settings surfaces already preserve one mounted napplet frame.
- Runtime command correlation, generation guards, and sandbox creation provide invocation primitives.

### Established Patterns
- Accepted manifest event IDs are the sole launch authority.
- Shell navigation owns browser chrome/history; napplets communicate only across validated message boundaries.
- Transient synchronization failures preserve last-good display truth without granting new authority.

### Integration Points
- Add an intent registry projection derived from CatalogService and pinned manifest contracts.
- Extend runtime capability/dispatcher messages and shell island navigation state.
- Add contract, registry, dispatcher, history, sandbox, and failure-path tests.

</code_context>

<specifics>
## Specific Ideas

Prefer focus/reuse for an already-open exact handler to reduce mobile tab proliferation, while keeping new-tab and stacked-frame behavior explicit and policy-controlled.

</specifics>

<deferred>
## Deferred Ideas

Public intent marketplaces, uninstalled remote handlers, user-authored routing rules, and cross-origin arbitrary navigation remain outside this phase.

</deferred>
