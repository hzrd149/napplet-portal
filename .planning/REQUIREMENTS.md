# Requirements: Napplet Portal

**Defined:** 2026-07-30
**Updated:** 2026-07-30 after MVP scope alignment
**Core Value:** A napplet can run in a mobile browser while a server-side Deno runtime handles the heavy Nostr/runtime work.

## v1 Requirements

v1 is the complete Phase 1 MVP. Its original one-day vertical tracer remains the first delivery checkpoint, but every Phase 1 requirement remains in scope with no one-day completion deadline per D-47. It proves the locked vertical slice: sign in, load one sandboxed napplet, and proxy the specified stream-oriented runtime API through the backend.

### Phase 1 Vertical Slice

- [x] **MVP-01**: User can open a Napplet Portal shell that has replaced the Fresh starter UI with a simple mobile-first product shell.
- [x] **MVP-02**: User can load one known/test napplet in a sandboxed iframe from the portal shell.
- [x] **MVP-03**: The iframe host follows the reference-only `../napplet` contracts through pinned npm packages, or uses the canonical minimal source-bound adapter when the executable Deno import probe requires it.
- [x] **MVP-04**: The backend has a minimal runtime boundary that receives napplet messages and routes them through server-owned TypeScript code.
- [x] **MVP-05**: Napplet messages include correlation IDs and return success/error responses without the napplet directly accessing relays, signers, storage, or server internals.

### Sign-In MVP

- [x] **AUTH-01**: User can start a Nostr sign-in flow from the shell.
- [ ] **AUTH-02**: MVP sign-in supports NIP-46 bunker URI input.
- [x] **AUTH-03**: MVP sign-in supports Nostr Connect QR-code display or handoff flow.
- [ ] **AUTH-04**: MVP sign-in supports `nsec` dev mode for fast local testing, with key material isolated from napplets and excluded from URLs/logs/browser-accessible storage.
- [ ] **AUTH-05**: MVP explicitly documents read-only `npub` mode as deferred beyond the locked Phase 1 account modes; the former one-day deadline is not the reason for this boundary.
- [ ] **AUTH-06**: User can see the active account/pubkey state in the shell after sign-in.

### Stream-First Applesauce Runtime

- [x] **STREAM-01**: Runtime code treats Nostr data as streams that continue updating rather than finite loads that become complete.
- [x] **STREAM-02**: Runtime code uses Applesauce/RxJS observables for relay/event/model flows where practical.
- [ ] **STREAM-03**: Runtime code avoids nested subscriptions; stream composition should use RxJS operators or shared observable pipelines.
- [x] **STREAM-04**: Runtime code avoids unnecessary `async` flows that wait for all Nostr data before rendering or responding.
- [x] **STREAM-05**: UI shows partial/empty/updating stream states instead of blocking loading screens that wait for data to be complete.
- [ ] **STREAM-06**: The first napplet-facing data API can return an initial empty/partial value and then update through the selected stream/channel path.
- [x] **STREAM-07**: MVP leaves an explicit adapter/configuration seam for local Nostr relay and local Blossom server cache backends, even if durable caching is deferred.

### Minimal NAP Surface

- [x] **NAP-01**: Napplet can complete a minimal shell/runtime handshake.
- [x] **NAP-02**: Napplet can request current identity/account state from the backend through a read-oriented API.
- [x] **NAP-03**: Napplet can receive at least one backend-proxied stream of Nostr-derived or fixture data.
- [x] **NAP-04**: Unsupported NAP methods fail with explicit typed errors rather than silent no-ops.

### MVP Quality Bar

- [x] **QUAL-01**: Implementation keeps backend runtime logic out of hydrated islands.
- [x] **QUAL-02**: Implementation keeps signers, key material, relay connections, and event stores on the backend side of the napplet boundary.
- [x] **QUAL-03**: `deno task check` passes for the MVP.
- [ ] **QUAL-04**: MVP documentation clearly marks what is intentionally mocked, incomplete, or deferred.

## v2 Requirements

Deferred beyond the complete locked Phase 1 MVP. These guide future phases and are excluded by the phase boundary, not by a one-day deadline.

### Backend Nostr Runtime Expansion

