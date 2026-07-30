# Feature Research

**Domain:** Server-side napplet runtime and Nostr client backend  
**Researched:** 2026-07-30  
**Confidence:** MEDIUM

## Feature Landscape

Napplet Portal should be judged less like a general Nostr social app and more like a mobile web runtime: users expect napplets to load safely, ask for capabilities predictably, and get fast server-backed Nostr behavior without browser-side relay/storage burden. The v1 feature set should therefore center on a minimal conformant shell, backend-owned account/session state, relay/event storage, capability approvals, and a practical subset of NAP domains required by real napplets.

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or unsafe.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Mobile-first Fresh app shell | Product value is running napplets comfortably from mobile browsers. | MEDIUM | Fullscreen napplet surface, bottom navigation, active account avatar, safe loading/error states, and thin islands for shell UX only. |
| Sandboxed iframe napplet host page | NIP-5D/web projection expects napplets to run in sandboxed iframes with runtime mediation. | HIGH | Use `sandbox="allow-scripts"`; do not use `allow-same-origin`; bind message source to runtime-assigned napplet identity. |
| NAP-SHELL handshake and capability discovery | NAP-SHELL is mandatory for conformant runtimes and defines `shell.supports()`. | MEDIUM | Implement `shell.ready` → one `shell.init`; expose per-napplet domains and services; do not service capability calls before session establishment. |
| Message proxy from iframe to backend runtime | Napplets communicate through `postMessage`, but this product's runtime/state live server-side. | HIGH | Browser shell validates source/window, assigns session IDs, forwards correlated envelopes to backend endpoints or channels, and returns results/pushes. |
| Runtime-attested napplet identity | Napplets are untrusted and must not self-assert identity/capabilities. | HIGH | Identity should come from verified NIP-5A manifest data: `(dTag, aggregateHash)`. v1 may start with installed/catalog manifests but must keep the boundary. |
| Installed napplet catalog | Users need a way to open known napplets and the runtime needs manifests/capabilities/default handlers. | MEDIUM | Store manifest metadata, title/icon, dTag/hash, required domains, archetypes/conventions, source URL/blob references, enabled/disabled state. |
| Account sign-in | Backend Nostr client runtime is useless without an active user identity. | HIGH | Support at least one safe sign-in path for v1; NIP-46/Bunker is preferred for server-side signing boundaries. Avoid exposing nsec to napplets. |
| Account/session management | Users expect current account display, logout, and remembered settings. | MEDIUM | Persist active account, signer connection metadata, pubkey, display profile cache, and logout/revoke behavior. Multi-account can be v1.x if single-account is solid. |
| Relay configuration | Users expect to inspect/change which relays the runtime uses. | MEDIUM | Maintain user write/read relays, app fallback relays, signer relays, and per-feature relay groups. Keep UI simple: default relay set + advanced editor. |
| NIP-65 relay-list support | Nostr clients are expected to route reads/writes through user relay-list metadata. | MEDIUM | Fetch/store kind 10002, publish/update it when user edits relays, and use write relays for author fetches and tagged users' read relays for publishing. |
| Relay connection pool and health | Backend runtime must hide flaky relay behavior from napplets. | MEDIUM | Use Applesauce RelayPool where practical; track connected/auth-required/failed states, backoff, and per-relay publish responses. |
| Relay AUTH handling | Many relays require NIP-42 for restricted reads/writes. | MEDIUM | Sign kind 22242 AUTH events with the active signer; surface auth-required failures in settings/diagnostics. |
| Event storage and cache | A server-side runtime must persist events/state rather than refetching everything. | HIGH | Use Applesauce EventStore/database integration where practical; handle replaceable/addressable semantics, deletes, dedupe, relay provenance, and queryable cache. |
| Relay sync / subscriptions | Napplets expect feeds, profiles, and app state to update without each napplet owning WebSockets. | HIGH | Backend owns subscriptions, one-shot queries, dedupe, EOSE/deadlines, and pushes results to active napplet sessions. |
| NAP-RELAY minimal implementation | Nostr-native napplets need runtime-mediated relay read/write. | HIGH | v1 should support `relay.publish`, `relay.subscribe`, and bounded queries/proxy reads. Signing happens in runtime, not napplet. Draft status means isolate adapters behind Kehto contracts. |
| Publish/signing approval modals | Users expect to approve sensitive operations initiated by untrusted napplets. | HIGH | Gate `relay.publish`, encryption, uploads, value transfer, and broad relay reads by per-napplet policy; show event kind/content summary and requested capability. |
| Capability policy and ACL persistence | Runtime is the policy boundary; grants must survive reloads but be revocable. | HIGH | Per `(dTag, aggregateHash)` capability grants, blocks, quotas, and audit trail. Prefer Kehto ACL primitives rather than ad-hoc flags. |
| Settings pages | Runtime features require user-visible configuration. | MEDIUM | Accounts, relays, Blossom servers, napplet permissions, installed napplets, storage usage, session/device info, and diagnostics. |
| Blossom/media server configuration | Project explicitly includes relay/blossom config; NAP-UPLOAD depends on upload rails. | MEDIUM | Support user server list/preferred Blossom servers and/or NIP-96 fallback with clear uncertainty. Blossom is more aligned with napplet artifact/blob use; NIP-96 is marked unrecommended in NIPs. |
| NAP-IDENTITY read-only implementation | Napplets commonly need current pubkey/profile/follows/lists without signing authority. | MEDIUM | Expose only read operations: public key, relays, profile, follows, lists, zaps/mutes/blocked/badges if cached. No `window.nostr`, no signer RPC. |
| NAP-STORAGE scoped key-value store | Napplets need durable local preferences/state without direct browser storage. | MEDIUM | Per-napplet namespacing, quotas, get/set/remove/keys, cleanup on uninstall, and server persistence. |
| NAP-RESOURCE minimal implementation | NAP-RELAY, identity media, and napplet assets need mediated resource access. | MEDIUM | Implement safe fetch for `https`, `blossom`, `nostr`, and limited `data` only as policy allows; enforce size/MIME/deadline/CSP constraints. |
| NAP-INTENT basic handler resolution | Napplets need shell-mediated opening of other napplets by archetype. | HIGH | Installed manifest catalog, defaults per archetype, `available`, `handlers`, and `invoke/open` with result envelopes. Default-handler UI can be basic in v1. |
| NAP-THEME basic shell theme | Users expect napplets to match shell appearance. | LOW | Provide current theme and push changes; start with light/dark/accent tokens. |
| NAP-NOTIFY basic shell notifications | Napplets need safe user-facing feedback without arbitrary UI overlays. | MEDIUM | In-app toasts/badges first; OS push notifications are v2 due browser permission and background constraints. |
| Approval and denial UX | If a napplet request fails due policy, users need to understand why. | MEDIUM | Provide consistent modals/toasts for ask/deny/remember; avoid leaking internal ACL/firewall details to napplet messages. |
| Debug/diagnostics panel | Early NAP/NIP specs are draft; developers need visibility into failures. | MEDIUM | Show active sessions, last envelopes, relay health, grants, storage quotas, and publish/subscription errors. Make this developer/admin-oriented, not a social feed. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required for first validation, but valuable once the core runtime works.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Server-side relay sync as a personal Nostr backend | Mobile pages stay light while backend maintains warm relay connections and cache. | HIGH | Differentiates from browser-only clients; enables fast napplet startup and consistent state across devices. |
| Fine-grained per-napplet approval memory | Users can safely run untrusted napplets without approving every repeat operation. | HIGH | Policy can be scoped by capability, event kind, relay group, upload size, and napplet identity/hash. |
| Capability-aware napplet launcher | Runtime can explain which napplets are safe/compatible before launch. | MEDIUM | Show required domains, missing capabilities, risk labels, and one-tap grant/revoke. |
| Verified content-addressed napplet loading | Strong trust story: bytes are verified against signed manifest before iframe render. | HIGH | Use NIP-5A manifest and aggregate hash; gateway/blob providers become accelerators, not trust roots. |
| Outbox-aware query planner | Better Nostr performance by routing reads/writes to the right relay set. | HIGH | NAP-OUTBOX is draft; v1.x can expose host-side smarter routing while keeping napplet API stable. |
| Offline/resumable event cache | Napplets feel instant even when relay connectivity is poor. | HIGH | Requires cache invalidation, storage limits, and subscription replay semantics. Defer deep offline until v1.x. |
| Multi-account runtime with fast account switching | Useful for power users and testing napplets under different identities. | HIGH | Requires isolating signer sessions, event stores, permissions, relay settings, and active napplet sessions by account. |
| Blossom artifact/blob mirror management | Makes napplet installation and media loading resilient. | HIGH | Mirror verified blobs across preferred servers; pair with upload policy and storage accounting. |
| NAP-CONFIG declarative settings UI | Napplets can request typed configuration without building their own settings screens. | MEDIUM | Draft NAP-CONFIG; useful v2 runtime feature after core storage/approvals exist. |
| NAP-KEYS with shell-reserved shortcuts | Improves desktop/tablet runtime ergonomics and future native shells. | MEDIUM | Mobile web should not prioritize keyboard beyond basic forwarding; Kehto has reference behavior. |
| NAP-MEDIA bridge | Enables audio/video napplets to integrate with media session controls. | MEDIUM | Useful after core portal; needs careful mobile browser support. |
| NAP-UPLOAD with multiple rails | Napplets can upload files without knowing server credentials or rails. | HIGH | Support Blossom first; include NIP-96 only as compatibility because NIP-96 is now marked unrecommended. |
| NAP-LINK external-link mediation | Prevents unsafe popups and gives users control over leaving the runtime. | LOW | Good safety polish; likely v1.x. |
| NAP-INC inter-napplet communication | Enables composed workflows between napplets. | HIGH | Active in registry but increases lifecycle/routing complexity; implement after intent/catalog is stable. |
| App-like install/PWA polish | Better mobile retention. | MEDIUM | PWA manifest, home-screen icon, resilient reload, safe area handling, and session restore. |
| Developer mode and envelope inspector | Makes Napplet Portal attractive to napplet authors. | MEDIUM | Export traces, simulate denies/timeouts, inspect manifest/capability negotiation. |
| Policy templates by risk profile | Makes approvals understandable for non-expert users. | MEDIUM | Examples: Strict, Social, Media, Developer. Apply to new napplets then allow per-napplet override. |
| Background server jobs | The runtime can continue relay sync/upload tasks independent of the mobile browser tab. | HIGH | Requires auth/session model, resource budgets, and user-visible controls. Strong differentiator but not MVP. |
| NAP-POW mining queue | Lets napplets request proof-of-work without freezing the browser. | HIGH | Draft NAP-POW; useful server-side differentiator but expensive and abuse-prone. Defer until strong quotas exist. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create security, scope, or product-fit problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Expose `window.nostr` or raw signer RPC to napplets | Existing Nostr web apps expect it. | Breaks napplet trust model; napplets could sign outside runtime policy. | Implement read-only identity plus shell-mediated `relay.publish` approvals. |
| Store/import raw nsec in napplet-accessible browser storage | Fastest sign-in path. | Catastrophic key-exposure risk, especially with untrusted iframes and mobile browsers. | Prefer NIP-46/Bunker; if local key support is ever added, keep it server-side/encrypted and never expose to napplets. |
| Unsandboxed napplet execution | Easier integration/debugging. | Violates PROJECT.md out-of-scope and NIP-5D trust boundary. | Always use sandboxed iframe with explicit message proxy; add developer diagnostics instead. |
| Browser-only relay/storage runtime | Avoids backend complexity. | Contradicts core value; mobile browser bears relay, storage, and sync cost. | Keep hydrated islands thin and backend owns Nostr/client state. |
| General-purpose Nostr social client completeness | Familiar product shape. | Scope explosion; competes with mature clients and distracts from runtime validation. | Build only social surfaces needed for napplet runtime: identity/profile cache, relay settings, approvals, launcher. |
| Implement every draft NAP in v1 | Looks protocol-complete. | Draft churn plus high complexity causes rewrites and security gaps. | Ship shell/relay/identity/storage/resource/intent/theme/notify minimum; gate other domains behind adapters and roadmap flags. |
| Direct arbitrary network access (`NAP-CONNECT`) | Lets napplets integrate anything. | Deferred in registry and dangerous for exfiltration, tracking, and policy enforcement. | Provide resource/upload/relay-specific mediated APIs with allowlists and size limits. |
| Napplet-controlled default handlers | Napplets want to register themselves seamlessly. | Lets untrusted napplets hijack intents/navigation. | User-owned installed catalog and explicit default-handler settings. |
| Silent blanket approvals | Reduces friction. | Users lose control over signing/uploads/value transfer; hard to audit. | Risk-tiered prompts with remember options and revocation UI. |
| Per-napplet direct WebSocket relays | Simpler mental model for Nostr napplets. | Duplicates connections, bypasses cache/policy, leaks network metadata. | Runtime-owned relay pool with NAP-RELAY proxy. |
| Unbounded server sync of all Nostr data | Makes everything available instantly. | Cost, privacy, and scalability risks; Nostr graph can be huge. | Sync only active account, installed napplet requirements, configured lists, and bounded queries. |
| Social algorithm/feed as core portal feature | Attractive demo. | Turns runtime into a social app and delays platform work. | Use a feed napplet as a consumer of the runtime APIs, not shell-owned product scope. |
| Payments/zaps/value transfer in v1 | Exciting Nostr feature. | High-risk approvals, wallet/key handling, and draft NAP-VALUE dependency. | Defer until signing policy, relay, and upload approvals are battle-tested. |
| Native mobile app first | Better mobile UX. | Explicitly out of scope; multiplies platform work before runtime is validated. | Mobile web/PWA first; keep APIs projection-neutral for future native host. |
| Treat GitHub/gateway artifact as trusted bytes | Faster napplet loading. | Breaks content-addressed trust; gateway compromise becomes code execution. | Verify NIP-5A manifest signature, path blob hashes, and aggregate hash before render. |

