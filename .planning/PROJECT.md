# Napplet Portal

## What This Is

Napplet Portal is a Deno Fresh server-side runtime for napplets. It serves lightweight web pages that primarily mount sandboxed napplet iframes while the backend runtime owns complex Nostr logic, application state, relay/blossom operations, account handling, storage, and NAP API execution.

The project is for running napplets comfortably from mobile web browsers without requiring the browser page to perform the heavy Nostr and runtime work locally. The frontend is still a real app shell, but its primary job is fullscreen sandboxed napplet presentation plus UX flows such as sign-in, settings, approval modals, mobile navigation, and API/message proxying.

## Core Value

Napplets can run in a mobile browser while a server-side Deno runtime safely handles Nostr state, networking, persistence, and NAP API behavior on their behalf.

## Requirements

### Validated

(None yet - ship to validate)

### Active

- [ ] Serve a Deno Fresh app shell that mounts sandboxed napplet iframes as the primary user experience.
- [ ] Implement backend-owned Nostr client runtime features: sign-in, accounts, relay/blossom configuration, relay sync, event storage, and state management.
- [ ] Use Applesauce packages wherever practical for Nostr primitives, networking, relay connections, and database integration.
- [ ] Integrate `../kehto` as the backend/runtime interface source for napplet execution and NAP behavior.
- [ ] Integrate `../napplet-web` as the browser-side napplet sandbox/iframe layer.
- [ ] Proxy napplet NAP API calls and sandbox messages from frontend pages to the backend runtime.
- [ ] Provide required app-shell UX around napplets: sign-in flows, settings pages, approval modals, and mobile bottom navigation with active user avatar.
- [ ] Keep complex Nostr logic and persistent application state on the backend rather than inside hydrated frontend islands.

### Out of Scope

- Native mobile apps - v1 is web-first and optimized for mobile browsers.
- Browser-only Nostr runtime - heavy Nostr networking, storage, relay sync, and runtime state belong on the server.
- General-purpose Nostr social client completeness - Nostr features should support napplet runtime needs first.
- Unsandboxed napplet execution - napplets must run through the sandboxed iframe/runtime boundary.
- Reimplementing Nostr primitives already covered by Applesauce - prefer Applesauce unless a concrete gap appears.

## Context

The current codebase is a Fresh 2 starter app using Deno, Vite, Preact, Preact Signals, Tailwind CSS, file-system routes, and hydrated islands. Existing mapped architecture shows `main.ts` as the Fresh composition root, `utils.ts` as the typed request-state seam, `routes/` as the place for pages and API handlers, `islands/` for browser interactivity, and `components/` for presentational UI.

The intended runtime architecture has two major feature categories. The first category is the backend Nostr client runtime: authentication/sign-in, account state, relay and blossom configuration, relay sync, event storage, database integration, relay connections, and other Nostr client responsibilities. The second category is NAP API implementation: exposing the interfaces expected by the Kehto runtime packages and implementing behavior defined by the NAP specifications at `https://github.com/napplet/naps`.

The frontend is not just a static iframe wrapper. It must include enough app-shell complexity for sign-in, settings, permission/approval workflows, mobile bottom navigation, active-user display, and message transport. However, route pages and islands should remain thin relative to the backend runtime: they render the shell, mount the sandboxed napplet iframe, and proxy NAP API/messages to backend endpoints or channels.

## Constraints

- **Runtime**: Use Deno and Fresh as the server-side web/runtime foundation because the existing project is a Deno Fresh app.
- **Frontend architecture**: Use Fresh routes for server-rendered pages and islands only for browser-side interactivity; avoid moving backend runtime logic into islands.
- **Nostr libraries**: Use Applesauce packages as much as possible for Nostr primitives, networking, relay connections, database integration, event storage, and relay workflows.
- **Local dependencies**: Integrate with sibling packages `../kehto` and `../napplet-web`; planning and implementation must account for their existing APIs rather than inventing parallel runtime contracts.
- **Sandboxing**: Napplets run in sandboxed iframes, and NAP API access crosses an explicit proxy/message boundary.
- **Mobile web**: The app shell must work well in mobile browsers, especially fullscreen napplet usage and bottom navigation.
- **State ownership**: Persistent application state and complex Nostr processing belong to the backend runtime.
- **Existing codebase**: Current Fresh starter files are scaffolding; new work should evolve the structure without preserving starter demo behavior unnecessarily.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build as a server-side Deno Fresh runtime | Fresh provides server-rendered pages, route handlers, and lightweight islands suitable for a backend-heavy napplet portal. | - Pending |
| Keep heavy runtime and Nostr logic on the backend | Mobile browser pages should remain responsive and simple while the server handles relay sync, storage, and NAP execution. | - Pending |
| Use Applesauce for Nostr primitives and networking where practical | Applesauce reduces bespoke Nostr implementation risk and provides strong relay, storage, and primitive support. | - Pending |
| Use `../kehto` for napplet runtime interfaces | The runtime should implement the existing Kehto contracts instead of creating incompatible abstractions. | - Pending |
| Use `../napplet-web` for sandboxed iframe execution | The browser layer should reuse the existing napplet sandbox package. | - Pending |
| Prioritize fullscreen sandboxed napplet UX with supporting app shell | The product value is running napplets; sign-in, settings, approvals, and navigation support that primary surface. | - Pending |

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
*Last updated: 2026-07-30 after initialization*