- **V2-01**: Backend runtime uses Applesauce packages for production event storage, relay pools, loaders, accounts, signers, and model derivation.
- **V2-02**: Runtime persists Nostr events in an Applesauce-compatible database with dedupe, relay provenance, replaceable/addressable/delete semantics, and bounded sync.
- **V2-03**: User can configure read/write/fallback relays and Blossom servers from settings.
- **V2-04**: Runtime can connect to local Nostr relays as event cache/read-through backends for loaded napplets and user state.
- **V2-05**: Runtime can connect to local Blossom servers as blob/artifact cache backends for napplet manifests, assets, and media.
- **V2-06**: Runtime supports NIP-65 relay-list routing and NIP-42 relay AUTH as separate concerns from portal login and signer authorization.

### Napplet Runtime Expansion

- **V2-07**: Portal integrates `../kehto` as the canonical backend NAP dispatch/runtime contract.
- **V2-08**: Portal resolves `../kehto`, `../napplet`, and `@napplet/*` version/API drift with contract tests.
- **V2-09**: User can manage an installed napplet catalog with manifest identity, source, capabilities, and default handler state.
- **V2-10**: Runtime-attested napplet identity comes from verified or catalog-controlled manifest data.

### Additional NAP APIs and Policy

- **V2-11**: Runtime implements minimal NAP-RELAY query/subscribe/publish with backend signing and publish settlement.
- **V2-12**: Runtime implements scoped NAP-STORAGE with per-napplet namespace and quotas.
- **V2-13**: Runtime implements mediated NAP-RESOURCE with SSRF, MIME, size, and policy controls.
- **V2-14**: Runtime implements basic NAP-INTENT, NAP-THEME, and NAP-NOTIFY.
- **V2-15**: User can approve, deny, remember, inspect, and revoke per-napplet capability grants.
- **V2-16**: Runtime adds NAP-UPLOAD, NAP-LINK, NAP-INC, NAP-CONFIG, NAP-MEDIA, NAP-KEYS, NAP-VALUE, or NAP-POW only when real napplets require them.

### Product Hardening

- **V2-17**: Mobile shell handles safe areas, keyboard occlusion, touch-friendly approval modals, error states, diagnostics, and real-device verification.
- **V2-18**: Production deployment documents minimal Deno permissions, CSP, Permissions-Policy, privacy model, and sensitive log redaction.
- **V2-19**: Security tests cover iframe message validation, session enforcement, permission enforcement, resource proxy controls, local cache backend trust boundaries, and key material handling.
- **V2-20**: Multi-account support isolates sessions, signer bindings, event state, relay settings, local cache namespaces, and napplet permissions.

## Out of Scope

Explicitly excluded from the locked Phase 1 MVP.

| Feature | Reason |
|---------|--------|
| Full Nostr social client | The MVP proves napplet runtime value, not social-client completeness. |
| Full NAP coverage | Too large for one day; implement only the minimum handshake/identity/stream seam. |
| Production-grade relay sync | Applesauce stream architecture matters now, but full sync/storage is future work. |
| Durable local relay/blob cache implementation | The MVP should leave a seam, but robust event/blob cache policy belongs after the vertical slice works. |
| Production key custody | `nsec` is dev-mode only unless a later threat model makes direct custody acceptable. |
| Blocking loading screens for Nostr data | Nostr streams are never truly complete; the UI should show partial/updating state. |
| Native mobile app | Mobile web first. |
| Unsandboxed napplet execution | Violates the trust boundary. |
| Exposing `window.nostr` or raw signer RPC to napplets | Bypasses the runtime and approval model. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MVP-01 | Phase 1 | Complete |
| MVP-02 | Phase 1 | Complete |
| MVP-03 | Phase 1 | Complete |
| MVP-04 | Phase 1 | Complete |
| MVP-05 | Phase 1 | Complete |
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| AUTH-06 | Phase 1 | Pending |
| STREAM-01 | Phase 1 | Complete |
| STREAM-02 | Phase 1 | Complete |
| STREAM-03 | Phase 1 | Pending |
| STREAM-04 | Phase 1 | Complete |
| STREAM-05 | Phase 1 | Complete |
| STREAM-06 | Phase 1 | Pending |
| STREAM-07 | Phase 1 | Complete |
| NAP-01 | Phase 1 | Complete |
| NAP-02 | Phase 1 | Complete |
| NAP-03 | Phase 1 | Complete |
| NAP-04 | Phase 1 | Complete |
| QUAL-01 | Phase 1 | Complete |
| QUAL-02 | Phase 1 | Complete |
| QUAL-03 | Phase 1 | Complete |
| QUAL-04 | Phase 1 | Pending |

**Coverage:**

- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-07-30*
*Last updated: 2026-07-30 after MVP scope alignment*