## NAP API Categories and v1 Posture

Based on the reachable `napplet/naps` registry and local Kehto docs. Confidence is MEDIUM: NAP contracts are draft/active but not all are merged files on `master`; some registry rows point to PRs.

| NAP Category | Domain | Registry Status | v1 Posture | Requirements Implication |
|--------------|--------|-----------------|------------|--------------------------|
| Shell handshake | `shell` | Required / draft-active | Must implement | Foundational runtime session and capability negotiation. |
| Relay proxy | `relay` | Draft | Must implement minimal | Publish, subscribe/query, publishEncrypted only if signer/encryption approval exists. |
| Identity reads | `identity` | Draft | Must implement read-only | Current pubkey/profile/relays/follows/list-like data; no signing. |
| Storage | `storage` | Draft | Must implement | Scoped KV with quota and cleanup; server-backed. |
| Resource fetch | `resource` | Draft | Must implement minimal | Needed for mediated `https`/Blossom/Nostr/data access and upload/resource deps. |
| Intent dispatch | `intent` | Active | Must implement basic | Installed catalog, available/handlers, default handler, open/invoke. |
| Theme | `theme` | Active | Implement basic | Current theme + change pushes. |
| Notify | `notify` | Draft | Implement basic in-app | Toast/badge; OS notifications later. |
| Config | `config` | Draft | Defer to v1.x/v2 | Useful but not required before storage/settings foundation. |
| Upload | `upload` | Draft | v1.x unless first napplets need it | Requires Blossom/NIP-96 rails, file policy, MIME/size limits, and approvals. |
| Outbox routing | `outbox` | Draft | Internal first, API later | Use NIP-65 internally in v1; expose NAP-OUTBOX after relay engine stabilizes. |
| Inter-napplet communication | `inc` | Active | Defer unless required by launch napplets | Requires lifecycle/channel policy; build after intent/default handlers. |
| Link opening | `link` | Draft | v1.x | Low-cost safety polish after shell basics. |
| Keys | `keys` | Draft | Defer for mobile-first v1 | Desktop/tablet ergonomics; not central to mobile browser runtime. |
| Media | `media` | Draft | Defer | Need only if launch napplets play media. |
| Value/zaps | `value` | Draft | Defer | High-risk capability; requires strong approval/audit and wallet decisions. |
| POW | `pow` | Draft | Defer | Server resource abuse risk; needs quotas and job controls. |
| CVM/MCP bridge | `cvm` | Draft | Defer | Advanced integration, not table stakes. |
| Direct network connect | `connect` | Deferred | Do not build | Anti-feature for v1; use mediated resource/relay/upload APIs. |
| Class authority | `class` | Deferred | Do not build | Not needed for validating portal runtime. |

