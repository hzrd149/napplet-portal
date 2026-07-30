# Pitfalls Research

**Domain:** Server-side napplet runtime for mobile web using Nostr, Applesauce, sandboxed iframes, Kehto, and napplet
**Researched:** 2026-07-30  
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: Treating Nostr sign-in as “just store a private key”

**What goes wrong:**
The portal stores an `nsec` in browser storage, logs it in URLs/request bodies, keeps it in a long-lived server session without envelope encryption, or lets napplets indirectly sign arbitrary events. A compromise of the app shell, server logs, session store, or iframe bridge becomes a full account takeover.

**Why it happens:**
Server-side runtime ownership can be misread as “the server owns keys.” Nostr UX also tempts teams to implement password-like key import before modeling signer boundaries. NIP-07 and NIP-46 point in the opposite direction: private keys should be exposed to as few systems as possible, with scoped signing mediated by browser/remote signers where practical.

**How to avoid:**
- Prefer external signing flows: NIP-07 when available, NIP-46/remote signer for mobile/server-mediated use, and only add direct key custody as an explicit later feature with threat model, encrypted-at-rest storage, rotation, and deletion semantics.
- Never put secrets, `bunker://` tokens, connection secrets, NIP-46 request payloads, or imported key material in query strings or unredacted logs.
- Separate `user_pubkey`, NIP-46 `client_pubkey`, and `remote_signer_pubkey` in types and storage.
- Require per-napplet, per-capability approval before signing; enforce allowlists for `kind`, tags, relays, and NAP method.
- On logout, delete disposable NIP-46 client keypairs/session state locally and invalidate portal sessions even if remote logout acknowledgement fails.

**Warning signs:**
- Variables named only `pubkey`/`key` in auth code with no signer role distinction.
- Sign-in routes accept `nsec`/private key strings before a signer strategy is documented.
- Logs include full URLs or request bodies for auth/API endpoints.
- A napplet can call `signEvent` through the NAP bridge without a visible approval modal.

**Security implications:**
Account takeover, irreversible malicious signing, private relay access abuse, correlation of identities across napplets, and persistent compromise through leaked session/signer tokens.

**Phase to address:**
Phase 1: Auth/session foundation. Do not build NAP signing APIs or relay publishing before this boundary exists.

---

### Pitfall 2: Confusing app authentication, relay authentication, and signer authorization

**What goes wrong:**
The app treats a signed relay-auth event or a NIP-46 connection as a portal login, or treats portal login as permission to publish/sign anything. Relay AUTH (NIP-42), NIP-46 signer sessions, and portal web sessions solve different problems.

**Why it happens:**
All three involve Nostr signatures and pubkeys, so route middleware can accidentally conflate identity proof, relay access, and user consent.

**How to avoid:**
- Define three explicit layers: portal session identity, signer capability grants, and relay connection/auth state.
- Store grants separately from sessions with expiry, napplet ID, methods, event kinds, and relay scope.
- For NIP-46, validate connection secrets, call `get_public_key` after connect, and handle `switch_relays` as signer connection state rather than app relay preferences.
- For NIP-42, sign ephemeral kind `22242` only for the relay challenge and relay URL; never expose this as user approval for NAP actions.

**Warning signs:**
- One `auth.ts` module both creates cookies, signs relay AUTH events, and approves napplet calls.
- A user is “logged in” solely because a relay accepted `AUTH`.
- Permission checks ask only “is user authenticated?” rather than “is this napplet granted this capability for this account?”

**Security implications:**
Privilege escalation from read-only session to signing, confused-deputy relay access, replay/spoofing of signer connections, and approvals that users cannot reason about.

**Phase to address:**
Phase 1 for session model; Phase 3 for NAP permission enforcement.

---

### Pitfall 3: Building relay sync as if Nostr relays were one consistent database

**What goes wrong:**
Timelines and napplet state become stale or inconsistent because the runtime reads from random bootstrap relays, ignores NIP-65 outbox/read/write relay hints, loses events when a relay is down, or publishes only to one relay. Replaceable/addressable events are duplicated or older events overwrite newer state.

**Why it happens:**
Relay APIs look like simple subscriptions at small scale. The complexity appears only when users have different write relays, tagged users have read relays, relays require auth, or local cache diverges from network state.

