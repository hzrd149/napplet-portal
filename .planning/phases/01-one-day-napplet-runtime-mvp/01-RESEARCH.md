# Phase 01: Napplet Runtime MVP - Research

**Researched:** 2026-07-30
**Domain:** Deno Fresh, server-owned Nostr/Applesauce runtime, NIP-5D iframe hosting, Kehto NAP dispatch
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Sign-in and backend account lifetime
- **D-01:** Lead sign-in with Nostr Connect. Show its QR code and copyable URI together with a short signer-app instruction; keep bunker URI and `nsec` as secondary methods.
- **D-02:** Present `nsec` as a normal secondary option labeled **Not recommended**, not as a developer-only feature. Key material remains backend-owned and never enters URLs, logs, napplet storage, or browser-accessible storage.
- **D-03:** Show the active user's avatar in the bottom navigation. Tapping it opens the shell settings area; Phase 1 includes active-account details and sign-out only.
- **D-04:** Use Applesauce's account system and serialization where supported. Persist every successfully added account, its complete signer state (including `nsec` and Nostr Connect client material), and the active-account selection. The newest successful sign-in becomes active; older accounts remain stored but are not exposed in the Phase 1 UI. — **Reversibility:** costly — changing the persisted representation later requires migrating sensitive account records.
- **D-05:** Store serialized account data directly and rely on host filesystem permissions. Documentation must mark the account store as sensitive at-rest material.
- **D-06:** If a restored NIP-46 signer is unavailable, retain it as the active but offline account, continue public reads, and retry connectivity without deleting the account.
- **D-07:** The backend runtime has one globally active Nostr account. Browser tabs are windows into that account. Last successful sign-in wins and identity changes are broadcast to every connected tab and mounted napplet.
- **D-08:** Closing all tabs does not sign out the backend. On sign-out, keep public relay/outbox reads active, push identity-unavailable state, and reject signer-dependent operations.

### Mobile shell and napplet navigation
- **D-09:** After sign-in, automatically open the configured napplet. Render its iframe immediately; do not add a portal loading screen or wait for runtime streams to become complete.
- **D-10:** Keep a two-item bottom navigation in normal layout flow: Home and Profile, both with icons and labels. Include safe-area padding. It reduces the iframe's available height and never overlays napplet content.
- **D-11:** Home is a full shell view with a compact grid of app-style icon/name tiles. Phase 1 shows only the configured napplet with a small active indicator.
- **D-12:** Profile/settings is also a full shell view. Home and Profile temporarily hide—but do not unmount—the iframe. Returning to the napplet preserves in-memory state; use a short subtle fade between views.
- **D-13:** The open napplet has no portal-owned header and uses the full available width, including on desktop.
- **D-14:** Browser Back from the napplet navigates to Home without reloading it. Selecting the active tile returns to the existing iframe.
- **D-15:** On iframe load or handshake failure, keep the iframe visible and show a slim shell error notice above it with Retry.

### Verified napplet loading and Kehto boundary
- **D-16:** Configure one NIP-5A napplet address/manifest coordinate in server configuration. Resolve its signed manifest from default relays at backend startup, fetch the artifact through manifest server hints plus configured default Blossom servers, verify the blob/aggregate identity, and bind that identity at iframe creation. — **Reversibility:** costly — this identity forms the NIP-5D session and capability-policy key.
- **D-17:** Refuse to execute unverifiable content and show a shell-owned integrity error with Retry. Refuse launch when required NAP capabilities are unavailable and name the missing capability.
- **D-18:** Keep the verified artifact in a simple session runtime cache behind the same artifact-adapter seam future local Blossom caching will use. Retain the startup-resolved version until restart or explicit retry.
- **D-19:** If no napplet coordinate is configured, show Home with an empty state explaining that server configuration is required.
- **D-20:** Use `sandbox="allow-scripts"` without `allow-same-origin`. Add no other sandbox tokens in Phase 1.
- **D-21:** Follow Kehto and napplet package contracts exactly. The napplet sends `shell.ready`; the shell replies exactly once with `shell.init`. Dynamically inject only mandatory shell plus supported/granted NAP domains. Bind identity from `MessageEvent.source`, silently ignore unknown types, and use NAP-defined errors for recognized failures.
- **D-22:** Phase 1 supports NAP-SHELL, NAP-IDENTITY, NAP-RELAY, and NAP-OUTBOX only. A user-provided test napplet verifies the seam; do not build an example napplet.
- **D-23:** Ordinary NAP errors are returned to the napplet for presentation. Shell notices are reserved for iframe, integrity, connection, or session failures. Correlated backend timeouts return typed errors with the original ID and do not kill the napplet session.

### Applesauce relay/event runtime
- **D-24:** Run one backend-wide Applesauce `RelayPool` and one in-memory `EventStore`. Merge matching store events with live relay observables and pipe live events through the store so deduplication is centralized. Do not create nested subscriptions.
- **D-25:** Keep logical Kehto subscriptions independent per napplet window while allowing Applesauce to multiplex underlying relay work. Subscription ownership is keyed by backend connection, napplet window, and napplet `subId`.
- **D-26:** On `relay.close` or `outbox.close`, unsubscribe the composed observable immediately, stop delivery, release per-subscription resources, and emit the canonical closed envelope.
- **D-27:** NAP-RELAY uses the napplet-supplied relay URL. NAP-OUTBOX combines preset runtime relays with user NIP-65 routing through the existing Kehto service contract.
- **D-28:** Treat partial relay availability as normal Nostr behavior. Use Applesauce relay-pool primitives, relay selection, and the event store rather than inventing portal-level partial-failure semantics.
- **D-29:** Preserve exact observed relay provenance in canonical `RelayEventResult.sidecar.relayHints`. Omit hints when the delivering relay is not known; never substitute all targeted relays as fake provenance.
- **D-30:** Preserve current lifecycle contracts: NAP-RELAY emits `relay.eose`; NAP-OUTBOX has no EOSE message. Reconstruct one RELAY EOSE from Applesauce relay-message state if the higher-level event observable omits it, then keep the live tail open.

