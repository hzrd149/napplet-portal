# Napplet Portal

## What This Is

Napplet Portal is a Deno Fresh server-side runtime for napplets. It serves lightweight web pages that primarily mount sandboxed napplet iframes while the backend runtime owns complex Nostr logic, application state, relay/blossom operations, account handling, storage, and NAP API execution.

Phase 1 delivered the mobile shell, backend-owned sign-in, verified sandboxed napplet launch, and continuing RELAY/OUTBOX runtime seam. Milestone v1.1 expanded that boundary with installed-app discovery, backend RESOURCE/UPLOAD/COMMON/STORAGE/INTENT/MEDIA capabilities, resilient shell state, and adversarial proxy hardening. Physical-device and one media-browser acceptance flow remain explicit residual risks.

## Current State: v1.1 Runtime & UX Expansion Archived

**Closeout:** Override archive on 2026-07-31 with 32/33 requirements satisfied. QLT-04 remains incomplete; see `.planning/milestones/v1.1-MILESTONE-AUDIT.md`.

**Target features:**
- Installed napplet catalog, `naddr` installation and launch, and home-page search
- NAP-RESOURCE, NAP-UPLOAD, NAP-COMMON, NAP-INTENT, NAP-STORAGE, and shared cross-tab NAP-MEDIA support
- Dark/light themes, a custom SVG icon, redesigned account/navigation chrome, and polished runtime connection states
- Backoff reconnection and visible backend connection status for mobile browser tabs
- `blossom-client-sdk`-based multi-server transfers through configured Blossom servers

## Core Value

A napplet can run in a mobile browser while a server-side Deno runtime handles the heavy Nostr/runtime work.

## Requirements

### Validated

- ✓ Load one supplied verified napplet in a mobile Fresh shell and prove the backend stream seam — Phase 1
- ✓ Support Nostr Connect, NIP-46 bunker URI, and isolated `nsec` sign-in — Phase 1
- ✓ Keep read-only `npub` mode explicitly deferred beyond the locked Phase 1 account modes — Phase 1
- ✓ Proxy correlated napplet messages and SHELL/IDENTITY/RELAY/OUTBOX calls to backend TypeScript — Phase 1
- ✓ Use Applesauce and RxJS stream composition without nested subscriptions or wait-for-completeness flows — Phase 1
- ✓ Keep signer material, relay authority, persistent account state, and complex Nostr processing behind the iframe boundary — Phase 1
- ✓ Install, synchronize, search, and launch verified napplets by exact accepted catalog identity — v1.1
- ✓ Proxy bounded RESOURCE and UPLOAD operations through backend-owned URL, integrity, and Blossom policy — v1.1
- ✓ Provide backend COMMON helpers and isolated durable STORAGE with quotas and restart persistence — v1.1
- ✓ Discover and invoke verified INTENT handlers through shell-controlled reuse, stack, and new-tab navigation — v1.1
- ✓ Coordinate generation-fenced MEDIA ownership and reconnect lifecycle across runtime clients — v1.1
- ✓ Harden sandbox, capability, signer, storage, transport, CSP, reconnect, and async-generation boundaries — v1.1

### Active

- [ ] Complete physical iOS Safari and Android Chrome safe-area, backgrounding, popup, touch, autoplay, and reconnect UAT.
- [ ] Close the two-page Chromium media acceptance fixture so verified artifact resolution reaches revoke-before-grant playback ownership.
- [ ] Run the documented public/local relay and Blossom interoperability and target-deployment persistence checks.

### Out of Scope

- Full Nostr social client behavior - the MVP proves napplet runtime value, not a social app.
- Full NAP API coverage - implement only the minimal handshake/identity/stream seam first.
- Production-grade relay sync and event persistence - design for streams now, deepen storage later.
- Production `nsec` custody - direct private key import is dev mode unless a later threat model approves it.
- Blocking UI that waits for all relay data to load - Nostr streams are never truly complete.
- Native mobile apps - mobile web first.
- Unsandboxed napplet execution - napplets must cross an explicit sandbox/message boundary.

## Context

The codebase is now a Fresh 2 Napplet Portal runtime using Deno, Vite, Preact, RxJS, Applesauce, and pinned Kehto/Napplet packages. `main.ts` composes process-owned signer, catalog, storage, intent, media, relay, transfer, and runtime services; routes expose browser-safe projections and WebSocket commands; islands own only UI and transport behavior. The v1.1 automated gate ends at 275 passing Deno tests plus production build and four non-media Chromium rows.

The larger project has two categories of future features. The first is the backend Nostr client runtime: authentication/sign-in, account state, relay and blossom configuration, local relay/blob cache integration, relay sync, event storage, database integration, relay connections, and other Nostr client responsibilities. The second is NAP API implementation: exposing the interfaces expected by Kehto and implementing behavior defined by the NAP specifications at `https://github.com/napplet/naps`.