**How to avoid:**
- Use Applesauce RelayPool/loaders/outbox helpers where possible instead of bespoke WebSocket orchestration.
- Implement NIP-65 relay selection early: read authors from their write relays; read mentions from tagged users' read relays; publish to author write relays and tagged-user read relays.
- Make event storage semantics explicit: regular append, replaceable latest by `(kind,pubkey)`, addressable latest by `(kind,pubkey,d)`, ephemeral not durable unless the NAP contract says otherwise.
- Track event source relay, EOSE, CLOSED/auth-required, retry state, and last successful sync cursors.
- Bound subscriptions and unsubscribe on napplet/session teardown.

**Warning signs:**
- Hardcoded global relay list is the only relay source.
- Route handlers open RelayPool subscriptions directly without lifecycle management.
- Database schema has only `id`, `content`, and `created_at` with no replaceable/addressable indexes.
- Duplicate events appear in UI or old profile/app-state events reappear after refresh.

**Security implications:**
Publishing to the wrong relays can leak metadata; relay-auth mistakes can expose private subscriptions; stale state can cause users to approve actions based on outdated permissions/profile data.

**Phase to address:**
Phase 2: Nostr runtime/storage foundation, before napplet-facing APIs depend on synced state.

---

### Pitfall 4: Treating Applesauce as a bag of utilities instead of the runtime backbone

**What goes wrong:**
The project reimplements event validation, relay subscription plumbing, caching, outbox selection, or reactive storage poorly, then later must migrate to Applesauce after route handlers and islands depend on ad hoc shapes.

**Why it happens:**
Fresh route handlers make it easy to write one-off relay code. The starter scaffold has no service/data boundary, so early prototypes put Nostr logic wherever it is needed.

**How to avoid:**
- Create a backend runtime module around Applesauce `EventStore`/`AsyncEventStore`, `RelayPool`, loaders, cache persistence, and signer abstractions before adding product routes.
- Keep Fresh routes thin: parse request, authorize, call runtime service, return typed response/stream.
- Define adapters for Deno persistence and deployment constraints rather than leaking storage details into routes/islands.
- Use Applesauce models/helpers for Nostr semantics; only add bespoke code for concrete gaps.

**Warning signs:**
- Multiple modules import relay WebSocket primitives directly.
- Event dedupe/replaceable logic appears in route files.
- Islands import Nostr relay/storage packages.
- Runtime lifecycle cannot answer “who owns this subscription and when is it closed?”

**Security implications:**
Duplicated signing and validation logic creates inconsistent permission enforcement; route-local relay code is likely to miss auth-required, redaction, and teardown cases.

**Phase to address:**
Phase 2: Backend runtime skeleton and storage layer.

---

### Pitfall 5: Weak iframe sandboxing and postMessage validation

**What goes wrong:**
A napplet escapes isolation, navigates the top page, exfiltrates user/session data through permissive messages, accesses browser capabilities it should not have, or convinces the backend to execute privileged NAP calls.

**Why it happens:**
`sandbox` feels sufficient by itself, and `postMessage` demos often use `*` and untyped payloads. MDN explicitly warns that receivers must verify `origin`/`source` and message syntax, and that same-origin frames with both `allow-scripts` and `allow-same-origin` can effectively defeat sandboxing.

**How to avoid:**
- Serve untrusted napplet iframe content from a separate origin where possible.
- Default to restrictive `sandbox`; only add tokens required by napplet/Kehto contracts. Be extremely cautious with `allow-scripts`, `allow-same-origin`, popups, downloads, forms, and top navigation.
- Use exact `targetOrigin`, exact `event.origin`, and expected `event.source === iframe.contentWindow` checks.
- Validate every message with a schema: `{version, nappletId, requestId, method, params}`; reject unknown methods and oversized payloads.
- Add page-level and iframe `Permissions-Policy` to deny camera, microphone, geolocation, local-network, clipboard, payment, USB/HID/serial, etc. unless explicitly granted.

**Warning signs:**
- Any `postMessage(..., "*")` carrying user/session/NAP data.
- Message handlers switch on `data.method` without origin/source/schema checks.
- Same-origin iframe plus `sandbox="allow-scripts allow-same-origin"`.
- NAP API endpoints trust a `nappletId` supplied only by the iframe payload.