### Browser-to-backend stream transport and shared runtime
- **D-31:** Use one duplex WebSocket per browser tab for correlated commands/results and subscription events.
- **D-32:** A reconnecting tab automatically re-registers only its active logical subscriptions, preserves napplet `subId` values, and deduplicates replay through the shared event store.
- **D-33:** Each tab receives its own connection/window namespace, but all tabs share the one backend account, relay pool, and event store. Identical subscriptions stay logically independent.
- **D-34:** Retain a disconnected tab's runtime sessions for a short configurable grace window, then tear down only that connection's sessions and subscriptions.
- **D-35:** Do not add portal authentication. Anyone able to access the web server is the same trusted operator as the backend's active account. Bind to loopback by default and require explicit configuration for LAN/public exposure. — **Reversibility:** costly — adding multi-user authentication later changes every runtime/session ownership boundary.

### Signing and publishing
- **D-36:** Implement canonical NAP-RELAY and NAP-OUTBOX publish operations in Phase 1 with no approval UI for supported/granted napplets.
- **D-37:** Follow current package contracts to the letter: NAP-RELAY accepts an already-signed Nostr event and forwards it unchanged; NAP-OUTBOX accepts an unsigned template, signs it with the global backend account, and performs canonical fanout.
- **D-38:** Treat a napplet-supplied signed NAP-RELAY event as unexpected-but-supported behavior. Log only napplet identity, event ID/kind, and request correlation ID—never content, signature, or secrets.
- **D-39:** Implement `relay.publishEncrypted` using backend-owned Applesauce event operations for encryption and signing. Never expose keys or signer authority to the napplet.
- **D-40:** Report publish success only after the target relay or required NAP-OUTBOX relay set acknowledges acceptance. Return only canonical Kehto/NAP result fields and per-relay outcomes.

### Runtime configuration and cache seams
- **D-41:** Supply the napplet coordinate, relay list, Blossom server list, reconnect grace period, bind address, and related MVP settings through environment variables read once at startup.
- **D-42:** Ship small documented built-in relay and Blossom fallback lists. Environment configuration overrides those lists.
- **D-43:** Treat local Nostr relays and local Blossom servers as ordinary additional event/blob endpoints merged into their respective lists. Phase 1 does not create a separate cache protocol or durable synchronization.
- **D-44:** Normalize, validate, and deduplicate endpoint URLs with Applesauce helpers where available. Warn about rejected values and continue with valid/default endpoints.
- **D-45:** Leave the shared Phase 1 in-memory event/artifact cache unbounded until backend restart.
- **D-46:** Print a sanitized startup summary containing the napplet coordinate, endpoint counts, account-restoration state, and runtime readiness. Never print credentials or signer material.

### the agent's Discretion
- Exact visual styling, icon set, spacing, colors, and animation duration within the locked mobile-shell behavior.
- Exact environment-variable names and built-in endpoint values, provided they are documented and satisfy the configuration semantics above.
- Exact duration of the short reconnect grace window.
- Internal module boundaries and adapter type names, provided backend ownership and canonical package contracts remain intact.

### Deferred Ideas (OUT OF SCOPE)
- Full account-management and profile-settings UI.
- Installed napplet catalog beyond the single configured NIP-5A coordinate.
- Durable event/blob cache, local cache synchronization, quotas, and eviction policy.
- Multi-user/multi-account runtime isolation and portal authentication.
- Per-napplet approval/consent UI and persistent capability policy.
- Broad Kehto/NAP domain coverage beyond SHELL, IDENTITY, RELAY, and OUTBOX.
- Example/demo napplet authored by this project.
- Production deployment/security hardening beyond loopback-by-default and sensitive-log avoidance.
</user_constraints>

## Summary

The shortest credible plan is a server-first vertical slice with three narrow boundaries: a Fresh island owns only navigation, iframe `postMessage`, and WebSocket reconnection; one process-wide backend runtime owns accounts, Kehto dispatch, Applesauce `RelayPool`/`EventStore`, subscriptions, and artifacts; an explicit transport codec connects them. `@kehto/runtime` is browser-agnostic and exposes `createRuntime()`, `handleMessage(windowId, message)`, service registration, session registration, and window destruction, while `@kehto/shell` is explicitly browser integration. Therefore, do not move `createRuntime()` into the island merely to reuse the complete browser bridge. Adapt the Kehto shell handshake and injected namespace at the iframe boundary, then forward recognized domain envelopes to the server runtime. [VERIFIED: codebase grep — `../kehto/packages/runtime/README.md`, `../kehto/packages/shell/README.md`]

There is a current version seam that must be settled before feature work: the checked-out Kehto manifests are `@kehto/runtime` 0.19.0, shell 0.18.0, services 0.17.0 with `@napplet/* >=0.29 <0.30`, while the sibling `../napplet` source is 0.31.0. The npm registry's latest coherent line is runtime 0.20.1, shell 0.19.1, services 0.18.1, nip 0.5.1 with `@napplet/core` and `@napplet/nap >=0.31 <0.32`. Use that single coherent published line and use sibling sources as canonical contract/reference code; do not mix the older local Kehto build with napplet 0.31. [VERIFIED: npm registry and codebase package manifests]

The largest planning risk is breadth, not unclear architecture. The locked decisions require real verified napplet loading, three sign-in mechanisms, sensitive account persistence, reconnectable per-window live subscriptions, exact provenance, NIP-65 outbox routing, encryption/signing, and settled publishing. Plan this as sequential vertical waves with contract tests first. Per D-47, the first executable checkpoint must cross sign-in, the actual supplied verified iframe, Kehto handshake, and initial-plus-updating backend stream; it is targeted for one day, while full locked Phase 1 completion has no one-day deadline. [VERIFIED: `.planning/phases/01-one-day-napplet-runtime-mvp/01-CONTEXT.md`]

