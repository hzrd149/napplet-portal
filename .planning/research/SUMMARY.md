# Project Research Summary

**Project:** Napplet Portal  
**Domain:** Deno Fresh backend-heavy mobile web runtime for sandboxed Nostr napplets  
**Researched:** 2026-07-30  
**Confidence:** MEDIUM

## Executive Summary

Napplet Portal is not primarily a social client; it is a mobile web runtime for untrusted napplets. Experts should build it as a thin Fresh/Preact shell around sandboxed iframes, with all authoritative Nostr state, signer boundaries, relay/blossom networking, persistence, and NAP API execution owned by backend TypeScript services. The product succeeds when a napplet can load safely on mobile, discover runtime capabilities, request mediated APIs, and get fast server-backed Nostr behavior without direct access to browser storage, relays, or signing keys.

The recommended approach is to keep the Deno Fresh scaffold, upgrade Fresh to 2.4+ before WebSocket-backed NAP channels, adopt Applesauce as the Nostr runtime backbone, and use LibSQL/SQLite-backed event storage through `applesauce-sqlite`. Integrate `../kehto` and `../napplet` as protocol/runtime authorities behind explicit adapters; do not invent portal-specific NAP contracts. Build in dependency order: secure scaffold and session/account model, backend runtime/storage, iframe/message bridge, Kehto/napplet contract integration, minimum NAP domains, approval policy, then mobile polish and hardening.

The highest risks are key custody, auth/signer/relay confusion, weak iframe/postMessage boundaries, ad hoc relay sync, and UI-only permissions without backend enforcement. Mitigate these by preferring NIP-46/NIP-07-style external signing, keeping portal sessions, relay AUTH, and signer grants separate, validating every iframe message twice, routing all Nostr activity through Applesauce-backed services, and making approvals durable server-side policy decisions scoped to account, napplet identity/hash, method, parameters, and expiry.

## Key Findings

### Recommended Stack

The existing Deno Fresh starter is the right foundation, but it must be treated as scaffolding for a privileged runtime rather than as a generic web app. Keep Fresh routes and islands thin, upgrade Fresh before implementing WebSocket flows, and place Nostr/NAP behavior in backend modules. Applesauce should be adopted early as the canonical event/relay/storage abstraction to avoid costly migration away from bespoke relay code.

**Core technologies:**
- **Deno 2.9.x**: runtime, task runner, TypeScript checker, permissions — already present and suitable for Fresh/server runtime work.
- **Fresh 2.4+**: server-rendered shell, API routes, middleware, WebSocket endpoints — upgrade from current 2.3.3 before live bidirectional proxy channels.
- **Preact + Preact Signals**: route/island UI and local interactive state — use only for shell UX, iframe lifecycle, modals, and transient connection state.
- **Tailwind CSS 4 + Vite 7**: mobile shell styling and build pipeline — retain current scaffold choices for fast responsive UI iteration.
- **Applesauce 6.x packages**: `EventStore`/`AsyncEventStore`, `RelayPool`, loaders, accounts, signers, common event helpers — use as the backend Nostr authority, not as incidental utilities.
- **LibSQL via `@libsql/client` + `applesauce-sqlite`**: persistent Nostr event database — supports local development and later Turso/remote LibSQL without changing the event-store shape.
- **Kehto + napplet sibling packages**: NAP/runtime/shell contract sources — integrate through adapters only after resolving local version/API drift.

**Critical version and compatibility requirements:**
- Fresh must move to **2.4+** because WebSocket upgrades under Vite dev require Fresh 2.4+ and Deno 2.8+.
- Deno 2.9.4 satisfies Fresh's runtime needs.
- Applesauce LibSQL integration should use `AsyncEventStore` with `applesauce-sqlite` and `@libsql/client`.
- `../kehto` peers against `@napplet/* >=0.29.0 <0.30.0`, while local `../napplet` appears to expose newer `@napplet/nap` 0.31.0; resolve before linking both trees.

### Expected Features

The v1 product should validate the runtime seam, not chase full Nostr-client completeness. Must-have features are those required for safe napplet loading, session identity, relay/event behavior, NAP capability discovery, and user-visible consent.

