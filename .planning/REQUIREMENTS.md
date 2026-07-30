# Requirements: Napplet Portal

**Defined:** 2026-07-30
**Core Value:** Napplets can run in a mobile browser while a server-side Deno runtime safely handles Nostr state, networking, persistence, and NAP API behavior on their behalf.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Fresh Shell Foundation

- [ ] **SHELL-01**: User can open a Napplet Portal shell built on Fresh 2.4+ without starter-demo routes or demo UI.
- [ ] **SHELL-02**: User can navigate a mobile-first app shell with fullscreen napplet viewport, bottom navigation, settings, and active account display placeholders.
- [ ] **SHELL-03**: Developer can add server request state through a typed Fresh `State` contract rather than untyped globals.
- [ ] **SHELL-04**: Runtime routes use safe baseline middleware for request logging, redaction, sessions, and security headers/CSP.
- [ ] **SHELL-05**: Backend runtime logic is kept out of hydrated islands; islands only manage browser UI, iframe lifecycle, and transient message state.

### Account, Session, and Signer Boundary

- [ ] **AUTH-01**: User can sign in and out with a Nostr identity through a shell-owned account/session flow.
- [ ] **AUTH-02**: Sign-in architecture explicitly supports NIP-46/Nostr Connect, including QR-code and bunker URI flows.
- [ ] **AUTH-03**: Sign-in architecture supports read-only `npub` mode for browsing and identity reads without signing authority.
- [ ] **AUTH-04**: Any direct `nsec` support is isolated from napplets, never stored in browser-accessible storage, never logged, and guarded by an explicit server-side key-custody policy.
- [ ] **AUTH-05**: Portal web sessions, relay AUTH state, and signer authorization/grants are modeled as separate concerns.
- [ ] **AUTH-06**: User can view active account identity, profile summary, and logout/revoke controls from the app shell.
- [ ] **AUTH-07**: Account/session state is persisted in an app database separate from the Nostr event store.

### Backend Nostr Runtime

- [ ] **NOSTR-01**: Backend runtime uses Applesauce packages where practical for Nostr event storage, relay connections, loaders, accounts, and signers.
- [ ] **NOSTR-02**: Backend runtime persists Nostr events in an Applesauce-compatible event database with correct dedupe and event semantics.
- [ ] **NOSTR-03**: Backend runtime owns relay pool lifecycle, connection health, query deadlines, EOSE/CLOSED handling, and teardown.
- [ ] **NOSTR-04**: User can configure read/write/fallback relays and inspect relay health from settings or diagnostics.
- [ ] **NOSTR-05**: Backend runtime fetches and uses NIP-65 relay-list metadata for account relay routing.
- [ ] **NOSTR-06**: Backend runtime handles NIP-42 relay AUTH without confusing it with portal login or signer grants.
- [ ] **NOSTR-07**: Backend runtime stores relay provenance and applies Nostr replaceable/addressable/delete semantics before exposing state to napplets.
- [ ] **NOSTR-08**: Backend runtime supports Blossom server configuration needed for resource/upload planning, even if uploads are deferred.

### Sandboxed Napplet Host and Message Bridge

- [ ] **BRIDGE-01**: User can open a sandboxed napplet iframe from the portal shell.
- [ ] **BRIDGE-02**: Napplet iframes run with a restrictive sandbox policy and no direct access to portal storage, relays, signers, or arbitrary privileged APIs.
- [ ] **BRIDGE-03**: Browser shell validates iframe `postMessage` source, origin, nonce, and session identity before forwarding any envelope.
- [ ] **BRIDGE-04**: Backend revalidates every napplet envelope with schema, session, account, napplet identity, and capability checks.
- [ ] **BRIDGE-05**: Napplet API calls are proxied through a backend-owned request/response channel with correlation IDs and typed errors.
- [ ] **BRIDGE-06**: Long-lived napplet sessions clean up iframe, backend runtime, relay subscriptions, and streams on navigation/logout/disconnect.
- [ ] **BRIDGE-07**: The system chooses and documents the streaming transport for subscriptions and pushes: WebSocket, SSE, or fallback polling.

### Kehto and napplet-web Integration