**Security implications:**
XSS across the app shell, data exfiltration, unauthorized NAP execution, clickjacking/navigation abuse, browser permission abuse, and compromise of active Nostr account operations.

**Phase to address:**
Phase 3: napplet iframe integration and NAP bridge. Establish before exposing any privileged NAP method.

---

### Pitfall 6: NAP API permissions implemented as UI prompts without server-side enforcement

**What goes wrong:**
Approval modals look correct, but backend endpoints accept calls if the iframe sends the right payload. A malicious or compromised napplet bypasses UI and directly calls APIs, repeats old approved requests, changes parameters after approval, or races multiple requests.

**Why it happens:**
Approval UX is visible and easy to demo; durable grants, request binding, replay protection, and backend policy checks are less visible.

**How to avoid:**
- Treat the backend runtime as the policy decision/enforcement point; the frontend approval modal only creates/updates grants.
- Bind each approval to user account, napplet identity/version/origin, method, normalized params or param class, time limit, and optional spend/write limits.
- Require request IDs/nonces and idempotency for sensitive calls; reject replayed approvals.
- Log security events without secrets: requested method, napplet, decision, user pubkey fingerprint, and reason.
- Add deny-by-default typed capability registry mapped to Kehto/NAP methods.

**Warning signs:**
- API handlers trust `approved: true` from client payloads.
- Grants are stored as a boolean per napplet rather than method-scoped capabilities.
- No tests for direct API calls without opening the approval modal.

**Security implications:**
Silent signing/publishing, unauthorized relay/blob operations, account metadata leakage, and cross-napplet privilege escalation.

**Phase to address:**
Phase 3: NAP bridge and permission system.

---

### Pitfall 7: Moving heavy Nostr/runtime state into Fresh islands

**What goes wrong:**
Mobile pages become slow, battery-heavy, and unreliable because hydrated islands hold relay connections, event stores, sync loops, or long-lived NAP state. The backend and frontend each develop their own truth, creating impossible-to-debug divergence.

**Why it happens:**
Preact Signals and islands are convenient for interactivity, and starter examples encourage client state. But the project requirement is explicit: persistent state and complex Nostr processing belong on the backend.

**How to avoid:**
- Define frontend responsibility as shell rendering, iframe mounting, approval UX, settings forms, and transport to backend.
- Define backend responsibility as accounts, signer/session state, relay/blossom configuration, relay sync, event storage, and NAP execution.
- Keep browser state ephemeral and reconstructable from backend session/runtime state.
- Expose typed HTTP/SSE/WebSocket channels for napplet status instead of importing runtime packages into islands.

**Warning signs:**
- Islands import Applesauce RelayPool/EventStore or open relay WebSockets.
- Frontend localStorage holds authoritative relay lists, grants, or event cache.
- Backend routes ask the browser to provide current Nostr state rather than reading server storage.

**Security implications:**
Secrets and grants leak into browser storage, iframe messages become trusted state channels, and browser compromise becomes equivalent to backend runtime compromise.

**Phase to address:**
Phase 1 architecture boundary and Phase 2 runtime implementation.

---

### Pitfall 8: Designing fullscreen mobile UX only on desktop responsive emulation

**What goes wrong:**
The napplet appears to work on desktop but is unusable on real phones: bottom nav overlaps iOS safe areas, address bars resize the viewport, approval modals are hidden by virtual keyboards, iframe focus traps break back gestures, and fullscreen/PWA affordances differ by browser.

**Why it happens:**
Mobile web iframes combine several tricky browser behaviors, and desktop devtools do not faithfully reproduce iOS Safari/Chrome Android viewport, keyboard, and installed-PWA behavior.

**How to avoid:**
- Test real iOS Safari and Android Chrome in the first UX phase, not after features are complete.
- Use dynamic viewport units and safe-area insets for fullscreen shell and bottom navigation.
- Keep approval modals outside the napplet iframe at the app-shell layer; ensure they remain reachable with keyboard open.
- Provide visible loading/offline/error states when the iframe or backend runtime disconnects.
- Design back/close/settings navigation explicitly; do not rely on iframe history alone.