**Must have (table stakes):**
- Mobile-first Fresh app shell with fullscreen napplet route, bottom navigation, active account display, safe loading/error states, and settings.
- Sandboxed iframe napplet host using `sandbox="allow-scripts"` without `allow-same-origin`, plus strict source/session binding.
- NAP-SHELL handshake and capability discovery before any other NAP method is serviced.
- Browser-to-backend message proxy for iframe envelopes with request IDs, nonces, schema validation, and response/stream delivery.
- Runtime-attested napplet identity from verified manifest/catalog data, not iframe-supplied claims.
- Installed napplet catalog with manifest/capability/archetype metadata and enabled/default-handler state.
- Account sign-in/logout and account/session management, preferably using NIP-46/Bunker or another external signer boundary.
- Relay configuration, relay health, NIP-65 relay-list support, NIP-42 relay AUTH handling, and backend relay pool ownership.
- Persistent event store/cache with Nostr semantics for dedupe, replaceable/addressable events, deletes, relay provenance, and bounded sync.
- Minimal NAP domains: `shell`, `relay`, read-only `identity`, scoped `storage`, minimal safe `resource`, basic `intent`, plus basic `theme` and in-app `notify` if schedule allows.
- Capability approvals and ACL persistence for publish/sign/encrypt, storage quota escalation, broad resource access, and later uploads.

**Should have (competitive / v1.x differentiators):**
- Server-side relay sync as a personal Nostr backend for fast mobile napplet startup.
- Fine-grained per-napplet approval memory keyed by verified napplet identity/hash and capability scope.
- Capability-aware launcher explaining required domains, missing capabilities, and risk labels.
- Verified remote manifest/blob loading through NIP-5A aggregate hash verification.
- Outbox-aware query planning and internal NIP-65 routing, with public NAP-OUTBOX exposure only after the relay engine stabilizes.
- Developer envelope inspector after runtime envelopes settle.
- Blossom upload/mirroring and NAP-UPLOAD only when real napplets need file creation.

**Defer (v2+ or explicit demand only):**
- General-purpose Nostr social-client completeness; ship social behavior through napplets, not shell-owned feeds.
- NAP-VALUE/zaps, NAP-POW, rich NAP-MEDIA, NAP-KEYS/global shortcuts, native mobile apps, direct network/NAP-CONNECT, and broad background server jobs.
- Multi-account and offline/resumable cache until single-account permissions, relay state, storage cost, and sync boundaries are stable.
- NAP-INC and NAP-CONFIG unless launch napplets require them.

### Architecture Approach

Use a thin Fresh boundary and thick backend runtime services. Fresh routes render server-first pages and expose narrow API/stream endpoints; islands own browser-only behavior such as iframe mounting, postMessage listeners, modal controls, and navigation. Backend modules own the runtime registry, sessions, Kehto adapter, NAP services, Applesauce Nostr runtime, account/session services, approvals, and persistence. Split app metadata storage from Nostr event storage.

**Major components:**
1. **Fresh composition root and middleware** — register static files, CSP/security/session middleware, file-system routes, and typed request state.
2. **Page routes and components** — render the mobile app shell, napplet viewport, sign-in/settings/approval views, bottom nav, and active account DTOs.
3. **Fresh API/stream routes** — authenticate portal sessions, validate transport payloads, and delegate to runtime services for sessions, approvals, NAP calls, and artifact gateway responses.
4. **Fresh islands** — create/destroy sandboxed iframes, validate browser message source/origin/nonce, forward envelopes, render approval modals, and maintain only transient UI state.
5. **RuntimeRegistry and NappletSession lifecycle** — map account/session/iframe identity to per-napplet runtime sessions, correlation IDs, cleanup hooks, and stream ownership.
6. **Kehto adapter and NAP services** — preserve Kehto/NAP dispatch, capability negotiation, ACL gates, and service registration while implementing behavior with backend dependencies.
7. **Applesauce Nostr runtime** — own event store, relay pool, loaders, outbox routing, publish fanout, sync, signer abstraction, and model derivation.
8. **Persistence layer** — app DB for accounts, sessions, grants, configs, napplet storage, sync metadata; Applesauce event DB for Nostr events.
9. **Resource/artifact boundary** — verified napplet artifact gateway and mediated Blossom/HTTPS/Nostr resource access with byte limits, MIME checks, hash verification, and CSP.

**Key patterns to enforce:**
- Treat routes and islands as adapters; runtime services are plain TypeScript modules.
- Validate iframe messages in the browser and revalidate them on the server.
- Expose only supported/granted NAP domains per napplet; deny unknown methods by default.
- Insert verified relay events into Applesauce stores before using them as authoritative state.
- Never let napplets access relays, signers, app DB, localStorage, IndexedDB, or arbitrary network resources directly.

### Critical Pitfalls