- [ ] **NAPLET-01**: Developer can inspect and document the exact `../kehto` and `../napplet-web` exports used by Napplet Portal.
- [ ] **NAPLET-02**: Project resolves local `@napplet/*` version and peer dependency drift before implementing production NAP APIs.
- [ ] **NAPLET-03**: Backend runtime integrates `../kehto` through an adapter instead of inventing a parallel NAP dispatch contract.
- [ ] **NAPLET-04**: Frontend host integrates `../napplet-web` where practical for sandboxed iframe runtime injection and message handling.
- [ ] **NAPLET-05**: User can open a catalog-installed napplet whose manifest, identity, capabilities, and source are represented in portal storage.
- [ ] **NAPLET-06**: Runtime-attested napplet identity comes from verified or catalog-controlled manifest data, not iframe-supplied claims.
- [ ] **NAPLET-07**: Unsupported NAP domains fail with clear errors before privileged behavior is attempted.

### Minimum NAP APIs and Approvals

- [ ] **NAP-01**: Napplet can complete NAP-SHELL handshake and discover supported runtime capabilities.
- [ ] **NAP-02**: Napplet can use minimal NAP-RELAY query/subscribe through backend relay services with bounded filters and lifecycle cleanup.
- [ ] **NAP-03**: Napplet can request NAP-RELAY publish through backend signing and receive publish result/error settlement.
- [ ] **NAP-04**: User sees and can approve or deny sensitive publish/signing requests before the backend signs or publishes.
- [ ] **NAP-05**: Napplet can use read-only NAP-IDENTITY for current pubkey, relays, profile, and cached social identity data without signer access.
- [ ] **NAP-06**: Napplet can use scoped NAP-STORAGE key-value persistence with per-napplet namespace and quota enforcement.
- [ ] **NAP-07**: Napplet can use minimal NAP-RESOURCE for safe mediated `https`, Nostr, and Blossom reads with limits and policy checks.
- [ ] **NAP-08**: Napplet can use basic NAP-INTENT to discover handlers and open/invoke installed napplets through user-owned defaults.
- [ ] **NAP-09**: Napplet can read current shell theme through basic NAP-THEME.
- [ ] **NAP-10**: Napplet can request in-app notification/toast behavior through basic NAP-NOTIFY.
- [ ] **NAP-11**: Capability grants are persisted server-side by account, napplet identity/version, method/domain, normalized scope, expiry, and revocation state.
- [ ] **NAP-12**: User can inspect, revoke, and deny remembered napplet permissions from settings.

### Mobile UX and Diagnostics

- [ ] **UX-01**: User can run napplets in a fullscreen mobile layout that handles safe areas, dynamic viewport height, keyboard occlusion, and touch-friendly controls.
- [ ] **UX-02**: User can access sign-in, settings, permissions, installed napplets, relay/blossom configuration, and diagnostics from mobile navigation.
- [ ] **UX-03**: User sees understandable loading, offline, relay failure, permission denied, runtime error, and napplet crash states.
- [ ] **UX-04**: User approval modals clearly identify the napplet, requested capability, account, relays/resource targets, event kind, and irreversible effects where applicable.
- [ ] **UX-05**: Developer or advanced user can inspect active sessions, recent NAP envelopes, relay health, grants, storage usage, and runtime errors.
- [ ] **UX-06**: Mobile behavior is verified on physical iOS Safari and Android Chrome, not only desktop responsive emulation.

### Security, Privacy, and Deployment Readiness

- [ ] **SEC-01**: Project has route/security tests or checks for iframe message validation, session enforcement, permission enforcement, and sensitive log redaction.
- [ ] **SEC-02**: Production deployment plan avoids blanket `deno serve -A` permissions where practical and documents required Deno permissions.
- [ ] **SEC-03**: Resource proxy prevents SSRF, DNS rebinding, oversized responses, dangerous MIME handling, and unbounded network access.
- [ ] **SEC-04**: CSP and Permissions-Policy restrict shell and iframe capabilities according to the selected content-origin strategy.
- [ ] **SEC-05**: Server logs, diagnostics, and persisted records avoid leaking `nsec`, bunker secrets, NIP-46 tokens, session secrets, or raw signer payloads.
- [ ] **SEC-06**: Privacy model documents what the server can observe about pubkeys, relays, napplet usage, grants, request timing, and resource access.
- [ ] **SEC-07**: Release build passes Deno format, lint, type-checking, and the project verification checklist.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Runtime Expansion

- **V2-01**: User can switch between multiple Nostr accounts with isolated sessions, event state, signer bindings, relay settings, and permissions.
- **V2-02**: User can install napplets from remote signed manifests with full NIP-5A aggregate hash/blob verification.
- **V2-03**: Runtime supports offline/resumable event cache behavior with explicit storage budgets and replay semantics.
- **V2-04**: Runtime can run background server jobs for relay sync or upload tasks with user-visible controls and quotas.

### Additional NAP Domains