**Warning signs:**
- UI uses only `100vh` for fullscreen height.
- Bottom nav has no `env(safe-area-inset-bottom)` handling.
- Approval dialogs are rendered inside napplet iframe.
- No physical-device UAT checklist exists.

**Security implications:**
Poor UX can become a security issue when users cannot see approval details, cannot cancel signing prompts, or are trained to approve ambiguous modal flows.

**Phase to address:**
Phase 4: mobile app shell UX, with an early Phase 3 smoke test for iframe/approval interactions.

---

### Pitfall 9: Shipping Fresh starter defaults into a privileged runtime

**What goes wrong:**
Demo routes, placeholder middleware, permissive Deno permissions, full URL logging, and scaffold API handlers remain while privileged Nostr/NAP APIs are added. Attackers get extra surface area and logs collect sensitive URLs/tokens.

**Why it happens:**
The brownfield starter scaffold feels harmless until auth, relay, and napplet APIs make every route and middleware decision security-relevant.

**How to avoid:**
- Remove or replace demo routes and counter island before adding privileged APIs.
- Replace placeholder request state with typed session/request context.
- Redact logs by default: method/path/status/duration only; never query strings or request bodies for auth/NAP routes.
- Replace `deno serve -A` with minimal production permissions once network/read/env needs are known.
- Add route tests for unauthenticated, malformed, oversized, and unauthorized requests.

**Warning signs:**
- `/api/:name`, `/api2/:name`, demo counter, or `ctx.state.shared = "hello"` still exist after auth begins.
- `console.log(ctx.req.url)` remains in global middleware.
- Production start task still uses `-A` with no deployment threat model.

**Security implications:**
Token leakage, accidental public endpoints, overprivileged server process, and fragile route precedence when APIs multiply.

**Phase to address:**
Phase 0/1: scaffold cleanup and secure baseline.

---

### Pitfall 10: Treating encrypted/private Nostr data as privacy-safe metadata-free data

**What goes wrong:**
The runtime stores or publishes encrypted events, relay selections, and request histories in ways that reveal account relationships, app usage, napplet IDs, or sensitive timing patterns even if contents are encrypted.

**Why it happens:**
Teams equate payload encryption with privacy and overlook relay-level metadata, server logs, database indexes, and analytics.

**How to avoid:**
- Minimize logging and analytics around pubkeys, relays, napplet IDs, and signer requests.
- Use pseudonymous internal IDs in operational logs; only store pubkeys where required.
- Document what the server can see in a privacy model: user pubkeys, napplet usage, relay targets, NAP methods, and timing.
- Avoid centralizing all user relay traffic through unnecessary default relays.

**Warning signs:**
- Analytics events include full pubkeys, event IDs, relay URLs, or NAP method params by default.
- Debug logs are the primary way to inspect relay sync.
- Privacy policy/model is deferred until after storage schemas are fixed.

**Security implications:**
User deanonymization, sensitive relationship leakage, and regulatory/user-trust risk even without direct content compromise.

**Phase to address:**
Phase 2 storage/sync and Phase 5 observability/privacy hardening.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded default relays only | Fast demo sync | Stale/missing events; privacy leaks; no outbox model | Only for a throwaway smoke test before Phase 2 |
| Boolean `approved` flag per napplet | Simple permission UX | No method/param scope; easy escalation | Never for privileged methods |
| Direct relay code in route handlers | Quick endpoint implementation | No lifecycle, dedupe, auth, or cache consistency | Never beyond prototypes deleted before Phase 2 |
| Browser localStorage as runtime state | Fast frontend persistence | Secret/grant leakage and state divergence | Only non-sensitive UI preferences |
| `sandbox` without origin/message policy | Looks secure | False isolation; message injection | Never |
| Full request URL logging | Easier debugging | Token/signing secret leakage | Local development only with redaction and no real keys |
| `deno serve -A` in production | Avoids permission errors | Full process compromise blast radius | Local dev only |

## Integration Gotchas