1. **Treating sign-in as private-key storage** — prefer external signers; never expose raw keys or signer secrets to iframes, URLs, browser storage, or logs; document signer strategy before publish APIs.
2. **Confusing portal auth, relay AUTH, and signer authorization** — model web session identity, relay challenge state, and signer grants as separate layers with separate storage and tests.
3. **Building relay sync as a single consistent database** — use Applesauce RelayPool/loaders and NIP-65 routing; track relay provenance, auth-required failures, EOSE/CLOSED, cursors, and replaceable/addressable semantics.
4. **Weak iframe sandboxing and postMessage validation** — use restrictive sandbox tokens, prefer a separate content origin, exact origin/source checks, schema validation, nonce/session binding, and Permissions-Policy.
5. **NAP permissions as UI prompts only** — backend must be the policy decision/enforcement point; grants must bind to account, napplet identity/version, method, normalized params/limits, expiry, and replay protection.
6. **Moving runtime state into islands** — islands must not import Applesauce, relay, storage, or signing modules; all authoritative state lives in backend services and storage.
7. **Shipping Fresh starter defaults into privileged runtime** — remove demo routes/islands, redact logs, type request state, add security tests, and plan minimal Deno permissions before production.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Secure Fresh Baseline and App Shell Skeleton
**Rationale:** Every later feature depends on typed request state, cleaned-up starter routes, safe defaults, and a shell structure that does not accidentally become the runtime.  
**Delivers:** Fresh 2.4+ upgrade, scaffold cleanup, composition root, typed `State`, security/CSP/logging baseline, mobile shell routes/components, placeholder settings/sign-in/napplet pages, no-op runtime registry.  
**Addresses:** mobile-first shell, starter-to-product transition, backend/frontend responsibility split.  
**Avoids:** starter defaults, all-permissions production drift, runtime logic in islands, logging sensitive URLs.

### Phase 2: Account, Session, Persistence, and Signer Boundary
**Rationale:** Napplet identity, approvals, NAP-IDENTITY, relay publish, and runtime lookup all require a clean separation between portal web sessions, Nostr account identity, signer capability, and relay auth.  
**Delivers:** app DB/migrations, session cookies, account records, active account DTOs, logout/revoke semantics, signer strategy implementation or stub, account-scoped runtime initialization.  
**Addresses:** account sign-in, account/session management, active account display, settings foundation.  
**Avoids:** private-key leakage, auth/relay/signer confusion, storing secrets in logs/query strings, napplet-visible signing.

### Phase 3: Applesauce Nostr Runtime and Relay/Event Storage
**Rationale:** NAP relay, identity, outbox, profile cache, relay settings, and sync must sit on a consistent Nostr authority before napplets depend on them.  
**Delivers:** LibSQL-backed Applesauce event DB, `AsyncEventStore`, RelayPool, relay settings, NIP-65 fetch/internal routing, NIP-42 AUTH handling, loaders, publish/query/subscribe service primitives, lifecycle teardown.  
**Uses:** Applesauce 6.x, `@libsql/client`, `applesauce-sqlite`, `nostr-tools` compatibility only where needed.  
**Avoids:** ad hoc relay code, duplicate/stale replaceable events, hardcoded relay-only sync, infinite subscriptions, event semantics in routes.

### Phase 4: Sandboxed Iframe Host and Backend Message Bridge
**Rationale:** The browser/server/iframe boundary is the riskiest architectural seam; validate it with no-op or low-authority calls before adding privileged NAP methods.  
**Delivers:** `NappletHost` island, iframe sandbox policy, postMessage envelope schemas, nonces, source/origin checks, `/api/nap/:sessionId` bridge, stream-channel decision (WebSocket vs SSE), session teardown, initial artifact gateway fixtures.  
**Addresses:** sandboxed iframe host, message proxy, NAP-SHELL session establishment, runtime-attested identity scaffolding.  
**Avoids:** confused deputy backend calls, `postMessage("*")`, same-origin sandbox escape, trusting iframe-supplied napplet IDs.

### Phase 5: Kehto / napplet Contract Integration and Catalog
**Rationale:** Before implementing real domains, resolve sibling API drift and pin the exact integration contracts so Fresh code does not invent an incompatible NAP runtime.  
**Delivers:** source inspection, version-line decision for `@napplet/*`, local import/link strategy, Kehto adapter, napplet injection/gateway path, installed catalog schema, fixture manifests, capability inventory, early unsupported-capability failure.
**Addresses:** installed napplet catalog, runtime-attested identity, NAP-SHELL `supports()`, capability-aware launcher groundwork.  
**Avoids:** Fresh-specific NAP schema forks, trusting gateway bytes, grants keyed only by URL/title.

