# Stack Research

**Domain:** Deno Fresh backend-heavy Nostr napplet runtime serving sandboxed napplet iframes and backend-proxied NAP APIs  
**Researched:** 2026-07-30  
**Confidence:** MEDIUM

## Recommendation in One Sentence

Keep the existing Fresh 2 + Deno 2 scaffold, upgrade Fresh to 2.4+ before building WebSocket-backed proxy channels, put Applesauce 6.x on the server for Nostr event stores/relays/accounts/signers, use LibSQL through `applesauce-sqlite` for persistent event storage, and integrate sibling `../kehto` and `../napplet-web` as protocol/runtime authorities rather than inventing local NAP contracts.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Deno | Existing: 2.9.4 | Runtime, task runner, TypeScript checker, HTTP/WebSocket platform | Current scaffold already uses Deno. Deno 2.9 supports config-level permission sets, import maps, npm/JSR dependencies, lockfiles, and the Fresh production target via `deno serve`. Keep Deno as the foundation. | HIGH |
| Fresh | Existing: 2.3.3; **upgrade to 2.4+** | Server-rendered app shell, API routes, middleware, WebSocket endpoints | Fresh is the right server-first framework for this scaffold. However Fresh docs state WebSocket upgrades under Vite dev require Fresh 2.4+ and Deno 2.8+, so upgrade before implementing live NAP proxy channels. | HIGH |
| Preact | 10.29.x | Route and island UI | Fresh uses Preact. Keep islands thin: shell UX, iframe mounting, approval modals, navigation, and WebSocket/postMessage glue only. | HIGH |
| Preact Signals | 2.9.x | Small client-side island state | Good fit for local interactive state such as active account display, connection state, and modal state; not for backend Nostr runtime state. | HIGH |
| Vite | Existing: 7.3.6 in lock; import map `^7.1.3` | Fresh dev/build pipeline | Required by Fresh 2 starter and Tailwind plugin. Keep unless Fresh update changes constraints. | HIGH |
| Tailwind CSS | Existing: 4.3.2 in lock; import map `^4.1.x` | Mobile shell UI styling | Current scaffold already uses Tailwind 4 through Vite; good for fast responsive app-shell work. | HIGH |
| TypeScript | Deno-reported: 6.0.3 | Types across app, Kehto, NAP, Applesauce integrations | Essential because most risk is boundary contracts: NAP envelope shapes, Applesauce event primitives, and Kehto service interfaces. | HIGH |

### Nostr / Applesauce Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `applesauce-core` | 6.2.0 | `EventStore`, `AsyncEventStore`, helpers, models | Use as the central backend event-state abstraction. Prefer one application-level store instance per runtime/session scope; use `AsyncEventStore` when backed by async DB. | MEDIUM |
| `applesauce-relay` | 6.2.1 | `Relay`, `RelayPool`, subscriptions, publish, count, NIP-65/outbox support, negentropy sync | Use for all relay connections and relay fanout. Do not use direct browser relay WebSockets from napplets. | MEDIUM |
| `applesauce-loaders` | 6.2.0 | Unified/address/event/timeline loaders | Use to fetch events on demand through `RelayPool` and populate the event store; important for profile, addressable manifest, and relay-hint workflows. | MEDIUM |
| `applesauce-sqlite` | 6.0.0 | Persistent Nostr event database adapters | Use `LibsqlEventDatabase` with `AsyncEventStore` for Deno/server persistence. It supports local `file:` and remote LibSQL/Turso paths and optional FTS search. | MEDIUM |
| `@libsql/client` | 0.17.4 | LibSQL/Turso client required by `applesauce-sqlite/libsql` | Use for local dev SQLite (`file:./data/events.db`) and later hosted Turso/LibSQL without changing Applesauce store shape. | MEDIUM |
| `applesauce-accounts` | 6.2.0 | Account wrappers and account manager persistence | Use for multi-account/session state once sign-in is implemented. Inspect API before storage design because account persistence shape matters. | MEDIUM |
| `applesauce-signers` | 6.2.2 | Private-key, NIP-07, Nostr Connect signer abstractions | Use for server-owned signing and Nostr Connect flows. Browser extensions may be used only as sign-in/signing delegation, not as napplet direct access. | MEDIUM |
| `applesauce-common` | 6.2.0 | Typed event factories/actions for common Nostr event kinds | Use to create common Nostr events rather than hand-building tags/content for notes, lists, contacts, etc. | MEDIUM |
| `rxjs` | 7.8.2 | Observable substrate used by Applesauce | Add explicitly if application code composes Applesauce streams. Keep server stream composition in backend modules, not islands. | MEDIUM |
| `nostr-tools` | 2.24.1 current npm; Kehto peers `>=2.23.3 <=2.x` | Low-level Nostr primitives and compatibility dependency for Kehto packages | Use as compatibility glue where Kehto or Applesauce expects it; do not build high-level relay/event-store abstractions on it directly. | MEDIUM |