## Feature Dependencies

```text
Mobile Fresh shell
    └──requires──> Sandboxed iframe host
                       └──requires──> postMessage/session proxy
                                          └──requires──> NAP-SHELL handshake

Installed napplet catalog
    ├──requires──> Manifest parsing / napplet identity
    ├──enables──> Capability display and approvals
    └──enables──> NAP-INTENT handler resolution

Account sign-in
    ├──requires──> Signer adapter (prefer NIP-46)
    ├──enables──> Relay AUTH
    ├──enables──> NAP-IDENTITY
    └──enables──> NAP-RELAY publish

Relay configuration
    ├──requires──> Account state
    ├──enables──> Relay pool
    ├──enables──> NIP-65 relay list sync
    └──enables──> NAP-RELAY query/subscribe/publish

Event storage/cache
    ├──requires──> Relay pool ingestion
    ├──enables──> Identity/profile cache
    ├──enables──> Napplet fast startup
    └──enables──> Relay sync/offline behavior

Capability ACL persistence
    ├──requires──> Runtime-attested napplet identity
    ├──enables──> Approval modals remember/deny
    ├──enables──> NAP-STORAGE quotas
    └──enables──> Safe upload/value/pow later

NAP-RESOURCE
    ├──enables──> Profile media fetches
    ├──enables──> Blossom/Nostr blob access
    └──enables──> NAP-UPLOAD rails later

NAP-INTENT
    ├──requires──> Installed catalog
    ├──requires──> User default-handler settings
    └──enhances──> NAP-INC conventions later

NAP-UPLOAD / NAP-VALUE / NAP-POW
    └──require──> mature approvals + quotas + audit trail
```