### Phase 6: Minimum NAP Domains and Approval Enforcement
**Rationale:** Real napplet utility comes from a small conformant domain set, but sensitive operations must be gated by backend policy from the beginning.  
**Delivers:** read-only `identity`, scoped `storage`, restricted `resource`, `relay` query/subscribe, staged publish through signer, basic `intent`, basic `theme`, in-app `notify`, stable error envelopes, pending approval queue, approval modal, persisted scoped grants, deny/revoke flows, replay/idempotency checks.  
**Addresses:** NAP-RELAY, NAP-IDENTITY, NAP-STORAGE, NAP-RESOURCE, NAP-INTENT, NAP-THEME, NAP-NOTIFY, capability approvals and ACL persistence.  
**Avoids:** UI-only permission bypass, blanket `sign_event`, resource SSRF, overbroad grants, direct unauthorized API calls.

### Phase 7: Mobile UX, Diagnostics, and Runtime Polish
**Rationale:** The product is mobile-first; browser emulation is insufficient. Polish should happen after the runtime seam exists but before public validation.  
**Delivers:** physical-device UAT, safe-area/dynamic viewport layout, bottom nav/back/settings behavior, approval modal accessibility with keyboard open, reconnect/offline/runtime error states, relay diagnostics, storage/quota display, napplet permission management, optional developer envelope inspector.  
**Addresses:** settings pages, approval/denial UX, diagnostics panel, mobile fullscreen usability.  
**Avoids:** hidden approvals, iframe history traps, broken keyboard/safe-area behavior, unobservable relay/session failures.

### Phase 8: Hardening, Remote Verification, and Deployment Readiness
**Rationale:** Production napplet hosting combines untrusted code, server-side network access, user identity, relay metadata, and long-lived streams; hardening should be a dedicated release gate.  
**Delivers:** CSP/Permissions-Policy audit, separate iframe origin decision, CSRF protections, rate limits/quotas, resource proxy SSRF/MIME/hash controls, redaction and privacy model, minimal Deno permissions, route/security tests, remote NIP-5A manifest/blob verification if not already included.  
**Addresses:** public catalog readiness, resource/artifact safety, deployment model, operational privacy.  
**Avoids:** metadata leakage, overprivileged Deno runtime, unsafe resource pass-through, weak artifact trust, multi-instance session surprises.

### Phase Ordering Rationale

- Start with scaffold/security and Fresh upgrade because privileged auth, WebSocket channels, and napplet APIs should not be layered on top of demo routes or Fresh 2.3.3 WebSocket limitations.
- Establish account/session/signer boundaries before relay publish or NAP approvals; otherwise later permission logic will conflate login, relay AUTH, and signing authority.
- Build Applesauce-backed relay/event storage before napplet-facing NAP domains so identity, relay, and outbox APIs use correct Nostr semantics from day one.
- Validate the iframe/message bridge before exposing privileged domains; this confines the most dangerous browser/backend trust boundary while service methods are still inert or low risk.
- Resolve Kehto/napplet version and export questions before real NAP domain work to avoid protocol drift.
- Implement a small useful NAP set with policy enforcement, then polish mobile UX and harden deployment; do not implement every draft NAP in v1.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** signer strategy needs focused research/decision on NIP-46/Bunker, NIP-07 handoff, server-held development signer policy, storage of connection secrets, and logout semantics.
- **Phase 3:** Applesauce Deno/LibSQL behavior, `AsyncEventStore` APIs, RelayPool lifecycle, NIP-65 helpers, and NIP-42 AUTH paths should be validated with code-level docs/spikes.
- **Phase 4:** iframe sandbox tokens, content-origin strategy, CSP, Permissions-Policy, and WebSocket vs SSE transport need security-specific phase research.
- **Phase 5:** sibling `../kehto` and `../napplet` exports/version drift require source inspection and contract tests before implementation.
- **Phase 6:** NAP domain wire contracts are draft/active; relay/resource/intent/storage adapters need phase-specific API verification.
- **Phase 8:** deployment target, Deno permissions, separate origin, SSRF defenses, and privacy/observability model need explicit validation.