### Napplet / Kehto / Local Sibling Packages

| Library | Version / Source | Purpose | When to Use | Confidence |
|---------|------------------|---------|-------------|------------|
| `../kehto/packages/runtime` / `@kehto/runtime` | local `0.19.0` | Browser-agnostic NIP-5D dispatch, ACL gates, service registry, sessions, manifests, replay checks, event buffering | Use as the backend/runtime protocol engine if its browser assumptions can be adapted to Fresh server routes/WebSockets. Inspect exports before implementation. | LOW |
| `../kehto/packages/shell` / `@kehto/shell` | local `0.18.0` | Iframe/session adapter, gateway loading, postMessage transport, hosted `supports()`, shell policy | Use for browser-side shell/iframe semantics if compatible with Fresh islands. It is the best existing source for sandbox/session rules. | LOW |
| `../kehto/packages/services` / `@kehto/services` | local `0.17.0` | Reference NAP service implementations for identity, relay, keys, media, notify, config, resource, cache, theme, audio, etc. | Mine and reuse handlers where possible; replace relay/storage internals with server Applesauce-backed implementations. | LOW |
| `../kehto/packages/acl` / `@kehto/acl` | local `0.16.0` | Capability grants, blocks, quotas, policy checks | Use for approval modal outcomes and per-napplet NAP permission enforcement. | LOW |
| `../kehto/packages/firewall` / `@kehto/firewall` | local `0.4.0` | Behavioral anti-abuse/rate-limit policy engine | Use to rate-limit napplet NAP calls and tighten policy on unfocused/background napplets. | LOW |
| `../kehto/packages/nip` / `@kehto/nip` | local `0.4.2` | NIP-5A/5D manifest verification and NIP-51/65/66/89 utilities | Use for content-addressed napplet resolution, manifest verification, Blossom hash verification, and NIP-65 relay discovery. | LOW |
| `../napplet-web/packages/nap` / `@napplet/nap` | local `0.31.0` | Active NAP domain helper package with subpaths for relay, storage, inc, identity, resource, outbox, intent, etc. | Use as the canonical NAP type/export source for portal implementation, but resolve version drift with Kehto first. | LOW |
| `@napplet/core` | Kehto expects `>=0.29.0 <0.30.0`; napplet-web local line likely newer | Envelope types, `createDispatch`, `registerNap`, constants | Do not pick a version blindly. First inspect sibling package lockfiles/exports and decide whether portal follows Kehto's pinned 0.29 line or napplet-web's current 0.31 line. | LOW |
| `@napplet/shim` | Kehto docs mention `0.27.0`; napplet-web local package exists | Runtime-side injection of `window.napplet.<domain>` objects | Use only for iframe bootstrap/injection if compatible with Kehto's mandatory shell exception. Portal must not assume shim supplies mandatory `window.napplet.shell`. | LOW |

### Persistence / Storage

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| LibSQL local file via `@libsql/client` + `applesauce-sqlite/libsql` | `@libsql/client` 0.17.4, `applesauce-sqlite` 6.0.0 | Event database for backend Nostr events | Best fit for Deno because Applesauce's LibSQL adapter is async and supports both local files and remote LibSQL/Turso later. | MEDIUM |
| Deno KV | Built into Deno, but deployment-dependent | Session metadata, approval grants, lightweight key-value settings | Use only for small runtime metadata if deployment target supports it and data must not live in SQL. Do not use as the primary Nostr event database. | LOW |
| File-system storage under `data/` | Deno `read/write` permissions | Dev-only local DB/blob cache path | Fine for local LibSQL and caches. Production deployment needs explicit storage target. | MEDIUM |