For the MVP, these categories should be represented by a thin working seam rather than complete implementations. The frontend should be more than a static iframe wrapper, but only enough to prove the shell: sign-in entry points, active account state, one napplet viewport, and simple runtime/error states.

Local-first caching is part of the long-term runtime value. The runtime should be able to connect to local Nostr relays and local Blossom servers so loaded napplet events, manifests, and blobs can be cached near the server instead of repeatedly fetching from public relays or public blob servers. Phase 1 delivers the locked ordinary-endpoint and in-memory adapter seams; durable caching and synchronization belong in the backend runtime expansion phase.

## Constraints

- **Timeline**: The first vertical tracer checkpoint is targeted for one day; completing the full locked Phase 1 scope has no one-day deadline.
- **Runtime**: Use Deno and Fresh as the server-side web/runtime foundation because the existing project is a Deno Fresh app.
- **Frontend architecture**: Use Fresh routes for server-rendered pages and islands only for browser-side interactivity; avoid moving backend runtime logic into islands.
- **Nostr libraries**: Use Applesauce packages as much as possible for Nostr primitives, networking, relay connections, database integration, event storage, and relay workflows.
- **Local cache backends**: Runtime design must allow local Nostr relay and local Blossom server connections for event/blob/artifact caching.
- **Reactive style**: Applesauce usage should respect RxJS/functional stream patterns. Avoid nested subscriptions and avoid unnecessary `async`/`await` flows that wait for all data to load. Keep class/service structures simple; when Applesauce exposes a reactive source such as `active$` or `accounts$`, prefer deriving portal state from it instead of duplicating a second state machine.
- **Nostr loading model**: Nostr data is a stream, not a finished request. UI should handle partial, empty, stale, and updating states rather than waiting for completeness.
- **Local dependencies**: Use sibling packages `../kehto` and `../napplet` as reference-only contract sources. Production application dependencies and imports must use pinned npm packages, including `@napplet/core@0.31.0` and `@napplet/nap@0.31.0`, never file, path, or workspace imports from `../napplet`.
- **Sandboxing**: Napplets run in sandboxed iframes, and NAP API access crosses an explicit proxy/message boundary.
- **Mobile web**: The app shell must work acceptably in mobile browsers, especially fullscreen napplet usage.
- **State ownership**: Persistent application state and complex Nostr processing belong to the backend runtime.
- **Existing codebase**: Current Fresh starter files are scaffolding; new work should evolve the structure without preserving starter demo behavior unnecessarily.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep the original one-day tracer as the first Phase 1 checkpoint, then complete all locked Phase 1 scope without a one-day deadline (D-47) | The project needs an early functional proof without dropping or postponing locked functionality. | 2026-07-30 |
| Prove one sandboxed napplet before generalized catalog/runtime breadth | Loading one napplet validates the core iframe/backend seam fastest. | Validated in Phase 1 |
| Support NIP-46 bunker URI, Nostr Connect QR/handoff, and isolated `nsec` dev mode in MVP sign-in | These modes make the MVP useful for real testing while keeping production key custody deferred. | Validated in Phase 1 |
| Treat Nostr data as streams rather than complete loads | Relay data is open-ended; the UI and backend should update incrementally. | Validated in Phase 1 |
| Support local relay and Blossom cache backends | Loaded napplets, events, and blobs should not always depend on public relays/servers after first fetch. | - Pending |
| Use RxJS composition with Applesauce and avoid nested subscriptions | Functional stream composition keeps backend runtime flows predictable and avoids subscription leaks. | Validated in Phase 1 |
| Keep service structures simple and derive from Applesauce reactive state | Duplicating Applesauce `AccountManager.active$`/`accounts$` into custom status machines caused restored accounts and runtime auth to drift. Use Applesauce reactive interfaces as source of truth and keep only truly extra portal state, such as a pending remote-signer attempt. | 2026-07-30 |
| Keep heavy runtime and Nostr logic on the backend | Mobile browser pages should remain responsive and simple while the server handles relay/runtime work. | Validated in Phase 1 |
| Verify NIP-5D manifest signatures, aggregate hashes, and blob hashes before assigning iframe `srcdoc` | Executable napplet bytes must fail closed at the network-to-iframe boundary. | Validated in Phase 1 |
| Own signer attempts in a process service rather than transient WebSocket sessions | Signer state must survive browser reconnects without exposing authority. | Validated in Phase 1 |
| Require every routed OUTBOX relay to accept before publish succeeds | Success must represent the complete required fanout, not a partial write. | Validated in Phase 1 |
| Bind all NAP work to backend-issued window, account, manifest, instance, and generation authority | Reconnects and stale browser work must not retain effects. | ✓ Validated in v1.1 |
| Keep accepted residual observations distinct from automated passes | Physical/live evidence cannot be inferred from deterministic transport tests. | ⚠ Revisit in next milestone |
| Restrict scripts and WebSockets with response-specific CSP | Fresh hydration needs its validated nonce while sandboxed content must not gain arbitrary network authority. | ✓ Validated in v1.1 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-31 after v1.1 override closeout*