### Dependency Notes

- **NAP-SHELL before any other NAP:** the shell handshake establishes the session and authoritative capability set. Build it before relay/identity/storage so other work has a uniform gate.
- **Catalog before intent:** `intent.available()` and default-handler dispatch must come from installed, verified manifests, not running iframes.
- **Runtime identity before approvals:** grants must bind to `(dTag, aggregateHash)` or equivalent verified identity; grants keyed only by URL/title are unsafe.
- **Account/signing before relay publish:** `relay.publish` accepts templates but runtime must sign and settle publication; signing cannot be bolted on inside napplet code.
- **Relay/event storage before polished napplets:** feed/profile/composer napplets need cached profile and event data; without storage, every launch is slow and relay-dependent.
- **Resource/upload separation:** resource fetch is table stakes; upload is higher-risk because it consumes storage, signs auth events, and exposes media/file metadata.
- **Approvals before advanced NAPs:** upload, value, POW, connect-like behavior, and broad resource access require mature policy UI and audit logs.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] Fresh app shell with mobile fullscreen napplet route, bottom navigation, active account avatar, and shell error states.
- [ ] Sandboxed iframe host using `../napplet-web` where practical, with strict postMessage source/session binding.
- [ ] Backend proxy path for napplet envelopes: browser session ↔ Fresh API/channel ↔ backend runtime handler ↔ browser response/push.
- [ ] NAP-SHELL handshake and per-napplet `shell.supports()` environment.
- [ ] Installed napplet catalog seeded from local/test manifests, with capability/archetype metadata.
- [ ] Account sign-in/logout using a shell-owned signer path; prefer NIP-46/Bunker if feasible in first implementation.
- [ ] Account profile display cache and active account state.
- [ ] Relay settings: default relays, user read/write relays, fallback relays, connection health.
- [ ] NIP-65 read/write relay-list fetch and internal routing support.
- [ ] Event store/cache using Applesauce primitives where practical.
- [ ] Relay pool with query/subscribe/publish settlement and NIP-42 AUTH handling.
- [ ] NAP-RELAY minimal: publish templates through runtime signing, bounded query/subscribe proxy, publish result/error propagation.
- [ ] NAP-IDENTITY read-only: pubkey, relays, profile, follows/lists from backend caches/providers.
- [ ] NAP-STORAGE scoped KV with per-napplet quota.
- [ ] NAP-RESOURCE minimal safe fetch for needed `https`, `nostr`, and Blossom blob reads.
- [ ] NAP-INTENT basic: `available`, `handlers`, `invoke/open`, user default handler from installed catalog.
- [ ] NAP-THEME basic current theme.
- [ ] NAP-NOTIFY in-app toasts/badges.
- [ ] Capability approvals for publish/sign/encrypt, storage quota escalation, resource access outside defaults, and uploads if enabled.
- [ ] Settings pages for accounts, relays/Blossom servers, napplet permissions, installed napplets, storage, and diagnostics.

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Multi-account support — add when single-account permissions and relay state are stable.
- [ ] Verified remote manifest/blob loading — if v1 starts with local manifests, upgrade to full NIP-5A aggregate verification before public catalog growth.
- [ ] Blossom upload/mirroring and NAP-UPLOAD — add when real napplets need file creation.
- [ ] NAP-LINK — add after shell navigation patterns settle.
- [ ] NAP-INC — add when at least two launch napplets need interop beyond intent open payloads.
- [ ] NAP-CONFIG declarative settings — add after storage and settings UX are validated.
- [ ] Developer envelope inspector — add once runtime envelopes are stable enough to debug externally.
- [ ] Offline/resumable cache behavior — add when storage costs and sync boundaries are understood.

