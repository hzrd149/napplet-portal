# Walking Skeleton: Napplet Portal

Per D-47, this production-quality skeleton makes the sign-in → supplied verified napplet → initial-plus-updating backend stream path Phase 1's first delivery checkpoint, targeted for one day. Every locked Phase 1 behavior remains in this phase, and full completion has no one-day deadline.

## User Story

**As a** trusted single operator, **I want to** sign in and run one verified sandboxed napplet backed by live Nostr streams, **so that** a mobile browser can stay lightweight while the Deno server owns runtime authority.

## Architectural Backbone

| Concern | Phase 1 contract |
|---|---|
| Framework | Deno 2.9 / Fresh 2.3 SSR routes, with one narrow Preact island for browser-only interaction |
| Persistence | A versioned, sensitive filesystem account snapshot containing Applesauce account serialization plus active account ID; atomic temp-file/rename writes |
| Event read/write seam | One process-wide Applesauce `EventStore` receives observed relay events with exact provenance and supplies store-first reads; it is in-memory and unbounded until restart |
| Artifact read/write seam | A `NappletArtifactCache` adapter reads/writes verified NIP-5D resolutions in process memory; local/public Blossom endpoints are ordinary fetch sources |
| Authentication | One process-wide Applesauce account manager; Nostr Connect primary, bunker and `nsec` secondary; tabs are subordinate connection/window instances, not users |
| Runtime | One process-wide Kehto runtime, Applesauce `RelayPool`, `EventStore`, account manager, and artifact cache; one duplex WebSocket per tab |
| Trust boundary | Opaque-origin `srcdoc` iframe with exactly `sandbox="allow-scripts"`; browser source binding plus server-issued connection/window ownership |
| Local execution | `deno task check`, `deno task test`, and `deno task dev` exercise the stack; bind defaults to `127.0.0.1` |
| Deployment | Local Deno-compatible host for Phase 1; broader network exposure requires an explicit bind override |

## Assumption Delta

**Decision: no-change.** Source evidence consistently requires the process-wide runtime/account to remain primary. Browser tabs are subordinate window/connection instances sharing that active account, pool, and event store; they are not independently authenticated users. This preserves D-07, D-33, and D-35.

## Proven Vertical Path

Configured environment → singleton backend runtime → restored or newly active account → verified NIP-5D artifact → source-bound iframe/WebSocket session → exact Kehto NAP envelope → Applesauce store/live relay stream → napplet result/event.

The Plan 01 checkpoint executes this entire path with the actual user-supplied artifact, `sandbox="allow-scripts"`, a minimal lead sign-in path, the Kehto handshake, one initial event, and one later live update. Plans 02–06 expand the same production files to every remaining locked behavior.

## Deliberate Phase 1 Limits

No SQL/ORM, catalog, multi-user portal auth, approval UI, durable event/blob cache, broad NAP domains, example napplet, or production network hardening. The account snapshot and event/artifact adapters are the only persisted/read-write seams needed by this skeleton.