Common mistakes when connecting to external services and sibling packages.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| NIP-07 browser signer | Assuming `window.nostr` exists on mobile or in sandboxed iframe | Feature-detect in app shell; never expose it directly to napplet iframe; proxy via approved backend policy |
| NIP-46 remote signer | Confusing remote-signer pubkey with user pubkey; skipping secret validation | Validate connect secret; call `get_public_key`; store typed signer roles separately |
| NIP-42 relay auth | Treating relay auth as portal login | Keep relay challenges per relay connection; use app sessions separately |
| NIP-65 relay lists | Reading every user from global relays | Use author write relays for their events and tagged-user read relays for mentions/publish targeting |
| Applesauce EventStore | Using it only as an array cache | Let it handle replaceable/delete/model behavior; wrap it in backend runtime services |
| Applesauce RelayPool | Infinite subscriptions with no owner | Tie subscriptions to session/napplet/runtime lifecycle and unsubscribe on teardown |
| Kehto/NAP | Inventing portal-specific methods before mapping contracts | Build a typed adapter against Kehto interfaces and NAP specs; deny unknown methods |
| napplet | Trusting iframe payload identity | Bind iframe instance, origin, napplet manifest/version, and backend session before accepting messages |
| Fresh routes/islands | Putting runtime state into islands | Keep routes as transport and islands as UX; backend services own runtime state |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| One RelayPool/subscription per request | WebSocket explosion; relay rate limits; memory leaks | Shared runtime pools with scoped subscriptions and teardown | Dozens of active users/napplets |
| Unbounded historical sync | Slow login; mobile waits forever; high relay load | Cursor/windowed sync; cache-first loaders; explicit limits | First users with long Nostr histories |
| Persist every event synchronously before responding | Slow API/iframe responses | Add to EventStore promptly; persist/cache asynchronously with backpressure | Large timelines or unreliable disk |
| Multiple iframes active in mobile shell | High memory/battery; browser tab reloads | One active napplet frame; suspend/destroy background frames | Low-memory phones |
| Hydrated islands for all shell state | JS bloat and sluggish approvals | Server-render static shell; hydrate only nav/approval/transport components | Mid-range mobile devices |
| No relay/source dedupe | Duplicate UI/events; storage bloat | Use event ID uniqueness and Applesauce store mapping | Multi-relay sync |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing imported private keys as normal session data | Full Nostr account compromise | Prefer external signers; encrypt-at-rest only if custody is intentionally designed |
| Granting blanket `sign_event` to napplets | Silent malicious publishing | Kind/tag/content/relay scoped approvals with explicit user prompts |
| `postMessage` target `*` or no origin/source checks | Message interception/injection | Exact targetOrigin and origin/source/schema validation |
| Same-origin iframe with `allow-scripts allow-same-origin` | Sandbox removal/DOM access risk | Separate origin; avoid that token pair for untrusted content |
| Trusting client-side approval flags | Direct API bypass | Backend policy enforcement and nonce/idempotency checks |
| Logging query strings and NAP params | Signer token or private metadata leakage | Central redaction policy and tests |
| Treating encrypted events as metadata-private | Deanonymization and usage leakage | Privacy model, minimization, pseudonymous logs |
| Running Deno with all permissions | Larger server compromise blast radius | Minimal `--allow-*` set per deployment |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Approval modals inside iframe | Malicious UI can spoof or hide approvals | App-shell-owned native approval UI above iframe |
| Ambiguous signing prompts | Users approve events they do not understand | Human-readable event summary: kind, target relay, napplet, irreversible effects |
| Desktop-only mobile testing | Broken bottom nav/keyboard/fullscreen behavior | Real iOS/Android device UAT in Phase 4 |
| Losing app navigation to iframe history | Back button exits or traps user | Explicit app-shell back/close/settings controls |
| No offline/reconnect state | Users think napplet is broken | Distinct iframe load, backend disconnected, relay syncing, and signer waiting states |
| Safe areas ignored | Bottom nav/approval buttons obscured | Dynamic viewport units and safe-area CSS |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Sign-in:** Works with one key, but verify signer role separation, no secret logs, logout deletion, and mobile-compatible NIP-46/NIP-07 fallback.
- [ ] **Relay sync:** Shows events from a default relay, but verify NIP-65 outbox/read/write logic, replaceable/addressable handling, auth-required paths, and cache recovery.
- [ ] **Event storage:** Saves events, but verify uniqueness, source relays, deletion/replaceable semantics, durable indexes, and migration plan.
- [ ] **Iframe sandbox:** Renders napplet, but verify separate origin strategy, sandbox token audit, Permissions-Policy, and postMessage schema/origin/source checks.
- [ ] **NAP API:** Modal appears, but verify backend denies direct unauthorized calls, scopes grants, prevents replay, and logs decisions safely.
- [ ] **Mobile shell:** Looks responsive in devtools, but verify physical-device safe areas, keyboard occlusion, iframe focus, back gestures, and offline states.
- [ ] **Backend/frontend split:** Feature works, but verify no relay/storage/signer imports in islands and no authoritative runtime state in browser localStorage.
- [ ] **Production startup:** Server runs, but verify minimal Deno permissions, route cleanup, redacted logs, and tests for malformed/unauthorized requests.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Private key/session leakage | HIGH | Revoke/delete sessions, notify users, rotate server secrets, purge logs if possible, remove direct custody path, add redaction tests |
| Relay sync built wrong | MEDIUM/HIGH | Introduce runtime service boundary, migrate to Applesauce loaders/outbox model, rebuild storage indexes, backfill events |
| Weak NAP permissions | HIGH | Freeze privileged methods, add backend policy registry, invalidate broad grants, add replay protection and audit logs |
| Iframe message vulnerability | HIGH | Disable napplet loading, enforce exact origins/schemas, move content to separate origin, audit sandbox tokens |
| Frontend owns runtime state | MEDIUM | Move state to backend service/storage, replace islands with transport/status views, add import lint rules |
| Mobile UX unusable | MEDIUM | Create device test matrix, fix viewport/safe-area/layout primitives, redesign approval/navigation outside iframe |
| Starter scaffold leaks into product | LOW/MEDIUM | Remove demo routes/middleware, replace README/env/startup docs, add route/security tests |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Starter scaffold and insecure defaults | Phase 0/1: scaffold cleanup + secure baseline | Demo routes gone; logs redacted; no `-A` production plan; request state typed |
| Key handling/sign-in mistakes | Phase 1: auth/session foundation | Signer strategy doc; no secret logs; NIP-46/NIP-07 role tests; logout clears client keys |
| Auth/relay/signer confusion | Phase 1 and Phase 3 | Separate session, relay auth, and grant stores; tests for each boundary |
| Relay sync/storage inconsistency | Phase 2: Nostr runtime/storage | NIP-65 relay tests; replaceable/addressable indexes; EOSE/CLOSED/auth-required handling |
| Applesauce bypass/reimplementation | Phase 2 | Runtime service wraps EventStore/RelayPool/loaders; route files do not own relay lifecycle |
| Iframe sandbox weakness | Phase 3: napplet iframe integration | Sandbox token audit; exact origin/source/schema tests; Permissions-Policy headers |
| NAP permission bypass | Phase 3: NAP bridge | Direct unauthorized API calls fail; grants scoped by method/napplet/user/params; replay rejected |
| Mobile web UX failures | Phase 4: mobile shell UX | Real-device UAT passes for safe areas, keyboard, back navigation, approvals, reconnect states |
| Metadata/privacy leakage | Phase 2 and Phase 5 | Privacy model; minimized logs; operational telemetry excludes raw pubkeys/secrets by default |
| Backend/frontend boundary drift | All phases, especially Phase 1/2 | Dependency/lint review: islands do not import runtime/relay/storage/signing modules |

## Sources

- Project context: `/home/user/Projects/napplet-portal/.planning/PROJECT.md` and codebase concerns audit in `.planning/codebase/CONCERNS.md`.
- Nostr protocol docs: NIP-07 (`window.nostr`), NIP-46 (remote signing), NIP-65 (relay list metadata/outbox model), NIP-42 (relay AUTH), and Nostr event semantics for regular/replaceable/ephemeral/addressable events. Confidence: MEDIUM via curated docs/tooling.
- Applesauce docs: EventStore, RelayPool, loaders, caching, outbox subscriptions, and storage helpers. Confidence: MEDIUM via Applesauce documentation tooling.
- MDN Web Docs: `<iframe>` sandbox, `Window.postMessage()`, and `Permissions-Policy`, last modified in 2026. Confidence: MEDIUM for cross-checked iframe/message/security claims; LOW if treated as browser-compatibility exhaustive.

---
*Pitfalls research for: server-side napplet runtime on Nostr/Fresh mobile web*  
*Researched: 2026-07-30*