- **V2-05**: Napplet can use NAP-UPLOAD with Blossom/NIP-compatible rails after upload approvals and storage policy are mature.
- **V2-06**: Napplet can use NAP-LINK for mediated external link opening.
- **V2-07**: Napplet can use NAP-INC when inter-napplet workflows require it.
- **V2-08**: Napplet can use NAP-CONFIG for declarative settings.
- **V2-09**: Napplet can use NAP-MEDIA for richer media session controls.
- **V2-10**: Napplet can use NAP-KEYS for desktop/tablet shortcut behavior.

### Advanced Capabilities

- **V2-11**: Runtime supports Blossom mirroring and artifact/blob management.
- **V2-12**: Runtime exposes a developer envelope inspector once envelope contracts are stable.
- **V2-13**: Runtime supports NAP-VALUE/zaps after wallet/signing risk controls are mature.
- **V2-14**: Runtime supports NAP-POW with strict quotas and abuse prevention if ecosystem demand appears.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Native mobile app | v1 validates mobile web runtime first. |
| General-purpose Nostr social client completeness | Runtime value should be delivered through napplets, not a shell-owned social client. |
| Browser-only relay/storage/signing runtime | Contradicts the server-side runtime goal and burdens mobile browsers. |
| Unsandboxed napplet execution | Violates the trust boundary for untrusted napplet code. |
| Exposing `window.nostr` or raw signer RPC to napplets | Bypasses runtime policy and approval enforcement. |
| Direct arbitrary network access / NAP-CONNECT | High exfiltration and SSRF risk; use mediated resource/relay/upload APIs. |
| Silent blanket approvals | Users must retain visible control over sensitive napplet capabilities. |
| Napplet-controlled default handlers | Intent defaults must be user-owned and catalog-backed. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHELL-01 | TBD | Pending |
| SHELL-02 | TBD | Pending |
| SHELL-03 | TBD | Pending |
| SHELL-04 | TBD | Pending |
| SHELL-05 | TBD | Pending |
| AUTH-01 | TBD | Pending |
| AUTH-02 | TBD | Pending |
| AUTH-03 | TBD | Pending |
| AUTH-04 | TBD | Pending |
| AUTH-05 | TBD | Pending |
| AUTH-06 | TBD | Pending |
| AUTH-07 | TBD | Pending |
| NOSTR-01 | TBD | Pending |
| NOSTR-02 | TBD | Pending |
| NOSTR-03 | TBD | Pending |
| NOSTR-04 | TBD | Pending |
| NOSTR-05 | TBD | Pending |
| NOSTR-06 | TBD | Pending |
| NOSTR-07 | TBD | Pending |
| NOSTR-08 | TBD | Pending |
| BRIDGE-01 | TBD | Pending |
| BRIDGE-02 | TBD | Pending |
| BRIDGE-03 | TBD | Pending |
| BRIDGE-04 | TBD | Pending |
| BRIDGE-05 | TBD | Pending |
| BRIDGE-06 | TBD | Pending |
| BRIDGE-07 | TBD | Pending |
| NAPLET-01 | TBD | Pending |
| NAPLET-02 | TBD | Pending |
| NAPLET-03 | TBD | Pending |
| NAPLET-04 | TBD | Pending |
| NAPLET-05 | TBD | Pending |
| NAPLET-06 | TBD | Pending |
| NAPLET-07 | TBD | Pending |
| NAP-01 | TBD | Pending |
| NAP-02 | TBD | Pending |
| NAP-03 | TBD | Pending |
| NAP-04 | TBD | Pending |
| NAP-05 | TBD | Pending |
| NAP-06 | TBD | Pending |
| NAP-07 | TBD | Pending |
| NAP-08 | TBD | Pending |
| NAP-09 | TBD | Pending |
| NAP-10 | TBD | Pending |
| NAP-11 | TBD | Pending |
| NAP-12 | TBD | Pending |
| UX-01 | TBD | Pending |
| UX-02 | TBD | Pending |
| UX-03 | TBD | Pending |
| UX-04 | TBD | Pending |
| UX-05 | TBD | Pending |
| UX-06 | TBD | Pending |
| SEC-01 | TBD | Pending |
| SEC-02 | TBD | Pending |
| SEC-03 | TBD | Pending |
| SEC-04 | TBD | Pending |
| SEC-05 | TBD | Pending |
| SEC-06 | TBD | Pending |
| SEC-07 | TBD | Pending |

**Coverage:**
- v1 requirements: 60 total
- Mapped to phases: 0
- Unmapped: 60

---
*Requirements defined: 2026-07-30*
*Last updated: 2026-07-30 after initial definition*