### Future Consideration (v2+)

Features to defer until runtime-market fit is established.

- [ ] NAP-VALUE/zaps — high-risk financial approvals and wallet integration.
- [ ] NAP-POW mining queue — expensive server jobs and abuse risk.
- [ ] NAP-MEDIA rich OS controls — only after media napplet demand.
- [ ] NAP-KEYS/global shortcuts — more relevant to desktop/native projections than mobile web.
- [ ] Background server sync jobs — strong differentiator but needs resource budgets and privacy controls.
- [ ] Native mobile projection — out of scope until web runtime proves value.
- [ ] Direct network access / NAP-CONNECT — deferred by registry and should remain excluded unless the ecosystem changes substantially.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Sandboxed iframe host | HIGH | HIGH | P1 |
| NAP-SHELL handshake | HIGH | MEDIUM | P1 |
| Backend message proxy | HIGH | HIGH | P1 |
| Account sign-in/session | HIGH | HIGH | P1 |
| Relay config and pool | HIGH | MEDIUM | P1 |
| Event storage/cache | HIGH | HIGH | P1 |
| NAP-RELAY minimal | HIGH | HIGH | P1 |
| Capability approvals/ACL | HIGH | HIGH | P1 |
| Settings pages | HIGH | MEDIUM | P1 |
| Installed napplet catalog | HIGH | MEDIUM | P1 |
| NAP-IDENTITY read-only | MEDIUM | MEDIUM | P1 |
| NAP-STORAGE | MEDIUM | MEDIUM | P1 |
| NAP-RESOURCE minimal | MEDIUM | MEDIUM | P1 |
| NAP-INTENT basic | MEDIUM | HIGH | P1 |
| NAP-THEME basic | MEDIUM | LOW | P2 |
| NAP-NOTIFY in-app | MEDIUM | MEDIUM | P2 |
| Blossom server config | MEDIUM | MEDIUM | P2 |
| Full NIP-5A remote verification | HIGH | HIGH | P2 |
| NAP-UPLOAD | MEDIUM | HIGH | P2 |
| NAP-INC | MEDIUM | HIGH | P2 |
| Multi-account | MEDIUM | HIGH | P2 |
| Developer envelope inspector | MEDIUM | MEDIUM | P2 |
| NAP-VALUE | LOW initially | HIGH | P3 |
| NAP-POW | LOW initially | HIGH | P3 |
| Native mobile app | MEDIUM later | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have or future consideration