**Primary recommendation:** Pin the coherent current Kehto/napplet line, prove Deno import/runtime compatibility in Wave 0, then implement one end-to-end slice in dependency order: configuration/runtime singleton → account persistence → verified artifact → iframe/WebSocket bridge → identity → relay/outbox streams and publish. [VERIFIED: npm registry; codebase contracts]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Mobile Home/Profile/napplet views | Browser / Client | Frontend Server (SSR) | Fresh SSR supplies initial shell; island owns history, visibility, fade, Retry, and live state only. [VERIFIED: AGENTS.md] |
| Opaque-origin iframe and source binding | Browser / Client | API / Backend | Only the browser can compare `MessageEvent.source`; verified identity is issued by backend and bound to the created iframe/window namespace. [VERIFIED: Kehto runtime spec] |
| WebSocket command/event transport | API / Backend | Browser / Client | Fresh `App.ws()` owns endpoint and backend connection state; each tab owns one reconnecting client. [CITED: https://jsr.io/%40fresh/core/doc/all_symbols] |
| Accounts/signers/active identity | API / Backend | Database / Storage | Global backend account manager is authoritative; filesystem stores sensitive serialized records. [VERIFIED: Applesauce 6.2 package declarations] |
| Relay/event/outbox runtime | API / Backend | Database / Storage | Singleton Applesauce pool/store and Kehto services own Nostr processing and logical subscriptions. [VERIFIED: codebase grep] |
| Manifest/blob verification | API / Backend | CDN / Static | Backend resolves and verifies; browser receives verified HTML plus a runtime bootstrap, never an untrusted gateway URL. [VERIFIED: `@kehto/nip/5d` source] |
| Account snapshot | Database / Storage | API / Backend | A server-only adapter reads/writes the complete account-manager snapshot and active account ID. [VERIFIED: Applesauce account declarations; locked D-04/D-05] |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| MVP-01 | Replace starter UI with mobile-first shell | Fresh SSR + one narrow shell island and safe-area layout. |
| MVP-02 | Load one napplet in sandboxed iframe | Verified `srcdoc`, `sandbox="allow-scripts"`, persistent mounted iframe. |
| MVP-03 | Use napplet or compatible adapter | Pin `@napplet/core/@napplet/nap` 0.31 and inject only four supported domains. |
| MVP-04 | Backend runtime message boundary | Fresh WebSocket routes envelopes to process-wide Kehto runtime. |
| MVP-05 | Correlated success/errors without direct authority | Typed codec and pending-command timeout table; iframe receives no signer/relay objects. |
| AUTH-01 | Start Nostr sign-in | Account command envelopes over WebSocket. |
| AUTH-02 | Bunker URI | `NostrConnectSigner.fromBunkerURI` and `NostrConnectAccount`. |
| AUTH-03 | Nostr Connect QR/handoff | Backend-created Nostr Connect signer URI; QR rendered from non-secret URI. |
| AUTH-04 | `nsec` path with isolation | `PrivateKeyAccount.fromKey`; server-only filesystem serialization. |
| AUTH-05 | Document near-term read-only mode | Explicit deferred note; Applesauce `ReadonlyAccount` is available when scheduled. |
| AUTH-06 | Show active account | Broadcast manager `active$` projection; profile/avatar metadata is public data only. |
| STREAM-01 | Continuing Nostr streams | Keep subscriptions open after EOSE. |
| STREAM-02 | Applesauce/RxJS | `RelayPool.req`, `EventStore`, `merge`, `defer`, `finalize`, `share`. |
| STREAM-03 | No nested subscriptions | One composed observable per logical subscription. |
| STREAM-04 | Avoid complete-data awaits | Await setup/commands only; stream reads as values arrive. |
| STREAM-05 | Partial/empty/updating UI | Initial connection/identity/artifact snapshots and incremental events. |
| STREAM-06 | Initial then updated napplet stream | Store snapshot emitted before merged live relay path. |
| STREAM-07 | Local relay/Blossom seams | Endpoint arrays and injected artifact/event adapters include local URLs normally. |
| NAP-01 | Shell handshake | Source-bound `shell.ready`, exactly-once `shell.init`. |
| NAP-02 | Current identity | Kehto identity service backed by active Applesauce account. |
| NAP-03 | Backend-proxied Nostr stream | Relay/outbox service events traverse runtime → WebSocket → iframe. |
| NAP-04 | Typed errors | Recognized invalid/time-out operations use NAP result/error envelopes; unknown types stay silent. |
| QUAL-01 | Backend logic outside islands | Island contains transport/view state only. |
| QUAL-02 | Sensitive/Nostr infrastructure backend-owned | Account manager, signers, pool, store, Kehto runtime are process-wide server modules. |
| QUAL-03 | `deno task check` passes | Existing required quality gate plus focused `deno test`. |
| QUAL-04 | Document mocks/deferred items | README/runtime-status table is a release task. |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Preserve the sign-in → actual supplied verified napplet → Kehto handshake → initial-plus-updating backend stream tracer as the first executable checkpoint, targeted for one day; then complete all locked Phase 1 scope without a one-day deadline and do not preserve Fresh starter behavior unnecessarily. [VERIFIED: D-47 and AGENTS.md]
- Use Deno/Fresh; use routes for SSR/API boundaries and islands only for browser interaction. [VERIFIED: AGENTS.md]
- Prefer Applesauce for Nostr primitives, networking, relay connections, event storage, and workflows; preserve RxJS stream composition with no nested subscriptions or completeness waits. [VERIFIED: AGENTS.md]
- Keep persistent state, signing, relay connections, event stores, and complex Nostr logic on the backend. [VERIFIED: AGENTS.md]
- Integrate `../kehto` and `../napplet` using the smallest compatible subset; napplets remain sandboxed behind an explicit proxy boundary. [VERIFIED: AGENTS.md]
- Preserve local relay and local Blossom endpoints as future-compatible cache seams. [VERIFIED: AGENTS.md]
- Use Fresh file-route conventions, explicit local extensions, Deno formatting, two-space indentation, double quotes, Preact `class`, and direct imports without new barrels. [VERIFIED: AGENTS.md]
- Put file-routed APIs under `routes/api/`; type request state through `utils.ts`; return explicit status codes after input validation. [VERIFIED: AGENTS.md]
- Never log secrets or request bodies; keep `.env*` files uncommitted. [VERIFIED: AGENTS.md]
- Run `deno task check`; generated `_fresh/` stays excluded. [VERIFIED: AGENTS.md]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---|---:|---|---|
| `fresh` | 2.3.3 | SSR, file routes, WebSocket endpoint | Existing foundation; `App.ws()` is native in this version. [VERIFIED: JSR] |
| `@kehto/runtime` | 0.20.1 | Backend NAP dispatch/session/relay handlers | Current browser-agnostic runtime and peer-compatible with napplet 0.31. [VERIFIED: npm registry and official repository] |
| `@kehto/services` | 0.18.1 | Identity, relay-pool and outbox services | Existing canonical service contracts avoid reimplementing envelopes/routing. [VERIFIED: npm registry and official repository] |
| `@kehto/nip` | 0.5.1 | NIP-5A/5D artifact verification and NIP-65 helpers | `resolveNapplet()` verifies manifest signature, aggregate and blobs. [VERIFIED: npm registry and official repository] |
| `@napplet/core` | 0.31.0 | Shared envelope/Nostr contracts | Exact peer line required by current Kehto release. [VERIFIED: npm registry] |
| `@napplet/nap` | 0.31.0 | RELAY/OUTBOX/IDENTITY wire types and bindings | Exact peer line required by current Kehto release. [VERIFIED: npm registry] |
| `applesauce-core` | 6.2.0 | In-memory `EventStore`, event helpers | Locked backend event engine; installed declarations expose provenance-aware `add`. [VERIFIED: npm registry and installed official package] |
| `applesauce-relay` | 6.2.1 | `RelayPool`, relay messages, publish settlement | `req()` preserves `from`, EOSE and CLOSED; `publish()` returns per-relay responses. [VERIFIED: npm registry and installed official package] |
| `applesauce-accounts` | 6.2.0 | Global accounts, active signer proxy, serialization | Implements registered account types and complete signer serialization. [VERIFIED: npm registry and installed official package] |
| `applesauce-signers` | 6.2.2 | NIP-46 and private-key signing/encryption | Supplies `NostrConnectSigner` and `PrivateKeySigner`; NIP-46 session encoding is secret. [VERIFIED: npm registry and installed official package] |
| `rxjs` | 7.8.2 | Observable composition and teardown | Direct basis of Applesauce relay/account APIs. [VERIFIED: npm registry and official repository] |

### Supporting

| Library | Version | Purpose | When to Use |
|---|---:|---|---|
| `@kehto/shell` | 0.19.1 | Canonical browser handshake/prelude reference | Use only the portable injection/contract helpers that pass a Deno import spike; do not instantiate the browser-owned runtime in the island. [VERIFIED: npm registry and official repository] |
| `nostr-tools` | 2.24.1 | Kehto peer and signature/filter interop | Use only where required by Kehto services or verification adapters. [VERIFIED: npm registry and official repository] |
| `qrcode` | 1.5.4 | Render Nostr Connect URI | Generate display data from the non-secret connect URI; never from `nsec`/`nbunksec`. [VERIFIED: npm registry and official repository] |

### Alternatives Considered

Locked decisions leave no architectural alternatives. A custom NAP dispatcher, browser-side Nostr runtime, direct iframe URL, polling transport, and a second relay abstraction all conflict with D-16, D-21, D-24, or D-31. [VERIFIED: CONTEXT.md]

**Installation (after the required human verification checkpoint):**

```bash
deno add npm:@kehto/runtime@0.20.1 npm:@kehto/services@0.18.1 npm:@kehto/nip@0.5.1 npm:@kehto/shell@0.19.1
deno add npm:@napplet/core@0.31.0 npm:@napplet/nap@0.31.0
deno add npm:applesauce-core@6.2.0 npm:applesauce-relay@6.2.1 npm:applesauce-accounts@6.2.0 npm:applesauce-signers@6.2.2 npm:rxjs@7.8.2 npm:nostr-tools@2.24.1 npm:qrcode@1.5.4
```

Versions were checked against npm on 2026-07-30. All packages reported no `postinstall` script. [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---|---|---:|---:|---|---|---|
| applesauce-accounts | npm | ~1.6 yr | 688/wk | registry metadata omits repo | SUS | Flagged — planner adds checkpoint |
| applesauce-core | npm | ~1.8 yr | 1,765/wk | registry metadata omits repo | SUS | Flagged — planner adds checkpoint |
| applesauce-relay | npm | ~1.4 yr | 1,335/wk | registry metadata omits repo | SUS | Flagged — planner adds checkpoint |
| applesauce-signers | npm | ~1.5 yr | 1,102/wk | registry metadata omits repo | SUS | Flagged — planner adds checkpoint |
| rxjs | npm | ~14 yr | 99.5M/wk | github.com/reactivex/rxjs | OK | Approved |
| qrcode | npm | ~15 yr | 20.4M/wk | github.com/soldair/node-qrcode | OK | Approved |
| @kehto/runtime | npm | ~3 mo | 649/wk | github.com/kehto/web | SUS | Flagged — planner adds checkpoint |
| @kehto/shell | npm | ~3 mo | 582/wk | github.com/kehto/web | SUS | Flagged — planner adds checkpoint |
| @kehto/services | npm | ~3 mo | 595/wk | github.com/kehto/web | SUS | Flagged — planner adds checkpoint |
| @kehto/nip | npm | ~1.5 mo | 293/wk | github.com/kehto/web | SUS | Flagged — planner adds checkpoint |
| @napplet/core | npm | ~3 mo | 1,352/wk | github.com/sandwichfarm/napplet | SUS | Flagged — planner adds checkpoint |
| @napplet/nap | npm | ~2 mo | 1,503/wk | github.com/sandwichfarm/napplet | SUS | Flagged — planner adds checkpoint |
| nostr-tools | npm | ~5.5 yr | 1.0M/wk | github.com/nbd-wtf/nostr-tools | SUS | Flagged — planner adds checkpoint |

**Packages removed due to [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** applesauce-accounts, applesauce-core, applesauce-relay, applesauce-signers, @kehto/runtime, @kehto/shell, @kehto/services, @kehto/nip, @napplet/core, @napplet/nap, nostr-tools. The seam flags recent/low-volume packages even though the user named their local canonical repositories; planner must still insert a single `checkpoint:human-verify` covering the pinned set before installation. [VERIFIED: package-legitimacy seam]

## Architecture Patterns

### System Architecture Diagram

```text
Browser tab
  Fresh SSR shell
      ↓ hydrate narrowly
  Shell island ── one WebSocket ───────────────────────────┐
      │                                                     │
      ├─ Home/Profile/history state                         ▼
      └─ persistent iframe (opaque origin)          Fresh App.ws endpoint
             │ shell.ready / NAP envelopes                 │
             ▼                                              ▼
      source-bound postMessage bridge ─────────── connection/window registry
                                                            │
                                    ┌───────────────────────┼─────────────────────┐
                                    ▼                       ▼                     ▼
                             Kehto runtime            Account manager      Artifact resolver
                         IDENTITY/RELAY/OUTBOX      active$ + filesystem   NIP-5A/5D + Blossom
                                    │                       │                     │
                                    └──────────┬────────────┘                     │
                                               ▼                                  │
                              singleton Applesauce RelayPool + EventStore          │
                                               │                                  │
                                      public/local relays                session artifact cache
                                               │                                  │
                                               └──── streamed envelopes ──────────┘
```

### Recommended Project Structure

```text
runtime/
├── config.ts                 # immutable startup parsing/normalization
├── portal_runtime.ts         # process-wide composition root and teardown
├── accounts.ts               # AccountManager + login/reconnect/sign-out
├── account_store.ts          # sensitive filesystem snapshot adapter
├── artifacts.ts              # manifest fetch + Blossom + verified cache seam
├── relay_adapter.ts          # Applesauce pool/store ↔ Kehto adapters
├── outbox.ts                 # Kehto outbox router/service composition
├── connections.ts            # connection/window/subscription grace lifecycle
└── transport.ts              # validated WebSocket discriminated union
routes/
├── index.tsx                 # SSR shell snapshot
└── api/runtime.ts            # WebSocket route/upgrade boundary
islands/
└── NappletShell.tsx          # navigation, iframe, postMessage, socket only
components/
├── HomeView.tsx
├── ProfileView.tsx
└── NappletFrame.tsx
tests/
├── runtime_contract_test.ts
├── account_store_test.ts
├── artifact_resolver_test.ts
├── relay_stream_test.ts
└── websocket_session_test.ts
```

### Pattern 1: One Process-Wide Runtime, Per-Connection Windows

**What:** Construct config, account manager, `RelayPool`, `EventStore`, artifact cache, Kehto runtime and services once. Each WebSocket gets a connection ID; each iframe gets a window ID; subscription keys include connection/window/subId. Delay `runtime.destroyWindow(windowId)` until grace expiry. [VERIFIED: Hyprgate relay pool service and Kehto runtime API]

**When to use:** Always in Phase 1; this directly implements D-07, D-24, D-25, D-33 and D-34.

```ts
// Source: @kehto/runtime README and runtime types
const runtime = createRuntime({
  auth: accountAdapter,
  relayPool: relayAdapter,
  sendToNapplet: (windowId, message) => connections.send(windowId, message),
  // narrow remaining required hooks
});

runtime.registerService("identity", identityService);
runtime.registerService("outbox", outboxService);
```

### Pattern 2: Preserve Relay Provenance Before Simplifying the Stream

**What:** Use `RelayPool.req(relays, filters)` when relay source and EOSE/CLOSED matter. It emits typed messages carrying `from`; add events with `eventStore.add(message.event, message.from)` and emit `sidecar.relayHints: [message.from]`. Higher-level `subscription()` drops the source URL, so it cannot satisfy D-29 by itself. [VERIFIED: Applesauce 6.2.0/6.2.1 declarations]

```ts
// Source: installed Applesauce 6.2 official declarations
const live$ = pool.req(relays, filters).pipe(
  tap((message) => {
    if (message.type === "EVENT") {
      eventStore.add(message.event, message.from);
    }
  }),
  finalize(() => releaseLogicalSubscription(key)),
);
```

Emit one logical RELAY EOSE only after all active targeted relays have emitted EOSE or become terminal; do not complete the live stream at EOSE. NIP-01 defines EOSE as the boundary between stored and newly received events. [CITED: https://github.com/nostr-protocol/nips/blob/master/01.md]

### Pattern 3: Sensitive Account Snapshot Owned by the Server

**What:** Register `NostrConnectAccount`, `PrivateKeyAccount` (and later `ReadonlyAccount`) before `fromJSON()`. Persist `{version, activeAccountId, accounts: manager.toJSON()}`. `AccountManager.toJSON()` does not serialize the active selection, so the portal snapshot must. `NostrConnectAccount.toJSON()` includes client key, remote pubkey, relays and bunker secret; `PrivateKeyAccount.toJSON()` includes the private key. [VERIFIED: Applesauce accounts 6.2.0 source/declarations]

```ts
// Source: applesauce-accounts 6.2.0 official package
manager.registerType(NostrConnectAccount);
manager.registerType(PrivateKeyAccount);
manager.fromJSON(snapshot.accounts);
if (snapshot.activeAccountId) manager.setActive(snapshot.activeAccountId);
```

Write the whole snapshot via a temporary sibling file followed by rename and restrict the directory/file using host permissions; serialize mutations through one write queue to prevent overlapping snapshots. The atomic replacement is an implementation recommendation derived from the locked persistence requirement. [ASSUMED]

### Pattern 4: Verified `srcdoc`, Then Inject the Minimum Runtime Namespace

**What:** Resolve manifest event → `resolveNapplet({event, fetchBlob, cache})` → verify required domains → prepend the Kehto shell/domain prelude outside verified bytes → send `indexHtml` to the browser → create `srcdoc` iframe with only `allow-scripts`. The returned `(dTag, aggregateHash)` is computed from verified content and must be recorded with the iframe's window ID before messages are accepted. [VERIFIED: `../kehto/packages/nip/src/5d/index.ts`; Kehto RUNTIME-SPEC]

### Pattern 5: Reconnect by Declarative Subscription Registry

**What:** The browser retains only active logical request descriptions (`domain`, `subId`, filters/options), not events or signer state. On reconnect it reattaches its prior connection token within the grace window, then replays registration envelopes. Backend cleanup is idempotent; close removes registry entry before unsubscribing, preventing late emissions. [VERIFIED: locked D-32/D-34; Hyprgate cleanup pattern]

### Anti-Patterns to Avoid

- **Instantiate Kehto/Applesauce in the island:** violates backend ownership and exposes signer/relay authority. Use server runtime adapters. [VERIFIED: AGENTS.md]
- **Use `pool.subscription()` and invent relay hints from the target list:** it loses exact `from`; use `pool.req()` for provenance-sensitive flows. [VERIFIED: Applesauce declarations]
- **Treat EOSE as completion:** it is the transition into live delivery. [CITED: https://github.com/nostr-protocol/nips/blob/master/01.md]
- **Reply to unknown message types:** NIP-5D/Kehto requires silent ignore; only recognized failures receive typed errors. [VERIFIED: Kehto RUNTIME-SPEC]
- **Recreate iframe while navigating Home/Profile:** hide it; otherwise in-memory state and NIP-5D lifecycle are lost. [VERIFIED: D-12]
- **Mix Kehto 0.19/local peer line with napplet 0.31:** the declared peer ranges are incompatible. [VERIFIED: package manifests]
- **Persist only bunker URI:** Nostr Connect restoration needs its client private key/session data; use Applesauce account serialization. [VERIFIED: Applesauce accounts source]
- **Promise success before relay acceptance:** await Applesauce publish responses and preserve per-relay outcomes. [VERIFIED: Kehto shell/runtime docs]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| NAP dispatch/envelopes | Custom domain switch and result shapes | `@kehto/runtime`, `@kehto/services`, `@napplet/nap` | Draft contracts and sanctioned error behavior are already encoded. [VERIFIED: Kehto source] |
| Manifest/blob trust | Hash checks scattered across fetch code | `@kehto/nip/5d resolveNapplet()` | It verifies signature, aggregate, every blob and index presence. [VERIFIED: Kehto source] |
| Account/signer serialization | Portal-specific key JSON | Applesauce `AccountManager` and account classes | Complete NIP-46 client session and `nsec` state are easy to omit. [VERIFIED: Applesauce source] |
| Relay connections/reconnect | Raw WebSocket relay client | Applesauce `RelayPool` | Pool owns reconnect, resubscribe, group and publish behavior. [VERIFIED: Applesauce package README] |
| Event semantics/dedup | `Map<eventId,event>` | Applesauce `EventStore` | Store handles replaceable/delete/expiration semantics and dedup. [VERIFIED: Applesauce declarations] |
| Outbox routing/fanout | Custom NIP-65 loops | Kehto `createRelayPoolOutboxRouter()` | Existing router owns discovery, fallback, exact relay sightings and fanout outcomes. [VERIFIED: Kehto services source] |
| QR encoding | Custom SVG/QR algorithm | `qrcode` | Mature, dependency-audited encoder. [VERIFIED: npm registry] |

**Key insight:** The portal should hand-roll only narrow adapters between Deno/Fresh transport, Applesauce primitives, and Kehto interfaces—not protocol behavior. [VERIFIED: codebase boundaries]

## Common Pitfalls

### Pitfall 1: Package/API Drift Breaks the First Compile
**What goes wrong:** Local Kehto and napplet source versions compile individually but not together.
**Why it happens:** Checked-out Kehto peers target 0.29 while napplet is 0.31; npm has a newer aligned Kehto line. [VERIFIED: manifests and npm]
**How to avoid:** First plan task pins one coherent line and runs a Deno import/check smoke test before implementation.
**Warning signs:** Peer warnings, missing exports, envelope types resolving twice.

### Pitfall 2: `AccountManager.toJSON()` Is Mistaken for Complete Portal State
**What goes wrong:** Accounts restore but active selection does not, or NIP-46 records are skipped because account types were not registered.
**Why it happens:** The manager serializes accounts only and `fromJSON()` looks up registered types. [VERIFIED: Applesauce source]
**How to avoid:** Versioned portal snapshot, register types first, restore active ID explicitly, fail visibly on corrupt/unknown records.
**Warning signs:** Active account undefined after restart; `Missing account type nostr-connect`.

### Pitfall 3: Source Identity Is Lost Across Two Hops
**What goes wrong:** Any iframe or reconnecting tab can claim another window ID.
**Why it happens:** `MessageEvent.source` is authoritative only in the browser; the backend sees WebSocket data, not a DOM source.
**How to avoid:** Island assigns messages only to the window ID already bound to the exact iframe `contentWindow`; WebSocket connection owns that window namespace and rejects caller-selected foreign IDs. [VERIFIED: Kehto source-binding contract]
**Warning signs:** Inbound payload includes arbitrary connection/window identity accepted as truth.

### Pitfall 4: Fake Relay Provenance
**What goes wrong:** Every targeted relay is listed as a hint even when only one delivered the event.
**Why it happens:** Higher-level deduplicated streams discard source information.
**How to avoid:** Consume `RelayPool.req()` messages and capture `message.from` before dedup; omit hints for cache/store replay without known provenance. [VERIFIED: Applesauce types; D-29]
**Warning signs:** Sidecar hints equal the entire relay plan for every event.

### Pitfall 5: Grace Reconnect Leaks or Duplicates Subscriptions
**What goes wrong:** A tab reconnect creates a second live subscription while the old one survives.
**Why it happens:** Connection and logical subscription state are conflated.
**How to avoid:** Stable reconnect token, explicit detached state, idempotent key `(connection, window, subId)`, replace/close before reopen, one expiry timer.
**Warning signs:** duplicate events after network toggle or two cleanup functions under one key.

### Pitfall 6: Publish Semantics Drift
**What goes wrong:** RELAY signs a template or OUTBOX forwards an unsigned template, violating D-37; success is sent before acknowledgement.
**Why it happens:** Older Kehto README text and current locked package contract differ.
**How to avoid:** Contract tests freeze D-37 before wiring; RELAY validates and forwards signed event unchanged; OUTBOX signs with active account and returns settled per-relay results. [VERIFIED: locked D-37/D-40]
**Warning signs:** RELAY handler calls active signer for `relay.publish`; publish result has no settled relay outcomes.

### Pitfall 7: `srcdoc` Asset References Break
**What goes wrong:** Verified HTML loads but relative scripts/styles are absent.
**Why it happens:** `resolveNapplet()` returns all verified files plus HTML; a bare `srcdoc` does not automatically serve sibling paths from the in-memory artifact map.
**How to avoid:** At the mandatory Wave 0 artifact checkpoint, determine whether the user-provided napplet is single-file or requires the exact Kehto artifact assembly mechanism, then capture that behavior in the real fixture before implementation. [VERIFIED: `ResolvedNapplet.files` and `indexHtml`; resolution path locked]
**Warning signs:** iframe console 404s or authored script never sends `shell.ready`.

## Code Examples

### Fresh WebSocket Endpoint

```ts
// Source: https://jsr.io/@fresh/core/doc/all_symbols
app.ws("/api/runtime", {
  open(socket) {
    portalRuntime.attach(socket);
  },
  message(socket, event) {
    portalRuntime.receive(socket, event.data);
  },
  close(socket) {
    portalRuntime.detachWithGrace(socket);
  },
});
```

### Nostr Connect Session Setup

```ts
// Source: applesauce-signers 6.2 official README
NostrConnectSigner.subscriptionMethod = subscriptionMethod;
NostrConnectSigner.publishMethod = publishMethod;

const signer = new NostrConnectSigner({
  relays,
  signer: new PrivateKeySigner(),
});
const uri = signer.getNostrConnectURI({ name: "Napplet Portal" });
```

### Verified Napplet Resolution

```ts
// Source: ../kehto/packages/nip/src/5d/index.ts
const resolved = await resolveNapplet({
  event: manifestEvent,
  fetchBlob: artifactAdapter.fetchBlob,
  cache: artifactAdapter.cache,
});

const identity = {
  dTag: resolved.dTag,
  aggregateHash: resolved.aggregateHash,
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Kehto 0.19 + napplet 0.29 | Kehto runtime 0.20.1 / shell 0.19.1 / services 0.18.1 + napplet 0.31 | Published 2026-07-29 | Pin current coherent peer line; local checkout manifests are reference-only unless updated/built together. [VERIFIED: npm] |
| `RelayPool.subscription()` for everything | `RelayPool.req()` when relay provenance/lifecycle is required | Applesauce 6.2 declarations | Preserve `from`, EOSE and CLOSED before mapping. [VERIFIED: package declarations] |
| Gateway URL in iframe | Verified NIP-5A/5D bytes in opaque-origin `srcdoc` | Kehto NIP-5D current model | Gateway/Blossom is not trusted; bind computed content identity. [VERIFIED: Kehto RUNTIME-SPEC] |
| Finite Nostr request loading | Store snapshot merged with continuing live observable | Current locked architecture | UI/napplet handles empty, partial and updating states. [VERIFIED: D-24/D-30] |

**Deprecated/outdated:**
- Kehto docs in the checked-out source that describe NAP-RELAY publish as accepting a template conflict with locked D-37 and current napplet types; the plan must follow D-37 and pin contract tests. [VERIFIED: local docs/types and CONTEXT.md]
- Browser `localStorage` account persistence from Hyprgate is unsuitable here; D-04/D-05 require backend filesystem persistence. [VERIFIED: CONTEXT.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | A temporary-file plus rename snapshot is portable enough for the target host and desired atomicity. | Account persistence pattern | Corrupt account file after interrupted write; planner should test on target filesystem. |
| A2 | The user-provided test napplet can be rendered from the verified artifact assembly without a broader asset-serving protocol. | Pitfall 7 | Handshake fails; may require a small verified in-memory asset URL strategy. |
| A3 | A 15-second reconnect grace is a suitable “short” default. | Configuration | Mobile network transitions may need tuning; make it configurable. |

## Open Questions (RESOLUTION PATH LOCKED)

These are governed prerequisites, not open design choices. The package-only Deno import question is resolved by the executable Wave 0 probe in Plan 01. The two supplied-napplet questions remain blocked until the user provides the actual coordinate/artifact; Plan 01 has a mandatory blocking checkpoint that requires the captured fixture before any artifact-dependent plan can execute. No authored example or invented fixture may substitute.

1. **Can the user-provided napplet run from the chosen `srcdoc` assembly path?**
   - What we know: `resolveNapplet()` returns verified `indexHtml` and a map of all verified files. [VERIFIED: Kehto source]
   - What's unclear: whether its scripts/styles are fully inlined or require relative resource resolution.
   - Locked resolution: capture and verify the actual supplied artifact at the mandatory Plan 01 checkpoint before artifact, UI, stream, or integration plans execute.

2. **Which exact NAP-RELAY 0.31 publish wire shape does the supplied napplet emit?**
   - What we know: locked D-37 requires an already-signed event; checked-out older Kehto docs describe historical drift.
   - What's unclear: whether the supplied test napplet already targets the current 0.31 contract.
   - Locked resolution: freeze the actual napplet's RELAY/OUTBOX JSON fixture at the mandatory Plan 01 checkpoint and assert it against installed 0.31 types; do not invent the fixture.

3. **Does current `@kehto/shell` import cleanly in Deno server code for prelude-only helpers?**
   - What we know: package is browser-specific; runtime is browser-agnostic. [VERIFIED: Kehto docs]
   - What's unclear: whether tree-shaking prevents browser-global evaluation during a server import.
   - Locked resolution: the package-only Wave 0 import probe must execute before feature work; if server import evaluates browser globals, use the canonical napplet types and a minimal source-bound bridge without copying package behavior.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---|---|
| Deno | Fresh app/build/test | ✓ | 2.9.4 | — |
| Node/npm | Registry/package audit and Vite npm ecosystem | ✓ | Node 26.5.0 / npm 11.17.0 | Deno npm resolver for implementation |
| pnpm | Sibling package builds/tests if needed | ✓ | 11.16.0 | Use published pinned packages |
| `../kehto` | Canonical runtime contracts/source | ✓ | local runtime 0.19.0 line | Published coherent 0.20.1 line |
| `../napplet` | Canonical NAP contracts/source | ✓ | local core/nap 0.31.0 | Published 0.31.0 |
| `../hyprgate-gui` | Applesauce adapter patterns | ✓ | private app | Reference only |
| Kehto built `dist` | Optional local import spike | ✓ | local checkout | npm packages |
| Napplet built `dist` | Optional local import spike | ✓ | local checkout | npm packages |
| Test napplet coordinate/artifact | End-to-end contract | ✗ not in repo/config | — | User supplies; no project-authored demo per D-22 |

**Missing dependencies with no fallback:** configured test napplet coordinate/artifact is required for true end-to-end acceptance.

**Missing dependencies with fallback:** local package peer mismatch is bypassed by current coherent npm release line after human verification.

## Validation Architecture

> Included at orchestrator request even though `.planning/config.json` sets `workflow.nyquist_validation` to `false`. [VERIFIED: config]

### Test Framework

| Property | Value |
|---|---|
| Framework | Deno built-in test runner 2.9.4 |
| Config file | `deno.json` (add a `test` task in Wave 0) |
| Quick run command | `deno test -A tests/runtime_contract_test.ts tests/account_store_test.ts tests/relay_stream_test.ts` |
| Full suite command | `deno task check && deno test -A` |

### Phase Requirements → Test Map

| Req IDs | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| MVP-01, QUAL-01 | Starter removed; island imports no backend-only packages | structural/unit | `deno test -A tests/shell_architecture_test.ts` | ❌ Wave 0 |
| MVP-02, MVP-03, NAP-01 | verified iframe attributes, source binding, exactly-once init | unit/integration | `deno test -A tests/iframe_bridge_test.ts` | ❌ Wave 0 |
| MVP-04, MVP-05, NAP-04 | correlated transport, timeout, unknown silent-ignore | unit | `deno test -A tests/runtime_contract_test.ts` | ❌ Wave 0 |
| AUTH-01..AUTH-06 | three login flows, persistence, offline restore, broadcast/sign-out | unit/integration | `deno test -A tests/accounts_test.ts tests/account_store_test.ts` | ❌ Wave 0 |
| STREAM-01..STREAM-06 | store-first/live-tail, no duplicate delivery, EOSE not completion | marble/integration | `deno test -A tests/relay_stream_test.ts` | ❌ Wave 0 |
| STREAM-07 | local/public endpoints normalize into same adapters | unit | `deno test -A tests/config_test.ts` | ❌ Wave 0 |
| NAP-02 | identity read/change/offline/sign-out projections | integration | `deno test -A tests/identity_service_test.ts` | ❌ Wave 0 |
| NAP-03 | relay/outbox event traverses backend transport | integration | `deno test -A tests/websocket_session_test.ts` | ❌ Wave 0 |
| QUAL-02 | browser bundle/source has no keys/signers/pool/store | structural | `deno test -A tests/shell_architecture_test.ts` | ❌ Wave 0 |
| QUAL-03 | format/lint/typecheck | static | `deno task check` | ✅ existing |
| QUAL-04 | mocked/deferred table present | documentation | `deno test -A tests/docs_test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** focused `deno test -A tests/<owned_test>.ts` plus `deno check <changed entry>`
- **Per wave merge:** `deno task check && deno test -A`
- **Phase gate:** full suite green plus manual supplied-napplet/mobile/reconnect acceptance before `$gsd-verify-work`

### Wave 0 Gaps
- [ ] Add `deno task test` using the built-in runner; no external test framework is required.
- [ ] Add typed fake relay, signer, WebSocket, clock, filesystem and Blossom adapters.
- [ ] Add a contract fixture captured from the user-provided napplet; do not author a demo napplet.
- [ ] Add import smoke tests for the exact pinned Kehto/napplet/Applesauce line.
- [ ] Add manual checklist for real Nostr Connect QR/handoff, bunker reconnect, mobile history/safe areas, disconnect grace, and relay acknowledgement.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes (Nostr account, not portal auth) | Applesauce account/signers; loopback trusted-operator boundary. [VERIFIED: D-35] |
| V3 Session Management | yes | Server-issued connection/window IDs, grace expiry, teardown, exactly-once shell session. [VERIFIED: D-21/D-34] |
| V4 Access Control | yes | Only verified napplet identity and four injected domains; Kehto session/capability checks. [VERIFIED: D-16/D-17/D-21] |
| V5 Input Validation | yes | Discriminated envelope parsing, URL normalization, manifest verification, source binding. [VERIFIED: locked decisions] |
| V6 Cryptography | yes | Applesauce signers/encryption and `@kehto/nip` verification; never hand-roll. [VERIFIED: locked decisions] |

### Known Threat Patterns for Deno/Fresh + Sandboxed Napplet Runtime

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Forged iframe/window identity | Spoofing | Compare `MessageEvent.source` with registered iframe `contentWindow`; bind server window namespace to its WebSocket. |
| Unverified/manipulated artifact | Tampering | Verify manifest signature, NIP-5A aggregate and every blob; fail closed. |
| Cross-tab subscription takeover | Elevation of privilege | Server-generated connection IDs and connection/window/subId ownership checks. |
| Secret exposure in browser/log/URL | Information disclosure | Server-only account store; structured allowlisted logs; never serialize signer records to browser. |
| Malformed/high-rate envelopes | Denial of service | Size/type validation, correlation timeout, subscription cleanup, connection grace expiry; Phase 1 remains loopback-only. |
| Premature publish success | Repudiation | Await relay OK/Kehto required fanout settlement; return per-relay outcomes. |
| Endpoint abuse / LAN exposure | Spoofing/Information disclosure | Default bind `127.0.0.1`; explicit opt-in for broader bind; validate ws/wss and http/https endpoint schemes. |

Security enforcement is enabled at ASVS Level 1. Production hardening is deferred, but loopback default, source binding, verified artifacts, secret isolation, input validation, and teardown are Phase 1 controls—not deferrable polish. [VERIFIED: `.planning/config.json`; CONTEXT.md]

## Sources

### Primary (HIGH confidence)
- `../kehto/RUNTIME-SPEC.md` and package source — handshake, sandbox, verified identity, unknown-type behavior.
- `../kehto/packages/runtime/src/relay-handler.ts`, `relay-result.ts`, and services source — dispatch/lifecycle/result contracts.
- `../kehto/packages/nip/src/5d/index.ts` — verified artifact pipeline.
- `../napplet/packages/core/src/types/nostr.ts`, relay/outbox types — current wire shapes.
- `../hyprgate-gui/apps/shell/src/lib/relay/*` and Kehto bootstrap/outbox sources — adapter/cleanup patterns.
- Installed official Applesauce 6.2 package README, JS, and declarations — accounts, signers, pool, store APIs.
- [Fresh 2.3.3 JSR API](https://jsr.io/%40fresh/core/doc/all_symbols) — `App.ws` and context upgrade.
- [Deno WebSocket API](https://docs.deno.com/api/deno/websockets/) — upgrade behavior.
- [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md) — relay lifecycle.

### Secondary (MEDIUM confidence)
- npm registry metadata captured 2026-07-30 — current versions, peer ranges, publication dates.
- [Nostr NIPs index](https://github.com/nostr-protocol/nips) — current NIP status/index.

### Tertiary (LOW confidence)
- None used as authoritative support. Assumptions are isolated in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — exact versions and peers verified, but many required packages are legitimacy-gate SUS because they are young/low-volume.
- Architecture: HIGH — constrained by locked decisions and canonical local implementation contracts.
- Pitfalls: HIGH — derived from direct version/API/source inspection.

**Research date:** 2026-07-30
**Valid until:** 2026-08-06 (draft NAP/Kehto packages are fast-moving)