### Auth / Session Stack

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| Fresh middleware + signed cookies | Fresh 2.x | Session cookie parsing and request state | Use Fresh middleware to bind `ctx.state` to active portal session/account. Keep session lookup server-side. | HIGH |
| Applesauce Nostr Web Tokens | Applesauce docs package area | Nostr-authenticated client/server sessions | Investigate for sign-in; likely preferable to bespoke token formats if it fits Fresh server sessions. | MEDIUM |
| `applesauce-signers` Nostr Connect | 6.2.2 | Remote signer and NIP-46 style flows | Use when users should not upload private keys to the portal server. | MEDIUM |
| `arctic` | 3.7.0 | OAuth/OIDC helper if non-Nostr auth is added | Not MVP unless product needs OAuth fallback. | LOW |

### Browser Boundary / Messaging

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Sandboxed iframe with `sandbox="allow-scripts"` and **no `allow-same-origin`** | Web platform | Napplet execution isolation | Kehto/napplet-web specs explicitly require sandboxed iframe execution and forbid `allow-same-origin`; identity is bound by message source and verified manifest, not origin. | MEDIUM |
| `postMessage` JSON envelopes | Web platform | Napplet-to-shell message transport | This is the NIP-5D/NAP transport used by sibling packages. Portal should bridge postMessage to backend API/WebSocket, not expose direct Nostr APIs. | MEDIUM |
| Fresh WebSockets | Fresh 2.4+ | Long-lived NAP proxy channel and relay event streaming to the app shell | Use for subscriptions, NAP calls that stream, and relay events. Fresh docs specifically support `app.ws()` and route-level `ctx.upgrade()` after Fresh 2.4+. | HIGH |
| Server-Sent Events | Web platform | One-way backend-to-browser updates | Use only for simpler read-only streams. WebSocket is the better default because NAP proxy traffic is bidirectional. | MEDIUM |
| Fresh `csp()` middleware with nonce support | Fresh 2.x | App-shell CSP headers | Use for the shell document. Also inject strict CSP into `iframe.srcdoc` per Kehto/NIP-5D guidance, especially `connect-src`, so opaque-origin napplets cannot open arbitrary network paths. | HIGH |

## Development Tools

| Tool | Purpose | Notes | Confidence |
|------|---------|-------|------------|
| `deno task check` | Format, lint, type-check | Keep as the primary quality gate; current task is already correct for Fresh. | HIGH |
| Deno permissions in `deno.json` | Least-privilege runtime tasks | Replace `deno serve -A` with named permission sets once runtime needs are known: net to relays/blossom/LibSQL, read/write to data dir, env for credentials. | HIGH |
| `deno outdated` / `deno update` | Dependency currency | Use before roadmap implementation to update Fresh to 2.4+ and refresh lockfile. | HIGH |
| Deno test | Unit/integration tests | Prefer Deno tests for portal backend modules. Use browser tests only for iframe/message behavior. | HIGH |
| Playwright | Browser conformance and iframe sandbox verification | Add when implementing iframe sandbox, postMessage bridge, mobile shell, and NAP conformance flows. Sibling repos already use Playwright. | MEDIUM |
| `@napplet/conformance` / `@napplet/conformance-cli` | NAP/manifest conformance checks | Use once portal can serve/run napplets; source from `../napplet-web` line after version alignment. | LOW |

## Installation / Import Map Direction

Use Deno imports and lockfile, not `package.json`, for the portal unless a sibling-package workspace decision forces otherwise.

```bash
# Upgrade Fresh first because WebSocket dev support requires Fresh 2.4+
deno run -A -r jsr:@fresh/update .

# Add server-side Nostr runtime dependencies
deno add npm:applesauce-core@6.2.0 \
  npm:applesauce-relay@6.2.1 \
  npm:applesauce-loaders@6.2.0 \
  npm:applesauce-signers@6.2.2 \
  npm:applesauce-accounts@6.2.0 \
  npm:applesauce-common@6.2.0 \
  npm:applesauce-sqlite@6.0.0 \
  npm:@libsql/client@0.17.4 \
  npm:rxjs@7.8.2 \
  npm:nostr-tools@2.24.1
```

For sibling packages, prefer Deno `links` or explicit local import-map aliases only after inspecting package exports. Candidate direction:

```jsonc
{
  "links": ["../kehto/packages/*", "../napplet-web/packages/*"]
}
```