## Competitor / Reference Feature Analysis

| Feature | Kehto Reference Runtime | Typical Browser Nostr Client | Napplet Portal Approach |
|---------|-------------------------|------------------------------|-------------------------|
| Runtime boundary | Browser-agnostic runtime plus shell adapter, ACL, service registry, sandboxed iframes. | Usually exposes app logic directly in browser UI. | Use Kehto contracts but move heavy Nostr/storage runtime to server-side Fresh backend. |
| Signing | Shell-mediated inside relay publish/encryption; no napplet-visible signer. | Often NIP-07/window.nostr or local key in browser. | Shell/backend-owned signer; approvals; no raw signer APIs to napplets. |
| Relay handling | Reference relay services and outbox router; draft NAP-RELAY. | Client opens relays directly from browser. | Backend RelayPool/EventStore with NAP proxy; mobile browser stays light. |
| Capability policy | ACL package and grants/blocks/quotas. | Often coarse app permissions or browser extension approvals. | Per-napplet, per-capability policy keyed to verified napplet identity. |
| Napplet loading | Sandboxed iframe, verified manifest concepts, playground catalog. | Not applicable. | Product core: mobile fullscreen napplet host backed by server runtime. |
| NAP coverage | Many draft/reference services including identity, relay, storage, keys, media, notify, theme, upload, outbox, DM. | Nostr NIPs, not NAP capability seam. | Implement minimal conformant NAP set first; avoid every-draft-NAP scope trap. |

