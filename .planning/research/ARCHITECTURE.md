# Architecture Research

**Domain:** Deno Fresh server-side napplet runtime
**Researched:** 2026-07-30
**Confidence:** MEDIUM

## Standard Architecture

### System Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Browser / Mobile Web App Shell                       │
│                                                                              │
│  Fresh route HTML                                                            │
│  ┌───────────────────────────┐                                               │
│  │ /, /n/:id, /settings      │ server-rendered shell, nav, modals, metadata  │
│  └──────────────┬────────────┘                                               │
│                 │ serializable props only                                    │
│                 ▼                                                            │
│  Fresh islands                                                               │
│  ┌───────────────────────────┐     postMessage / fetch / EventSource or WS   │
│  │ NappletHostIsland         │◄───────────────────────────────────────────┐  │
│  │ SignInIsland              │                                            │  │
│  │ ApprovalModalIsland       │                                            │  │
│  │ MobileNavIsland           │                                            │  │
│  └──────────────┬────────────┘                                            │  │
│                 │ creates iframe, owns DOM listener                       │  │
│                 ▼                                                        │  │
│  napplet sandbox iframe                                               │  │
│  ┌───────────────────────────┐                                            │  │
│  │ sandboxed napplet page    │ -- window.napplet.* NAP calls ------------┘  │
│  │ @napplet/sdk              │                                               │
│  └───────────────────────────┘                                               │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │ authenticated HTTP/SSE/WS message bridge
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Fresh Server Boundary                                │
│                                                                              │
│  main.ts composition root                                                    │
│  ┌───────────────────────────┐                                               │
│  │ staticFiles + middleware  │  session cookie → ctx.state.account/session   │
│  └──────────────┬────────────┘                                               │
│                 ▼                                                            │
│  routes/ pages and APIs                                                      │
│  ┌───────────────────────────┐                                               │
│  │ page routes               │ render thin shell                             │
│  │ /api/session              │ sign-in/out/account                           │
│  │ /api/nap/*                │ NAP request/stream bridge                     │
│  │ /napplet-gateway/*        │ verified napplet artifacts                    │
│  └──────────────┬────────────┘                                               │
└─────────────────┼────────────────────────────────────────────────────────────┘
                  │ direct service calls, not browser globals
                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Backend Runtime Services                             │
│                                                                              │
│  RuntimeRegistry ── SessionManager ── AccountService ── ApprovalService       │
│        │                    │                  │              │              │
│        ▼                    ▼                  ▼              ▼              │
│  NappletSession       KehtoAdapter      NostrRuntime      NAP services        │
│  per iframe/window    runtime/shell     Applesauce-owned  identity/outbox/    │
│  message routing      service bridge    relay + stores    storage/resource    │
└────────────────────────────────┬─────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Storage / Network Layer                              │
│                                                                              │
│  SQLite/LibSQL app DB        Applesauce Event DB        External networks     │
│  accounts, sessions,         Nostr events, relay        Nostr relays,         │
│  grants, configs,            sync cursors, search       Blossom/media,        │
│  napplet state               indexes                    HTTPS resources       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Fresh composition root | Register static files, global security/session middleware, typed request state, and file-system routes. Keep it composition-only. | `main.ts` with `App<State>()`, `staticFiles()`, session/account middleware, `app.fsRoutes()` |
| Fresh page routes | Render server-first shell pages: napplet viewport, sign-in/settings/approval views, mobile navigation, active account display. Do not run Nostr sync or NAP behavior here. | `routes/index.tsx`, `routes/napplets/[id].tsx`, `routes/settings.tsx`, route layouts |
| Fresh API routes | Provide narrow HTTP boundaries into backend services: session auth, account management, NAP RPC/stream bridge, resource fetch, artifact gateway. | `routes/api/session.tsx`, `routes/api/nap/[sessionId].tsx`, `routes/api/nap/stream/[sessionId].tsx` |
| Fresh islands | Own browser-only behavior: iframe creation, postMessage listener, transient UI state, approval modal controls, bottom nav interactions. They pass authenticated messages to APIs but do not hold authoritative Nostr state. | `islands/NappletHost.tsx`, `islands/ApprovalModal.tsx`, `islands/SignInForm.tsx` using `IS_BROWSER` guards |
| napplet sandbox | Browser iframe layer that hosts napplet code and exposes/uses injected `window.napplet.*` domains. It is untrusted relative to the app shell. | Sibling `../napplet` packages for SDK/shim/runtime-injected domains |
| Sandbox message bridge | Validate `postMessage` origin/source/session, normalize NAP envelopes, assign correlation IDs, and forward to backend over same-origin authenticated channel. | Browser island bridge plus backend `/api/nap/*` handlers; optionally upgrade to WebSocket when bidirectional streaming is needed |
| Backend runtime registry | Own process-level runtime singletons and per-account/per-napplet session objects. Map user session + iframe instance to a `NappletSession`. | `runtime/registry.ts`, `runtime/session.ts` modules outside `routes/` and `islands/` |
| Kehto runtime adapter | Preserve Kehto boundary: browser shell owns DOM transport; runtime owns protocol dispatch, ACL gates, service routing, runtime state. Server adapter implements services using backend dependencies. | `runtime/kehto/adapter.ts`, `runtime/kehto/services/*.ts` wrapping `../kehto` APIs |
| NAP service layer | Implement domains such as identity, outbox, relay, common, storage, config, resource, notify, keys, lists, media as backend services. | `runtime/nap/*.ts` services with explicit input/output schemas and permission checks |
| Applesauce Nostr runtime | Own Nostr event authority, relay connections, loaders, outbox routing, publish fanout, subscriptions, relay sync, and model derivation. | Single `AsyncEventStore`/`EventStore` per process or account scope, `RelayPool`, loaders, sync workers |
| Account/session service | Own sign-in state, active pubkey/account, signer binding policy, session cookies, CSRF controls, account-scoped runtime lookup. | `services/accounts.ts`, `services/sessions.ts`, app DB tables |
| Approval service | Own user consent for capability grants, signing requests, destructive Nostr actions, external resource access, and notification/media permissions. | `services/approvals.ts` plus pending request table/queue and approval island |
| Persistence layer | Separate app metadata from Nostr event storage. App DB stores sessions/accounts/grants/config; Applesauce DB stores Nostr events and queryable event state. | SQLite/LibSQL app tables; Applesauce SQLite/LibSQL event database |
| Relay/blossom/resource boundary | Backend-only external network access. Napplets request data through NAP domains; runtime enforces policy, fetches, verifies, caches, and returns results. | `runtime/resources.ts`, `runtime/blossom.ts`, Applesauce relay pool |

## Recommended Project Structure

```text
napplet-portal/
├── main.ts                         # Fresh composition root only
├── utils.ts                        # Fresh State type + define helper
├── routes/
│   ├── _app.tsx                    # document shell + global metadata/CSP hooks
│   ├── index.tsx                   # landing or default napplet route
│   ├── napplets/
│   │   └── [id].tsx                # server-rendered napplet shell page
│   ├── settings.tsx                # account/runtime settings page
│   ├── api/
│   │   ├── session.tsx             # sign-in/out/current session
│   │   ├── accounts.tsx            # account selection and relay settings
│   │   ├── approvals.tsx           # pending approval read/decision endpoints
│   │   └── nap/
│   │       ├── [sessionId].tsx     # request/response NAP RPC bridge
│   │       └── stream/[sessionId].tsx # SSE/WS-style event delivery if needed
│   └── napplet-gateway/
│       └── [...path].tsx           # verified artifact serving, not raw arbitrary files
├── islands/
│   ├── NappletHost.tsx             # iframe lifecycle + message bridge
│   ├── ApprovalModal.tsx           # user consent UI
│   ├── SignInForm.tsx              # browser form interactions only
│   └── MobileNav.tsx               # bottom navigation/avatar interactivity
├── components/
│   ├── AppShell.tsx                # presentational shell
│   ├── Avatar.tsx                  # display primitives
│   └── PermissionCopy.tsx          # reusable non-interactive UI
├── runtime/
│   ├── registry.ts                 # singleton runtime registry composition
│   ├── session.ts                  # NappletSession lifecycle and correlation IDs
│   ├── messages.ts                 # NAP envelope schemas/validation
│   ├── kehto/
│   │   ├── adapter.ts              # bridge from server runtime to Kehto contracts
│   │   └── services.ts             # service registration surface
│   ├── nap/
│   │   ├── identity.ts             # NAP-IDENTITY
│   │   ├── relay.ts                # low-level relay domain
│   │   ├── outbox.ts               # outbox-aware query/publish/subscribe
│   │   ├── storage.ts              # scoped napplet storage
│   │   ├── config.ts               # validated per-napplet config
│   │   ├── resource.ts             # shell-mediated bytes/fetch/blossom
│   │   ├── common.ts               # social actions and consent
│   │   └── inc.ts                  # inter-napplet messages
│   ├── nostr/
│   │   ├── event-store.ts          # Applesauce EventStore/AsyncEventStore setup
│   │   ├── relays.ts               # RelayPool, relay selection, NIP-65 helpers
│   │   ├── sync.ts                 # sync workers/cursors/subscriptions
│   │   └── signer.ts               # server-side signer abstraction/bunker hooks
│   └── artifacts/
│       ├── resolver.ts             # manifest/blob resolution and verification
│       └── gateway.ts              # safe gateway response construction
├── services/
│   ├── accounts.ts                 # account records, active account
│   ├── sessions.ts                 # HTTP session cookie + persisted session state
│   ├── approvals.ts                # grant requests and decisions
│   └── settings.ts                 # user/app settings
├── storage/
│   ├── db.ts                       # app DB connection/migrations
│   ├── schema.ts                   # app tables: accounts, grants, configs, sessions
│   └── event-db.ts                 # Applesauce event DB construction
└── shared/
    ├── types.ts                    # serializable DTOs shared by routes/islands/runtime
    └── errors.ts                   # stable error envelopes
```

### Structure Rationale

- **Keep Fresh conventions intact:** `routes/` owns URL behavior, `islands/` owns hydration, `components/` owns presentation, and `utils.ts` remains the typed Fresh request-state seam.
- **Move runtime code out of routes:** backend Nostr/NAP logic belongs in `runtime/` and `services/`; API routes should validate requests, call services, and return stable envelopes.
- **Split app DB from event DB:** app metadata has product-specific invariants; Nostr events benefit from Applesauce's event-store semantics, deduplication, replaceable/delete handling, and relay integrations.
- **Make Kehto and napplet explicit integration boundaries:** do not invent a third protocol shape in Fresh handlers; adapt Fresh/browser/server concerns to the sibling packages' contracts.

## Architectural Patterns

### Pattern 1: Thin Fresh Boundary, Thick Runtime Services

**What:** Fresh routes and islands are delivery adapters. The runtime registry, account service, NAP services, and Applesauce stores are plain TypeScript modules with no dependency on Preact components.

**When to use:** Always for this project. The product requirement is backend-owned Nostr/client runtime behavior with a lightweight mobile shell.

**Trade-offs:** Slightly more module plumbing up front, but prevents route files and islands from becoming untestable Nostr clients.

**Example:**

```ts
// routes/api/nap/[sessionId].tsx
export const handler = define.handlers({
  async POST(ctx) {
    const account = ctx.state.account;
    if (!account) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const envelope = await ctx.req.json();
    const result = await runtimeRegistry.forAccount(account.id)
      .handleNapMessage(ctx.params.sessionId, envelope);

    return Response.json(result);
  },
});
```

### Pattern 2: Backend Runtime Registry

**What:** A process-level registry owns initialized dependencies: app DB, Applesauce event store/database, relay pool, Kehto adapter, per-account sessions, cleanup hooks. Fresh middleware places only a lightweight account/session reference into `ctx.state`.

**When to use:** Build this before NAP domains. Every later feature needs stable lifecycle and lookup semantics.

**Trade-offs:** In a single Deno process this is straightforward. Multi-instance deployment later requires shared DB-backed session/grant state and either sticky runtime sessions or externalized message streams.

**Example:**

```ts
type RuntimeRegistry = {
  forAccount(accountId: string): AccountRuntime;
  createNappletSession(input: CreateSessionInput): Promise<NappletSession>;
  disposeNappletSession(sessionId: string): Promise<void>;
};
```

### Pattern 3: Explicit Sandbox Message Envelope

**What:** Treat every iframe message as untrusted. The island verifies `event.source`, expected origin where possible, and session nonce before forwarding. The server validates schema, account binding, napplet identity, ACL, and domain capability before service execution.

**When to use:** For all NAP calls and sandbox events. `postMessage` is the correct cross-window transport, but MDN's security guidance requires origin/source and syntax validation.

**Trade-offs:** Adds ceremony to every message, but avoids ambient authority leaks and confused-deputy bugs.

**Example:**

```ts
type NapBridgeEnvelope = {
  type: "nap.call";
  sessionId: string;
  iframeNonce: string;
  requestId: string;
  domain: "identity" | "outbox" | "relay" | "storage" | "resource";
  method: string;
  payload: unknown;
};
```

### Pattern 4: Capability-Gated NAP Services

**What:** The runtime exposes only the NAP domains actually supported for a loaded napplet. Kehto capability negotiation says required capabilities fail early; optional domains are absent from `window.napplet` and napplet code must feature-detect.

**When to use:** At napplet artifact load and before each service call.

**Trade-offs:** Requires a grant inventory and approval UI, but this is the core safety model for server-owned signers, relays, storage, and resource fetches.

### Pattern 5: Applesauce as Nostr Authority

**What:** Use one Applesauce event store layer as the canonical Nostr event authority for dedupe, replaceable/delete handling, models, loaders, and persistence. Use RelayPool for relay requests, subscriptions, publish fanout, outbox subscriptions, and sync.

**When to use:** From the first relay-backed feature onward.

**Trade-offs:** The LibSQL-backed store is async and requires `AsyncEventStore`; design service APIs async from the start. Avoid mixing direct relay responses into UI state without inserting verified events into the store.

## Data Flow

### Request Flow: Napplet Page Load

```text
Mobile browser navigates /napplets/:id
    ↓
Fresh middleware reads session cookie → ctx.state.account/session
    ↓
Fresh page route resolves shell DTO: active account, napplet id, session nonce, supported domains
    ↓
Server-rendered AppShell includes NappletHost island with serializable props only
    ↓
NappletHost island creates sandboxed iframe for /napplet-gateway/:dTag/:aggregateHash/index.html
    ↓
Artifact gateway serves verified manifest/blobs with restrictive headers
    ↓
napplet/shim injects or uses window.napplet domains before authored napplet code executes
    ↓
Napplet sends ready/auth/capability messages to host bridge
    ↓
Backend RuntimeRegistry creates/binds NappletSession and capability grants
```

### NAP API / Message Flow

```text
Napplet code calls @napplet/sdk domain method
    ↓
window.napplet.<domain> creates typed NAP envelope with requestId
    ↓
iframe postMessage → NappletHost island
    ↓
Island verifies source/session nonce and forwards to /api/nap/:sessionId
    ↓
Fresh API route authenticates account from cookie and validates envelope schema
    ↓
RuntimeRegistry finds NappletSession(accountId, sessionId)
    ↓
Kehto adapter dispatches to domain service after ACL/capability check
    ↓
Domain service calls Applesauce/store/app DB/external resource as needed
    ↓
Response envelope returns HTTP response or emits stream event
    ↓
Island posts response back to iframe with exact targetOrigin where possible
    ↓
SDK promise/subscription callback resolves inside napplet
```

**Direction rule:** napplets never call relays, app DB, signer, localStorage, or arbitrary HTTPS resources directly. They request through NAP domains; backend services decide whether and how to fulfill.

### Sign-In / Account / Session Flow

```text
User opens app
    ↓
Session middleware reads httpOnly session cookie
    ↓
No account? route renders sign-in shell
    ↓
User signs in through supported method (initially choose one: private-key dev mode, NIP-07 handoff, NIP-46/bunker, or server-managed signer)
    ↓
AccountService verifies proof / binds signer / stores account record
    ↓
SessionService writes sessionId cookie: httpOnly, sameSite=Lax, secure in HTTPS
    ↓
Middleware loads AccountSummary into ctx.state.account on later requests
    ↓
RuntimeRegistry lazily initializes AccountRuntime: Applesauce store, relay pool config, signer adapter, grants
    ↓
App shell renders active avatar/navigation/settings from account DTO
    ↓
NAP identity domain returns public key / identity changes from AccountRuntime, not iframe state
```

**Boundary rule:** session cookies identify the web user to Fresh; napplet session identity identifies a sandboxed iframe/runtime relation; Nostr account identity identifies the signer/pubkey. Do not collapse these into one token.

### Persistence and Relay Sync Flow

```text
AccountRuntime starts
    ↓
Storage layer opens app DB + Applesauce event DB
    ↓
Applesauce AsyncEventStore/EventStore initializes with persistent DB
    ↓
RelayPool is configured from account relay settings and discovered NIP-65 mailboxes
    ↓
Sync worker loads local events/cursors, starts targeted subscriptions or Negentropy sync
    ↓
Relay events → verify → eventStore.add(event, relayUrl)
    ↓
EventStore handles dedupe, replaceable events, delete events, model updates
    ↓
NAP outbox/relay/common services query EventStore first, then loaders/RelayPool as needed
    ↓
Published events are signed by signer adapter, inserted into EventStore, and fanned out by RelayPool
    ↓
Sync metadata/cursors and app-specific settings/grants persist in app DB
```

**Storage boundary:**

| Data | Owner | Store | Notes |
|------|-------|-------|-------|
| HTTP sessions | SessionService | App DB + httpOnly cookie ID | Cookie stores opaque ID only |
| Accounts/signers | AccountService | App DB / secret store | Keep keys out of islands and napplet iframe |
| Capability grants | ApprovalService/KehtoAdapter | App DB | Key by account + napplet pubkey/dTag/aggregateHash + capability |
| Napplet config/storage | NAP storage/config services | App DB | Scope by account + napplet identity + version/instance |
| Nostr events | Applesauce runtime | Applesauce event DB | Deduped, replaceable/delete aware |
| Relay preferences/cursors | NostrRuntime | App DB, optionally Nostr replaceable events | Separate local sync cursor from user-published relay lists |
| Artifact cache | ArtifactResolver | File/cache table/blob store | Cache only verified hashes; re-hash before serving |

### Approval / Consent Flow

```text
Napplet requests sensitive operation (publish, sign, resource, notify, config mutation)
    ↓
Domain service checks existing grant and operation-specific policy
    ↓
No grant? create pending ApprovalRequest in app DB and return/emit pending response
    ↓
ApprovalModal island subscribes/polls /api/approvals
    ↓
User approves/denies with scope: once, session, napplet version, account-wide where safe
    ↓
ApprovalService records decision
    ↓
Runtime resumes or rejects original request by requestId
```

## State Management

```text
Authoritative state:
  App DB + Applesauce EventStore + RuntimeRegistry

Request-scoped state:
  Fresh ctx.state.account/session loaded by middleware

Browser shell state:
  transient iframe ref, pending request map, modal open/closed state, stream connection

Napplet iframe state:
  untrusted app-local state only; no direct authority over signer, relays, storage, or account
```

Do not store authoritative account, grants, relay state, or Nostr event cache in Preact signals. Signals are fine for rendering interaction state and live DTO snapshots from backend streams.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Single Deno Fresh process with local SQLite/LibSQL file, in-process RuntimeRegistry, one RelayPool per account or small pool manager. Prioritize correctness and cleanup. |
| 1k-100k users | Move app DB/event DB to remote LibSQL/Turso or managed SQLite-compatible service, add background sync workers, enforce per-account relay/subscription quotas, introduce sticky sessions or resumable stream IDs. |
| 100k+ users | Split runtime workers from Fresh web edge, externalize message bus for NAP streams, shard event storage by account/pubkey, centralize relay connection pooling, add artifact CDN/cache with hash verification. |

### Scaling Priorities

1. **First bottleneck: relay subscriptions and long-lived streams.** Mitigate with subscription dedupe, outbox-aware relay selection, per-account quotas, and cleanup on iframe removal.
2. **Second bottleneck: event persistence/search.** Mitigate with Applesauce persistent DB, targeted sync, indexes/search only where needed, and pruning policies.
3. **Third bottleneck: runtime session affinity.** Mitigate by persisting grants/session metadata and using sticky routing or external message buses before adding multiple web instances.

## Anti-Patterns

### Anti-Pattern 1: Putting Nostr Runtime Logic in Islands

**What people do:** Let `NappletHost.tsx` own relay pools, event caches, signing, or NAP domain behavior.

**Why it's wrong:** It violates the core requirement that heavy Nostr and persistent runtime state live on the backend; it also exposes sensitive state to mobile browser and iframe-adjacent code.

**Do this instead:** Islands only bridge messages and render UI. Call backend runtime APIs for all NAP behavior.

### Anti-Pattern 2: Treating postMessage as Trusted Because It Came From an iframe

**What people do:** Accept any `message` event and forward `event.data` to the backend.

**Why it's wrong:** Any window in the frame hierarchy can send messages. MDN explicitly requires checking origin/source and validating syntax.

**Do this instead:** Track iframe `contentWindow`, expected gateway origin, session nonce, schema version, request ID, and domain allowlist. Revalidate again on the server.

### Anti-Pattern 3: Combining `allow-scripts` and `allow-same-origin` for Same-Origin Napplet Content

**What people do:** Serve napplet gateway from the portal origin and add both iframe sandbox tokens for convenience.

**Why it's wrong:** MDN discourages this combination for same-origin frames because it can nullify sandboxing. It also increases risk that napplet content can access parent-origin storage/cookies/DOM.

**Do this instead:** Prefer a separate napplet content origin/subdomain. Use the narrowest sandbox tokens possible and make resource access shell-mediated.

### Anti-Pattern 4: Mixing App Metadata and Nostr Events in One Ad-Hoc Table

**What people do:** Store events, sessions, grants, relay settings, and napplet config in generic JSON blobs.

**Why it's wrong:** Nostr event semantics need dedupe, replaceable/addressable replacement, delete handling, filters, and relay provenance; app metadata needs product-specific constraints and migrations.

**Do this instead:** Use Applesauce event database for Nostr events and a separate app schema for accounts, sessions, grants, configs, and sync metadata.

### Anti-Pattern 5: Reimplementing Kehto/NAP Dispatch in Fresh Handlers

**What people do:** Each `/api/nap/*` handler switches on domain/method and directly implements protocol behavior.

**Why it's wrong:** It drifts from `../kehto` runtime contracts and duplicates service/ACL behavior.

**Do this instead:** Fresh handlers validate transport/authentication, then delegate to a Kehto adapter and registered NAP services.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Nostr relays | Backend `RelayPool` with request/subscription/publish/sync APIs | Do not open relay WebSockets from napplet iframe or islands for core behavior |
| Blossom/media resources | NAP resource/upload/media service proxies | Enforce scheme allowlists, byte limits, hash verification, and user consent where needed |
| Signer/NIP-46/bunker | Account signer adapter behind AccountRuntime | Never expose private keys or raw signer authority to iframe; consent high-risk operations |
| Napplet artifacts | Gateway route backed by resolver/cache | Verify manifest/signatures/hashes before serving; consider separate origin |
| Browser postMessage | Island-owned iframe bridge | Verify origin/source/schema; exact `targetOrigin` where possible |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Fresh routes ↔ runtime services | Direct TypeScript service calls | Routes validate HTTP/session and convert service results to `Response` |
| Routes ↔ islands | Serializable props and backend DTOs | Fresh island props cannot include functions; keep props small and serializable |
| Islands ↔ iframe | `postMessage` with schema, requestId, nonce | Browser-only; guarded by `IS_BROWSER`; do not trust payloads |
| Islands ↔ backend | Same-origin fetch plus SSE/WebSocket for streams | Cookie-authenticated; add CSRF for mutating endpoints |
| Runtime ↔ Kehto | Adapter implementing expected contracts | Preserve Kehto shell/runtime boundary: DOM transport outside runtime; dispatch/ACL inside runtime |
| Runtime ↔ Applesauce | EventStore/RelayPool APIs | EventStore is Nostr authority; RelayPool is network edge |
| NAP services ↔ storage | Repositories with typed methods | Avoid SQL or raw DB access from routes/islands |

## Suggested Build Order

1. **Stabilize Fresh shell and runtime skeleton**
   - Extend `State` for session/account DTOs.
   - Replace starter page with app shell routes and presentational components.
   - Create `runtime/registry.ts` and no-op `NappletSession` lifecycle.
   - Rationale: every later phase needs the same boundaries and typed request state.

2. **Add app persistence and session/account foundation**
   - App DB connection/migrations.
   - Session cookie middleware.
   - Minimal sign-in/account selection flow.
   - Active avatar/bottom nav DTO.
   - Rationale: NAP identity, grants, and runtime lookup all depend on account/session identity.

3. **Build iframe sandbox host with inert/no-op NAP bridge**
   - `NappletHost` island mounts sandboxed iframe.
   - Implement postMessage schema, request IDs, nonce/source/origin checks.
   - Add `/api/nap/:sessionId` echo/no-op handler and teardown.
   - Rationale: validates the riskiest browser/backend boundary before real authority exists.

4. **Integrate Kehto adapter and napplet injection path**
   - Resolve sibling package APIs.
   - Register runtime services as stubs.
   - Serve verified or fixture artifacts through `/napplet-gateway/*`.
   - Implement capability inventory and early unsupported-capability failure.
   - Rationale: prevents inventing incompatible Fresh-specific NAP contracts.

5. **Add Applesauce Nostr core**
   - EventStore/AsyncEventStore + persistent event DB.
   - RelayPool construction, relay settings, loaders.
   - Basic relay query/publish through backend service.
   - Rationale: identity/outbox/common/list domains need authoritative Nostr storage and networking.

6. **Implement minimum NAP domains**
   - Start with `identity`, `storage`, `resource` (restricted), `relay` read/query, then `outbox` publish.
   - Add stable error envelopes and stream handling.
   - Rationale: gives napplets useful behavior while keeping signing/publish risk staged.

7. **Add approval/grant system**
   - Pending approval queue, modal UI, grant persistence.
   - Gate publish/sign/resource/notify/config mutations.
   - Rationale: must exist before exposing destructive or privacy-sensitive domains broadly.

8. **Add relay sync and richer domains**
   - NIP-65 relay discovery, outbox subscriptions, sync cursors/Negentropy where supported.
   - Common social actions, lists, config, notify, media, INC.
   - Rationale: depends on stable accounts, event store, grants, and message streams.

9. **Hardening and deployment readiness**
   - CSP, iframe origin separation, CSRF, rate limits, stream cleanup, resource quotas, observability.
   - Rationale: iframe sandboxing and backend proxying are the highest-risk production surfaces.

## Risks and Deeper Research Flags

| Risk | Why It Matters | Mitigation / Research Needed |
|------|----------------|------------------------------|
| iframe sandbox token choice | Wrong tokens can break napplets or nullify sandbox isolation | Phase-specific security research for exact `sandbox`, `allow`, CSP, gateway origin, and cookie policy |
| Backend proxy as confused deputy | Napplet can try to make server fetch/sign/publish beyond user intent | Schema validation, ACL, capability grants, per-domain quotas, explicit consent, audit logs |
| Long-lived NAP subscriptions over HTTP | Fetch request/response is insufficient for relay-like streams | Decide SSE vs WebSocket vs polling once Kehto/napplet message semantics are confirmed |
| Applesauce Deno compatibility details | SQLite implementations differ by runtime and async/sync APIs | Validate LibSQL/native package behavior in Deno before committing storage implementation |
| Multi-instance runtime sessions | In-process iframe session maps break under horizontal scaling | Keep session metadata persistent and design request routing/stream IDs for future sticky sessions |
| Sibling package API drift | `../kehto` and `../napplet` are local evolving packages | Pin versions/paths and add contract tests around adapter boundaries |

## Sources

- Fresh official docs: Architecture, Islands, Session management (fetched 2026-07-30; source confidence from seam: LOW for webfetch despite official-source content).
- Applesauce docs: EventStore, LibSQL event database, RelayPool (fetched via Applesauce documentation tools; confidence MEDIUM from seam for Context7/docs provider).
- Kehto local docs: `docs/concepts/runtime-shell-boundaries.md`, `docs/concepts/capability-negotiation.md`, `docs/tutorials/runtime-implementation.md` (local sibling-package source; used as project-specific evidence).
- napplet local docs: `.planning/codebase/ARCHITECTURE.md`, `packages/sdk/README.md` (local sibling-package source; used as project-specific evidence).
- MDN: `Window.postMessage()` and `<iframe>` reference (fetched 2026-07-30; source confidence from seam: LOW for webfetch despite official-source content).

---
*Architecture research for: Deno Fresh server-side napplet runtime*
*Researched: 2026-07-30*