Do **not** add this blindly: Kehto currently peers against `@napplet/core`/`@napplet/nap >=0.29.0 <0.30.0`, while local `../napplet-web/packages/nap` is `0.31.0`. Resolve this drift before linking both trees into the same portal runtime.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Fresh routes + WebSockets | Hono/Oak custom Deno server | Only if Fresh route/websocket integration blocks required protocol behavior after upgrading to Fresh 2.4+. Otherwise keep the scaffold. |
| Applesauce RelayPool/EventStore | Raw `nostr-tools` relay primitives | Only for very small compatibility helpers. Applesauce handles dedupe, replaceables, models, relay pools, loaders, and storage integration. |
| `AsyncEventStore` + LibSQL | Deno KV as event store | Only if a future Applesauce adapter exists or event volume is tiny. KV is not the documented Applesauce event database path. |
| Server-side runtime state | Browser-only islands | Never for core runtime. Mobile browser UX is the product reason to move heavy Nostr work server-side. |
| Kehto/napplet-web contracts | Portal-specific NAP schema | Only if source inspection proves sibling APIs unusable. Otherwise local schema forks guarantee conformance drift. |
| WebSocket NAP proxy | Pure REST POST endpoints | REST is fine for one-shot calls, but subscriptions, relay events, and long-running NAP flows need bidirectional or streaming transport. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Fresh 2.3.3 for WebSocket-heavy dev | Fresh docs say Vite dev WebSocket upgrades require Fresh 2.4+ and Deno 2.8+; older versions may hang under dev server forwarding. | Upgrade Fresh before NAP proxy channels. |
| `deno serve -A` in production | All-permissions hides filesystem/env/net boundaries in a runtime that handles keys, relays, fetched resources, and sandboxed untrusted applets. | Deno named permission sets with scoped net/read/write/env. |
| Direct `window.nostr`, relay WebSockets, IndexedDB, localStorage, signing keys inside napplets | Kehto/NIP-5D runtime model says napplets must not receive direct browser storage, relay sockets, or keys. | Shell-injected `window.napplet.<domain>` and backend-proxied NAP APIs. |
| `allow-same-origin` on napplet iframes | Breaks opaque-origin isolation and lets napplets regain storage/origin powers. | `sandbox="allow-scripts"` baseline with carefully justified extra tokens only. |
| Hand-built Nostr event persistence | Easy to mishandle duplicates, deletes, replaceable/addressable events, and relay provenance. | Applesauce `EventStore` / `AsyncEventStore` with database adapter. |
| Raw SVG/resource pass-through from NAP-RESOURCE | Sibling policy docs flag SVG/XML and arbitrary URL fetches as major sandbox/SSRF surfaces. | Host-owned resource proxy with DNS-time private-IP blocks, MIME byte sniffing, SVG rasterization, caps, and per-napplet cache partitioning. |
| Treat `../kehto` APIs as stable | Kehto is alpha; README warns APIs/capabilities/specs may change. | Source-inspect and pin local commit/API assumptions per phase. |

## Stack Patterns by Variant

**MVP local development:**
- Fresh 2.4+, Deno 2.9.x, local LibSQL file, Applesauce server modules, one backend runtime singleton, one WebSocket route for app-shell proxying.
- Because it validates the architecture quickly without cloud storage or distributed runtime concerns.

**Single-user / trusted personal portal:**
- Same stack, private-key signer can be server-held if explicitly accepted by user, local encrypted storage for account metadata.
- Because UX is simpler, but still keep napplet iframe isolation and NAP ACL enforcement.

**Multi-user hosted portal:**
- Remote LibSQL/Turso, strict Deno permission sets, Nostr Connect preferred over server-held private keys, per-user runtime/session partitioning, rate limits via `@kehto/firewall`.
- Because hosted napplet execution plus Nostr credentials makes privilege separation and abuse controls mandatory.

**Offline/edge-heavy deployment:**
- Deeper research needed. Applesauce relay WebSockets and LibSQL remote support may not fit all edge hosts; Fresh supports multiple deployment targets, but storage and long-lived WebSockets are platform-dependent.

## Version Compatibility

