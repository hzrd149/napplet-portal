# Napplet Portal

## What This Is

Napplet Portal is a Deno Fresh server-side runtime for napplets. It serves lightweight web pages that primarily mount sandboxed napplet iframes while the backend runtime owns complex Nostr logic, application state, relay/blossom operations, account handling, storage, and NAP API execution.

The immediate goal is a one-day MVP: sign in, load one known sandboxed napplet, and prove a backend-proxied stream-oriented runtime seam. The project should stay simple and functional first, then expand into the broader backend Nostr runtime and NAP API surface after the vertical slice works.

## Core Value

A napplet can run in a mobile browser while a server-side Deno runtime handles the heavy Nostr/runtime work.

## Requirements

### Validated

(None yet - ship to validate)

### Active

- [ ] Ship a one-day MVP that loads one sandboxed napplet from a simple Fresh mobile shell.
- [ ] Support MVP Nostr sign-in through NIP-46 bunker URI, Nostr Connect QR/handoff, and isolated `nsec` dev mode.
- [ ] Keep read-only `npub` mode in scope as a near-term sign-in/identity path, but do not let it block the one-day vertical slice.
- [ ] Proxy napplet messages and minimal NAP/runtime calls to backend-owned TypeScript code.
- [ ] Use Applesauce and RxJS in a stream-first style for Nostr/runtime flows where practical.
- [ ] Support local Nostr relays and local Blossom servers as cache backends for events, blobs, and napplet artifacts.
- [ ] Avoid nested subscriptions; compose streams through RxJS operators or shared observable pipelines.
- [ ] Avoid loading screens and server flows that wait for Nostr data to be complete; show partial, empty, and updating states instead.
- [ ] Keep complex Nostr logic, signer material, relay connections, event stores, and persistent runtime state on the backend side of the iframe boundary.

### Out of Scope

- Full Nostr social client behavior - the MVP proves napplet runtime value, not a social app.
- Full NAP API coverage - implement only the minimal handshake/identity/stream seam first.
- Production-grade relay sync and event persistence - design for streams now, deepen storage later.
- Production `nsec` custody - direct private key import is dev mode unless a later threat model approves it.
- Blocking UI that waits for all relay data to load - Nostr streams are never truly complete.
- Native mobile apps - mobile web first.
- Unsandboxed napplet execution - napplets must cross an explicit sandbox/message boundary.

## Context

The current codebase is a Fresh 2 starter app using Deno, Vite, Preact, Preact Signals, Tailwind CSS, file-system routes, and hydrated islands. Existing mapped architecture shows `main.ts` as the Fresh composition root, `utils.ts` as the typed request-state seam, `routes/` as the place for pages and API handlers, `islands/` for browser interactivity, and `components/` for presentational UI.

The larger project has two categories of future features. The first is the backend Nostr client runtime: authentication/sign-in, account state, relay and blossom configuration, local relay/blob cache integration, relay sync, event storage, database integration, relay connections, and other Nostr client responsibilities. The second is NAP API implementation: exposing the interfaces expected by Kehto and implementing behavior defined by the NAP specifications at `https://github.com/napplet/naps`.

For the MVP, these categories should be represented by a thin working seam rather than complete implementations. The frontend should be more than a static iframe wrapper, but only enough to prove the shell: sign-in entry points, active account state, one napplet viewport, and simple runtime/error states.

Local-first caching is part of the long-term runtime value. The runtime should be able to connect to local Nostr relays and local Blossom servers so loaded napplet events, manifests, and blobs can be cached near the server instead of repeatedly fetching from public relays or public blob servers. For the one-day MVP, this can be represented as configuration shape, a mocked/local endpoint, or a documented adapter seam; durable caching and synchronization belong in the backend runtime expansion phase.

## Constraints

- **Timeline**: The MVP must be functional in one day; plans should optimize for the smallest vertical slice.
- **Runtime**: Use Deno and Fresh as the server-side web/runtime foundation because the existing project is a Deno Fresh app.
- **Frontend architecture**: Use Fresh routes for server-rendered pages and islands only for browser-side interactivity; avoid moving backend runtime logic into islands.
- **Nostr libraries**: Use Applesauce packages as much as possible for Nostr primitives, networking, relay connections, database integration, event storage, and relay workflows.
- **Local cache backends**: Runtime design must allow local Nostr relay and local Blossom server connections for event/blob/artifact caching.
- **Reactive style**: Applesauce usage should respect RxJS/functional stream patterns. Avoid nested subscriptions and avoid unnecessary `async`/`await` flows that wait for all data to load.
- **Nostr loading model**: Nostr data is a stream, not a finished request. UI should handle partial, empty, stale, and updating states rather than waiting for completeness.
- **Local dependencies**: Integrate with sibling packages `../kehto` and `../napplet-web`; for MVP, use the smallest compatible subset instead of solving every contract concern at once.
- **Sandboxing**: Napplets run in sandboxed iframes, and NAP API access crosses an explicit proxy/message boundary.
- **Mobile web**: The app shell must work acceptably in mobile browsers, especially fullscreen napplet usage.
- **State ownership**: Persistent application state and complex Nostr processing belong to the backend runtime.
- **Existing codebase**: Current Fresh starter files are scaffolding; new work should evolve the structure without preserving starter demo behavior unnecessarily.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build the first milestone as a one-day vertical MVP | The project needs a simple functional proof before broad runtime expansion. | - Pending |
| Prove one sandboxed napplet before generalized catalog/runtime breadth | Loading one napplet validates the core iframe/backend seam fastest. | - Pending |
| Support NIP-46 bunker URI, Nostr Connect QR/handoff, and isolated `nsec` dev mode in MVP sign-in | These modes make the MVP useful for real testing while keeping production key custody deferred. | - Pending |
| Treat Nostr data as streams rather than complete loads | Relay data is open-ended; the UI and backend should update incrementally. | - Pending |
| Support local relay and Blossom cache backends | Loaded napplets, events, and blobs should not always depend on public relays/servers after first fetch. | - Pending |
| Use RxJS composition with Applesauce and avoid nested subscriptions | Functional stream composition keeps backend runtime flows predictable and avoids subscription leaks. | - Pending |
| Keep heavy runtime and Nostr logic on the backend | Mobile browser pages should remain responsive and simple while the server handles relay/runtime work. | - Pending |

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
*Last updated: 2026-07-30 after MVP scope alignment*
