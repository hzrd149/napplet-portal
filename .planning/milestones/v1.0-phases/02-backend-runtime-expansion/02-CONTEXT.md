# Phase 2: Backend Runtime Expansion - Context

**Gathered:** 2026-07-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 turns the Phase 1 in-memory runtime seam into durable backend-owned Nostr event, relay, account, cache, catalog, and contract foundations. It adds optional local relay and Blossom read-through caching, reactive operator routing settings, a Nostr-synchronized installed-napplet catalog, and contract drift coverage. Broader NAP APIs, persistent capability approvals, multi-account isolation, and production hardening remain Phase 3 work.

</domain>

<decisions>
## Implementation Decisions

### Event persistence and synchronization
- **D-01:** Use an optional local Nostr relay as the durable event store/cache; do not add a separate embedded event database. Without the local relay, the portal continues with its shared in-memory Applesauce event store.
- **D-02:** Implement read-through event caching: query the local relay first through EOSE, then open upstream subscriptions and asynchronously publish every valid upstream event observed by portal subscriptions back to the local relay.
- **D-03:** Cache acknowledgement never delays napplet delivery. Local relay unavailability or write failure is non-fatal and becomes a cache-health warning while upstream streams continue.
- **D-04:** Use the customizable timeout exposed by Applesauce Relay/RelayPool so a local relay that never reaches EOSE cannot block upstream access. Validate the exact sequential composition against official Applesauce examples during research.
- **D-05:** Applesauce's in-memory event store owns live dedupe and replaceable/addressable/deletion semantics; the local relay owns durable indexing and deletion behavior.

### Local relay and Blossom cache behavior
- **D-06:** Treat the standard local Blossom server as a read-through proxy. Send BUD-10 `xs`/`as` hints so it can retrieve and cache misses itself.
- **D-07:** If the local Blossom server is unavailable or its proxy attempt fails, the portal runtime fetches directly from upstream rather than failing the request.
- **D-08:** Automatically discover the local Blossom cache with `HEAD http://127.0.0.1:24242/`; explicit configuration is not required.
- **D-09:** Trust a healthy loopback Blossom cache for ordinary media, but preserve the Phase 1 integrity boundary: manifests and executable napplet artifacts must always be hash/signature verified before execution.

### Operator configuration
- **D-10:** Provide a backend-persisted settings page for relay and Blossom settings. Saved changes take effect without a server restart. — **Reversibility:** costly — replacing account/operator-owned persistent settings with startup-only configuration would require migrating stored settings and reactive consumers.
- **D-11:** Operators configure fallback/extra relays and default indexer/lookup relays. Ordinary read/write routing remains derived from NIP-65.
- **D-12:** Prefer Applesauce's reactive indexer/lookup relay state when available; configured runtime values are defaults, not a duplicated state machine.
- **D-13:** Applesauce-composed streams react naturally to relay-list changes where supported. Non-reactive operations use the new settings when next started; do not force teardown solely to apply a change.
- **D-14:** NIP-42 relay AUTH is per-relay opt-in and separate from portal login and signer authority.
- **D-15:** A user's blocked-relay state overrides NIP-65 routing, lookup defaults, fallback/extra lists, and AUTH permission. The runtime must neither connect nor authenticate to a blocked relay.

### Napplet catalog and identity
- **D-16:** Store the authoritative installed-napplet catalog as one public, signed, replaceable NIP-78 application-data event owned by the active account. The backend derives its local projection from synchronized Nostr state. — **Reversibility:** costly — changing the event representation later requires migrating published account state and all readers.
- **D-17:** Each catalog entry contains only its NIP-5A coordinate and accepted manifest event ID. Resolve display metadata from the accepted integrity-verified manifest.
- **D-18:** Normal Nostr replacement semantics apply to concurrent edits: the latest valid NIP-78 catalog event wins. Phase 2 does not merge divergent catalog edits.
- **D-19:** A newer valid manifest requires operator approval. Continue launching the last accepted manifest until approval; runtime identity comes from that accepted verified manifest, never iframe claims.
- **D-20:** Update approval shows publisher/coordinate, old and new manifest event IDs, display/version changes, aggregate hash, and changed capability declarations.
- **D-21:** Uninstall publishes a replacement catalog without the entry. Content-addressed artifacts remain available until normal cache eviction.

### Contract verification
- **D-22:** Pinned npm packages, including `@napplet/core@0.31.0` and `@napplet/nap@0.31.0`, are authoritative for executable production behavior. Sibling `../kehto` and `../napplet` sources remain reference-only fixtures and drift inputs.
- **D-23:** Sibling-reference drift is non-blocking: it must not fail checks, releases, or runtime startup.
- **D-24:** Contract coverage includes compile-time types, serialized wire fixtures, and lifecycle behavior for handshake, streams, EOSE, close, correlation, and typed errors. Retain the supplied-napplet flow as an end-to-end smoke test.
- **D-25:** Emit a structured drift report naming affected contracts, pinned package versions, sibling revisions, and adapter coverage.