| Package A | Compatible With | Notes | Confidence |
|-----------|-----------------|-------|------------|
| Fresh 2.4+ | Deno 2.8+ | Required for WebSocket upgrades under Vite dev per Fresh docs. Current Deno 2.9.4 satisfies this; current Fresh 2.3.3 does not. | HIGH |
| `applesauce-sqlite/libsql` 6.0.0 | `@libsql/client` 0.17.4 | Applesauce docs require `@libsql/client` for LibSQL adapter. Use `AsyncEventStore`. | MEDIUM |
| `applesauce-relay` 6.2.1 | RxJS 7.x | Relay APIs expose observables; explicit `rxjs@7.8.2` is prudent for application stream composition. | MEDIUM |
| `@kehto/runtime` 0.19.0 | `@napplet/core`/`@napplet/nap >=0.29.0 <0.30.0` | Local package peer range conflicts with local `@napplet/nap` 0.31.0. Must resolve before integration. | LOW |
| `@kehto/shell` 0.18.0 | `@napplet/shim` 0.27.0, `nostr-tools >=2.23.3 <=2.x` | Kehto docs also say mandatory shell is a host-owned exception; do not assume shim covers shell. | LOW |
| `@kehto/nip` 0.4.2 | `nostr-tools >=2.23.3 <=2.x` | Use for NIP-5A/5D/NIP-65 helpers; current `nostr-tools` 2.24.1 fits peer range. | LOW |

## Roadmap Implications

1. **Stack refresh phase first:** upgrade Fresh to 2.4+, add Applesauce/LibSQL imports, replace `-A` production start with scoped permissions later.
2. **Sibling API inspection phase before runtime build:** map exact exports from `../kehto` and `../napplet-web`, resolve `@napplet/*` version mismatch, and decide whether to link local packages or import published versions.
3. **Backend runtime foundation:** create server-owned event store, relay pool, account manager, signer abstraction, and storage module before building iframe UI.
4. **Iframe/message bridge:** only after runtime boundaries are typed; implement sandbox, postMessage validation, WebSocket proxy, and CSP together.
5. **NAP services:** implement relay/outbox/identity/storage/resource/intent via Kehto/napplet-web contracts, backed by Applesauce and hardened resource proxy policy.

## Unknowns Requiring Source Inspection

- Exact `@kehto/runtime` exports and whether they are browser-agnostic enough for a Fresh backend process without DOM assumptions.
- Whether `@kehto/shell` can be reused directly inside Fresh islands or should be treated as reference code for a smaller portal-specific island adapter.
- Which `@napplet/*` version line to standardize on: Kehto's `>=0.29.0 <0.30.0` peer range or napplet-web local `0.31.0` packages.
- Current NAP specs in `https://github.com/napplet/naps`, especially relay/outbox/storage/resource/identity/intent wire contracts and drift from local packages.
- Production deployment target. Deno Deploy, Docker/VPS, and edge platforms differ materially for SQLite files, long-lived WebSockets, filesystem writes, and environment secrets.
- Server-side key custody policy: private-key upload/storage vs Nostr Connect vs delegated signing.

## Sources

- Existing project context: `/home/user/Projects/napplet-portal/.planning/PROJECT.md`, `/home/user/Projects/napplet-portal/.planning/codebase/STACK.md`, `/home/user/Projects/napplet-portal/deno.json` — HIGH for local scaffold facts.
- Fresh docs, Getting Started / WebSockets / CSP, fetched 2026-07-30 — LOW per source classifier, but official docs; cross-checked with local scaffold.
- Deno docs, configuration and `deno.json` permissions, updated June 2026 — LOW per source classifier, but official docs; used for Deno config/permission recommendations.
- Applesauce docs via applesauce documentation tools: EventStore, RelayPool, LibSQL/Event Databases, package/method search — MEDIUM.
- npm registry version checks for Applesauce, LibSQL, RxJS, nostr-tools, Arctic — MEDIUM for current package versions.
- Local sibling sources: `../kehto/README.md`, `../kehto/RUNTIME-SPEC.md`, `../kehto/packages/*/package.json`, `../napplet-web/README.md`, `../napplet-web/packages/nap/package.json`, `../napplet-web/specs/SHELL-RESOURCE-POLICY.md` — LOW confidence by classifier because local alpha sources require deeper export-level inspection.

---
*Stack research for: Deno Fresh server-side Nostr napplet runtime*  
*Researched: 2026-07-30*
