# Requirements: Napplet Portal v1.1

**Defined:** 2026-07-30
**Core Value:** A napplet can run in a mobile browser while a server-side Deno runtime handles the heavy Nostr/runtime work.

## v1.1 Requirements

### Installed Napplets

- [x] **CAT-01**: User can install a napplet by submitting a valid `naddr` and approving the resolved verified manifest.
- [x] **CAT-02**: User can see installed napplets on the home page with partial, stale, empty, loading, and error states preserved during synchronization.
- [x] **CAT-03**: User can launch an installed napplet only from its accepted manifest event identity.
- [x] **CAT-04**: User can search installed napplets on the home page by meaningful manifest metadata without waiting for relay synchronization to finish.

### Resource and Upload

- [x] **RES-01**: Napplet can inspect supported resource schemes and coarse runtime limits through the pinned NAP-RESOURCE contract.
- [x] **RES-02**: Napplet can resolve bounded HTTP(S), Blossom, and BUD-10 resources through the backend without gaining unrestricted network access.
- [x] **RES-03**: Runtime tries configured local Blossom cache servers before upstream Blossom sources while preserving content hash, MIME, size, redirect, timeout, and SSRF policy checks.
- [x] **UPL-01**: Napplet can inspect configured upload rails and coarse limits and submit bytes through the pinned NAP-UPLOAD contract.
- [x] **UPL-02**: Runtime uploads through a reviewed pinned `blossom-client-sdk` using the user's configured Blossom servers and backend-owned authorization.
- [x] **UPL-03**: User receives explicit per-server upload outcomes, including partial failures, and optional local Blossom copying occurs only after required remote upload success.

### Common and Storage

- [x] **COM-01**: Napplet can use the pinned NAP-COMMON NIP-19 encode/decode and common Nostr helper actions.
- [x] **COM-02**: Napplet can load other users' profile and common Nostr data through Applesauce-backed, stream-oriented backend services.
- [x] **STO-01**: Napplet can set, get, list, and remove scoped key-value data through the pinned NAP-STORAGE contract.
- [x] **STO-02**: Runtime isolates storage by account and verified napplet identity, supports shared and per-instance scope where the contract requires it, and enforces quotas and deterministic serialization.
- [x] **STO-03**: Napplet storage persists across browser reconnects and portal restarts without becoming shell configuration or browser-owned authority.

### Intent and Media

- [x] **INT-01**: Napplet can inspect available intent handlers derived from installed, verified manifest contracts.
- [x] **INT-02**: Napplet can invoke a supported archetype/action and receive a canonical handled, unavailable, denied, or failed result.
- [x] **INT-03**: Shell policy can focus or reuse the current handler, open a new browser tab, or stack a new iframe while preserving sandbox and history behavior.
- [x] **MED-01**: Napplet can create and control an ownership-aware NAP-MEDIA session through the backend runtime.
- [x] **MED-02**: Only one browser tab owns playback for the active media session, and starting playback elsewhere stops or transfers the competing owner deterministically.
- [ ] **MED-03**: Every connected tab receives current media state, can request transfer to itself, and can stop the active session from the shell navigation.
- [x] **MED-04**: Closing the origin tab closes its media session, while stale or reconnected tabs cannot reclaim ownership with outdated commands.

### Shell and Resilience

- [x] **SHL-01**: User can select or follow system dark/light theme across server-rendered shell views and runtime states.
- [x] **SHL-02**: User sees a Napplet Portal SVG icon instead of Fresh starter branding.
- [x] **SHL-03**: User sees sign-in/account controls in a home-page header card and a compact bottom navigation with home and current-account controls while a napplet is open.
- [x] **CON-01**: User sees a polished cyberpunk connection sequence driven by actual pending, connected, bootstrapping, ready, retry, and failure states, with reduced-motion and accessible status support.
- [x] **CON-02**: User sees a compact bottom-navigation indicator reflecting the current tab's backend runtime connection state.
- [x] **CON-03**: A disconnected or resumed mobile tab reconnects automatically with capped exponential backoff and jitter while preserving the existing reconnect-token/grace semantics.
- [x] **CON-04**: Intentional closure cancels reconnect work, and offline, hidden, or repeated-failure states do not create reconnect storms.

### Quality and Security

- [ ] **QLT-01**: Every added NAP domain is checked against the pinned production packages with contract and dispatcher tests; sibling repositories remain reference-only.
- [ ] **QLT-02**: Napplet-controlled input cannot bypass sandboxing, capability checks, URL/resource policy, storage isolation, signer boundaries, or catalog launch authority.
- [ ] **QLT-03**: Automated tests cover normal, empty, partial, denied, stale, reconnect, and failure behavior for each new runtime seam, and `deno task check` passes.
- [ ] **QLT-04**: Mobile-browser UAT verifies navigation, themes, connection recovery, stacked/new-tab intent behavior, and cross-tab media ownership on supported real devices.

## Future Requirements

### Deferred Seeds

- **AUTH-07**: User can enter a read-only `npub` account mode without signer authority.
- **NTF-01**: Napplet can request active-tab notifications and, where explicitly permitted, Web Push notifications through NAP-NOTIFY.
- **PWA-01**: User can install Napplet Portal as a PWA and use an explicitly bounded offline experience on mobile.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Read-only `npub` sign-in | SEED-001 was not selected for this milestone. |
| NAP-NOTIFY and Web Push | SEED-003 was not selected; browser permission and background delivery need a dedicated scope. |
| PWA installation and offline runtime | SEED-006 was not selected; offline semantics for backend-owned Nostr state need separate design. |
| Full remaining NAP API surface | v1.1 implements only the backlog-selected domains; LINK, INC, CONFIG, KEYS, VALUE, POW, and other domains remain demand-driven. |
| Unsandboxed napplet networking, storage, or signing | Violates the portal's explicit backend proxy and capability boundary. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHL-01, SHL-02, SHL-03 | Phase 3 | Complete |
| CON-01, CON-02, CON-03, CON-04 | Phase 3 | Complete |
| CAT-01, CAT-02, CAT-03, CAT-04 | Phase 4 | Pending |
| RES-01, RES-02, RES-03 | Phase 5 | Complete |
| UPL-01, UPL-02, UPL-03 | Phase 5 | Complete |
| COM-01, COM-02 | Phase 6 | Pending |
| STO-01, STO-02, STO-03 | Phase 6 | Pending |
| INT-01, INT-02, INT-03 | Phase 7 | Complete |
| MED-01, MED-02, MED-03, MED-04 | Phase 8 | Pending |
| QLT-01, QLT-02, QLT-03, QLT-04 | Phase 9 | Pending |

**Coverage:**

- v1.1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-30*
*Last updated: 2026-07-30 after v1.1 roadmap creation*