## Requirements Implications for v1

1. **Define v1 around the runtime seam, not around social-client completeness.** Requirements should test whether a napplet can safely load, discover capabilities, request relay/identity/storage/resource/intent APIs, and receive results from a backend runtime.
2. **Make approvals a first-class requirement, not a UI afterthought.** Publish/sign/encrypt/resource/upload operations initiated by untrusted napplets must have visible policy, remembered grants, denial paths, and revocation settings.
3. **Require backend-owned Nostr state.** Relay sync, event storage, NIP-65 routing, relay AUTH, profile/list cache, and Blossom settings belong behind server APIs, not hydrated islands.
4. **Treat NAP contracts as volatile.** Wrap `../kehto` and `../napplet-web` behind local integration seams so draft NAP changes do not rewrite route/island code.
5. **Ship with a small NAP set.** Must-have: shell, relay, identity, storage, resource, intent. Nice-to-have v1: theme and notify. Defer upload/inc/config/link unless a specific launch napplet requires them.
6. **Keep mobile constraints explicit.** Bottom nav, fullscreen iframe, safe-area layout, touch-friendly modals, and recoverable reload/session restore are table stakes for the target use case.

## Sources

- Project context: `/home/user/Projects/napplet-portal/.planning/PROJECT.md` (HIGH relevance; local project source).
- NAP registry and web projection: `https://github.com/napplet/naps`, `projections/web.md`, `naps/NAP-SHELL.md`, `naps/NAP-INTENT.md` (MEDIUM confidence via GSD classification; current registry is draft/active and some NAPs are PR-linked).
- Kehto local docs: `/home/user/Projects/kehto/README.md`, `RUNTIME-SPEC.md`, `packages/runtime/README.md`, `packages/services/README.md`, `packages/acl/README.md` (MEDIUM confidence; local reference implementation but marked alpha/draft).
- Nostr protocol references: NIP-01, NIP-42, NIP-46, NIP-65, NIP-96 read through protocol docs (MEDIUM confidence; NIP-96 specifically marked unrecommended/deprecated in favor of NIP-B7).
- Blossom reference: `https://github.com/hzrd149/blossom` (MEDIUM confidence; blob storage endpoints and user server list relevant to Blossom configuration).
- Applesauce docs/methods: EventStore, RelayPool, relay sync/negentropy, relay AUTH, NostrConnect signer, and event loading docs (MEDIUM confidence; use for implementation planning, not as product feature authority).

---
*Feature research for: server-side napplet runtime and Nostr client backend*  
*Researched: 2026-07-30*