### the agent's Discretion
- Exact backend persistence mechanism for operator settings, provided state remains backend-owned and reactive.
- Exact cache-health presentation and timeout value, provided failures stay non-blocking and Applesauce's timeout facility is used.
- Exact NIP-78 `d` tag/application identifier and public content encoding.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope and prior decisions
- `.planning/PROJECT.md` — Backend ownership, stream-first constraints, and active Phase 2 requirements.
- `.planning/REQUIREMENTS.md` — V2-01 through V2-10 scope.
- `.planning/ROADMAP.md` — Phase 2 goal, boundary, and success criteria.
- `.planning/phases/01-one-day-napplet-runtime-mvp/01-CONTEXT.md` — Locked runtime, relay, identity, sandbox, and integrity decisions inherited from Phase 1.

### Runtime and package contracts
- `../kehto/RUNTIME-SPEC.md` — Canonical Kehto runtime and shell contract reference.
- `../kehto/packages/runtime/src/relay-handler.ts` — Reference relay dispatch and lifecycle behavior.
- `../kehto/packages/runtime/src/relay-result.ts` — Reference event result and provenance shapes.
- `../napplet/packages/core/src/types/nostr.ts` — Reference shared Nostr types.
- `../napplet/packages/nap/src/relay/types.ts` — Reference NAP-RELAY wire shapes.
- `../napplet/packages/nap/src/outbox/types.ts` — Reference NAP-OUTBOX wire shapes.
- `deno.json` — Authoritative production dependency pins and tasks.

### Cache and Nostr behavior
- `https://github.com/hzrd149/blossom/blob/master/implementations/local-blossom-cache.md` — Standard loopback address, health probe, proxy hints, retrieval fallback, and caching behavior.
- `https://github.com/hzrd149/applesauce` — Official Applesauce source and examples; research must identify the precise Relay/RelayPool timeout, reactive relay-list, loader, and local-first composition examples before planning.
- `https://github.com/nostr-protocol/nips/blob/master/65.md` — NIP-65 relay-list routing.
- `https://github.com/nostr-protocol/nips/blob/master/42.md` — NIP-42 relay AUTH.
- `https://github.com/nostr-protocol/nips/blob/master/78.md` — NIP-78 application data used for the installed catalog.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `runtime/portal_runtime.ts`, `runtime/relay_adapter.ts`, and `runtime/outbox.ts`: existing singleton Applesauce runtime, relay stream, provenance, publishing, and teardown seams to extend.
- `runtime/config.ts`: startup configuration parsing and endpoint normalization; becomes the fallback/default input to persistent reactive settings.
- `runtime/artifacts.ts`: verified manifest/blob resolution and executable integrity boundary to preserve while adding Blossom proxy fallback.
- `runtime/accounts.ts`, `runtime/account_store.ts`, and `runtime/signer_service.ts`: backend-owned account, persistence, signer, and reactive state foundations for NIP-78 catalog publication.
- `components/HomeView.tsx`, `components/NappletFrame.tsx`, and `islands/NappletShell.tsx`: current catalog projection, launch, and update-approval integration points.
- `tests/runtime_contract_test.ts`, `tests/relay_stream_test.ts`, `tests/artifact_resolver_test.ts`, and `tests/end_to_end_test.ts`: existing focused and end-to-end test seams for contract and cache expansion.

### Established Patterns
- Backend runtime logic stays outside islands; islands own only UI and browser transport.
- One backend-wide account, RelayPool, and EventStore serve logically independent browser/window subscriptions.
- RxJS composition centralizes dedupe and lifecycle teardown; nested subscriptions and wait-for-completeness flows are prohibited.
- Production imports use pinned npm packages; sibling packages are never path/workspace dependencies.

### Integration Points
- Extend runtime composition with optional local-relay read-through and asynchronous cache writes.
- Add local Blossom discovery/proxy routing around the existing verified artifact resolver.
- Add backend-persisted reactive settings and a Fresh settings page without transferring routing authority to the browser.
- Add NIP-78 catalog loading/publishing to account activation and expose a browser-safe catalog projection.
- Expand current contract tests and generate a structured, non-blocking sibling drift report.

</code_context>

<specifics>
## Specific Ideas

- The local Nostr relay itself is the durable event store; the portal must remain fully usable without it.
- Local event reads should reach EOSE before upstream subscriptions begin, subject to Applesauce's built-in customizable timeout.
- Follow the Local Blossom Cache specification's transparent proxy model rather than inventing a portal-specific blob cache protocol.
- Use Applesauce reactive relay collections as sources of truth instead of mirroring them into portal-owned state.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within the Phase 2 boundary.

</deferred>

---

*Phase: 2-Backend Runtime Expansion*
*Context gathered: 2026-07-30*