Phases with standard patterns (skip research-phase unless implementation context changes):
- **Phase 1:** Fresh route/island structure, Tailwind mobile shell, starter cleanup, and logging baseline are well-understood.
- **Phase 7:** mobile UI polish patterns are standard, but still require real-device UAT rather than deep research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Fresh/Deno facts are high-confidence and local scaffold is known; Applesauce package direction is solid but Deno/LibSQL details and sibling package compatibility need source-level validation. |
| Features | MEDIUM | Strong alignment across PROJECT.md, NAP registry, Kehto docs, and Nostr requirements; draft NAP status and launch-napplet unknowns reduce certainty. |
| Architecture | MEDIUM | Thin Fresh boundary, backend runtime registry, sandbox bridge, and split storage model are well-supported; multi-instance/session-stream design and exact Kehto adapter shape remain unresolved. |
| Pitfalls | MEDIUM | Security and Nostr pitfalls are strongly evidenced by protocol/browser docs and project constraints; exact severity depends on final signer, deployment, and iframe-origin choices. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Sibling API compatibility:** Inspect `../kehto` and `../napplet` exports, package peer ranges, and runtime assumptions; pin a version/import strategy before adapter implementation.
- **Signer policy:** Decide whether v1 uses NIP-46/Bunker, NIP-07 shell handoff, dev-only private key custody, or a combination; document threat model and tests before relay publish.
- **Deployment target:** Deno Deploy, Docker/VPS, and edge platforms differ for SQLite files, long-lived WebSockets, file cache, environment secrets, and separate iframe origins.
- **NAP contract volatility:** Keep local adapter boundaries and contract tests because NAP relay/storage/resource/identity/intent specs are draft/active.
- **Transport streaming choice:** Decide WebSocket vs SSE vs polling after Kehto/napplet message semantics are confirmed; WebSocket is likely default for bidirectional subscriptions.
- **Resource proxy policy:** Define SSRF, DNS rebinding, MIME sniffing, SVG/XML, size/deadline, cache partitioning, and Blossom verification rules before broad NAP-RESOURCE or upload support.
- **Privacy model:** Document what the server can observe: pubkeys, relay targets, napplet usage, request timing, grants, and metadata even for encrypted events.
- **Mobile browser behavior:** Verify iOS Safari and Android Chrome with physical devices for viewport, safe areas, keyboard occlusion, focus, back navigation, and PWA behavior.

## Sources

### Primary (HIGH confidence)
- `/home/user/Projects/napplet-portal/.planning/PROJECT.md` — project scope, constraints, active requirements, out-of-scope boundaries, and existing scaffold context.
- Existing local scaffold facts from `deno.json`, Fresh starter structure, and mapped codebase docs — Deno/Fresh/Preact/Tailwind/Vite baseline and route/island conventions.

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` — Fresh upgrade requirement, Applesauce/LibSQL stack, Deno permission direction, sibling package compatibility concerns.
- `.planning/research/FEATURES.md` — v1 feature set, NAP domain posture, feature dependencies, MVP definition, anti-features.
- `.planning/research/ARCHITECTURE.md` — recommended component boundaries, project structure, data flows, anti-patterns, build order, scaling risks.
- `.planning/research/PITFALLS.md` — critical security, Nostr, iframe, permission, mobile UX, and production hardening pitfalls.
- Applesauce documentation and method/package searches — EventStore, AsyncEventStore, RelayPool, loaders, LibSQL event database, signers, accounts, relay AUTH/sync patterns.
- Nostr protocol references — NIP-01 event semantics, NIP-07 browser signer, NIP-42 relay AUTH, NIP-46 remote signing, NIP-65 relay lists, NIP-96/Blossom considerations.
- Kehto local docs and package metadata — runtime/shell/ACL/service boundaries and alpha NAP/runtime guidance.
- napplet local docs and package metadata — sandbox/iframe/runtime injection and NAP package direction.

### Tertiary (LOW confidence / needs validation)
- Fresh official docs fetched through web tooling — WebSocket and CSP guidance; official but source classifier marked fetched web docs lower confidence.
- Deno docs fetched through web tooling — configuration and permissions; official but should be verified against actual deployment target.
- MDN Web Docs — iframe sandbox, `postMessage`, and Permissions-Policy guidance; official browser docs but not exhaustive for mobile browser quirks.
- NAP registry and specs at `https://github.com/napplet/naps` — domain posture and contracts are draft/active and may change before implementation.
- Local alpha sibling sources (`../kehto`, `../napplet`) — authoritative for current local context but unstable enough to require code-level inspection per phase.

---
*Research completed: 2026-07-30*  
*Ready for roadmap: yes*
