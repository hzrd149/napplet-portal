# Roadmap: Napplet Portal

## Overview

Napplet Portal starts with a complete Phase 1 MVP: load one sandboxed napplet in a mobile Fresh shell, support the locked Nostr sign-in paths, and prove the complete locked backend stream-runtime seam. The sign-in → supplied verified napplet → initial-plus-updating backend stream tracer is the first delivery checkpoint and is targeted for one day; full Phase 1 completion has no one-day deadline and retains every locked decision and requirement.

The roadmap intentionally avoids building everything at once. Phase 1 is the MVP. Phases 2 and 3 are expansion tracks for future work after the vertical slice proves the runtime direction.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Napplet Runtime MVP** - User can sign in, load one sandboxed napplet, and use the complete locked backend-proxied stream runtime seam.
- [ ] **Phase 2: Backend Runtime Expansion** - Backend grows from MVP seam into durable Applesauce relay/event/account runtime with local relay/blob caching and Kehto contract integration.
- [ ] **Phase 3: NAP Coverage, Policy, and Production Hardening** - Runtime expands NAP domains, approval persistence, mobile diagnostics, and deployment/security controls.

## Phase Details

### Phase 1: Napplet Runtime MVP

**Goal:** As a mobile napplet user, I want to sign in, open the supplied verified sandboxed napplet in the mobile shell, and use the complete locked backend-proxied stream-first runtime seam, so that a mobile browser can run the napplet while the Deno server runtime owns the heavy Nostr work; the sign-in → supplied napplet → initial-plus-updating stream tracer is the one-day-targeted first checkpoint, while full completion has no one-day deadline (D-47).
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: MVP-01, MVP-02, MVP-03, MVP-04, MVP-05, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, STREAM-01, STREAM-02, STREAM-03, STREAM-04, STREAM-05, STREAM-06, STREAM-07, NAP-01, NAP-02, NAP-03, NAP-04, QUAL-01, QUAL-02, QUAL-03, QUAL-04
**Success Criteria** (what must be TRUE):

  1. User can open a non-starter Fresh shell on mobile, sign in with NIP-46 bunker URI, Nostr Connect QR/handoff, or isolated `nsec` dev mode, and see active account/pubkey state.
  2. User can launch one known/test napplet in a sandboxed iframe using pinned npm packages aligned with the reference-only `../napplet` contracts, or a minimal compatible iframe adapter where necessary.
  3. Napplet can complete a minimal shell/runtime handshake, send correlated messages to the backend, and receive typed success/error responses without direct relay, signer, storage, or server access.
  4. Backend exposes at least one napplet-facing identity or Nostr-derived stream that can emit partial/empty/updating values without waiting for all relay data to finish loading.
  5. Runtime code follows pragmatic Applesauce/RxJS stream composition: avoid nested subscriptions, avoid blocking on complete data, and reserve `async`/`await` for one-shot setup or commands.
  6. MVP leaves an explicit seam for local Nostr relay and local Blossom cache backends so future phases can avoid always refetching napplet events/blobs from public relays and servers.
  7. `deno task check` passes, and MVP docs clearly mark mocked, incomplete, and deferred behavior.

**Plans**: 6/6 plans executed

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — One-day sign-in → supplied verified napplet → live backend stream tracer
- [x] 01-02-PLAN.md — Backend account persistence, sign-in, and global identity lifecycle
- [x] 01-03-PLAN.md — Verified artifact resolution and reconnectable WebSocket window ownership

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-04-PLAN.md — Approved mobile shell and persistent opaque iframe bridge
- [x] 01-05-PLAN.md — Applesauce relay/outbox streams, publishing, and singleton runtime

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-06-PLAN.md — Fresh composition, documentation, and supplied-napplet acceptance

**UI hint**: yes

### Phase 2: Backend Runtime Expansion

**Goal:** Developers can evolve the MVP seam into durable backend-owned Nostr/account/runtime foundations using Applesauce, local cache backends, and the sibling napplet packages.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: V2-01, V2-02, V2-03, V2-04, V2-05, V2-06, V2-07, V2-08, V2-09, V2-10
**Success Criteria** (what must be TRUE):

  1. Backend runtime uses Applesauce event stores, relay pools, loaders, accounts, signers, and observable models where practical.
  2. Runtime persists Nostr events with dedupe, relay provenance, replaceable/addressable/delete semantics, bounded sync, and teardown.
  3. Runtime can use local Nostr relays as event cache/read-through backends and local Blossom servers as blob/artifact cache backends for loaded napplets.
  4. User can configure relays and Blossom servers while runtime keeps portal login, signer authority, cache trust, and relay AUTH separate.
  5. Developer can verify `../kehto`, `../napplet`, and `@napplet/*` contracts through documented adapters and tests.

**Plans**: TBD
**UI hint**: yes

### Phase 3: NAP Coverage, Policy, and Production Hardening

**Goal:** Users can run more capable napplets with broader NAP APIs, persistent approvals, mobile diagnostics, and production security controls.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: V2-11, V2-12, V2-13, V2-14, V2-15, V2-16, V2-17, V2-18, V2-19, V2-20
**Success Criteria** (what must be TRUE):

  1. Runtime supports additional NAP domains only as real napplet needs justify them.
  2. User can approve, deny, remember, inspect, and revoke per-napplet capability grants.
  3. Mobile shell handles real-device UX concerns, diagnostics, failures, and permission flows.
  4. Production deployment has documented Deno permissions, CSP, Permissions-Policy, privacy model, sensitive log redaction, and security tests.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Napplet Runtime MVP | 6/6 | Verification/UAT Pending |  |
| 2. Backend Runtime Expansion | 0/TBD | Future expansion | - |
| 3. NAP Coverage, Policy, and Production Hardening | 0/TBD | Future expansion | - |

## Requirement Coverage

| Requirement | Phase |
|-------------|-------|
| MVP-01 | Phase 1 |
| MVP-02 | Phase 1 |
| MVP-03 | Phase 1 |
| MVP-04 | Phase 1 |
| MVP-05 | Phase 1 |
| AUTH-01 | Phase 1 |
| AUTH-02 | Phase 1 |
| AUTH-03 | Phase 1 |
| AUTH-04 | Phase 1 |
| AUTH-05 | Phase 1 |
| AUTH-06 | Phase 1 |
| STREAM-01 | Phase 1 |
| STREAM-02 | Phase 1 |
| STREAM-03 | Phase 1 |
| STREAM-04 | Phase 1 |
| STREAM-05 | Phase 1 |
| STREAM-06 | Phase 1 |
| STREAM-07 | Phase 1 |
| NAP-01 | Phase 1 |
| NAP-02 | Phase 1 |
| NAP-03 | Phase 1 |
| NAP-04 | Phase 1 |
| QUAL-01 | Phase 1 |
| QUAL-02 | Phase 1 |
| QUAL-03 | Phase 1 |
| QUAL-04 | Phase 1 |

**Coverage:** 26/26 v1 requirements mapped exactly once.

## Planning Guidance

When executing Phase 1, deliver the one-day-targeted sign-in → supplied verified napplet → initial-plus-updating stream tracer as the first working checkpoint, then complete every locked decision and requirement without a one-day deadline:

- Prefer a simple known/test napplet over a generalized catalog.
- Prefer one backend-proxied stream over complete relay sync.
- Prefer observable pipelines and partial updates over complete-data loading states.
- Deliver the locked local relay/local Blossom endpoint and in-memory adapter seams; defer only durable cache policy and synchronization beyond Phase 1.
- Prefer explicit TODO/deferred notes over building broad settings, approvals, NAP domains, or production storage immediately.
- Treat `nsec` as dev mode, not a production key-custody decision.

## Backlog

### Phase 999.1: Installed napplets launchable from home via naddr (BACKLOG)

**Goal:** Users can maintain an installed list of napplets, launch them from the home page, and initially install a napplet by pasting its `naddr` so the portal can fetch and add it.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with $gsd-review-backlog when ready)

### Phase 999.2: App shell dark and light themes (BACKLOG)

**Goal:** The app shell supports dark and light themes.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with $gsd-review-backlog when ready)

### Phase 999.3: NAP-RESOURCE resolution for HTTP, Blossom, and BUD-10 URLs (BACKLOG)

**Goal:** Runtime supports NAP-RESOURCE resolution for HTTP URLs, Blossom URLs, and BUD-10 URIs, trying configured local Blossom servers first for Blossom-backed resources.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with $gsd-review-backlog when ready)

### Phase 999.4: NAP-UPLOAD API with configured Blossom servers (BACKLOG)

**Goal:** Investigate and support the NAP-UPLOAD API using the user's configured Blossom servers and the `blossom-client-sdk` library, with optional upload to a local Blossom server after successful upload to the configured remote servers.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with $gsd-review-backlog when ready)

### Phase 999.5: Searchable installed napplets on the home page (BACKLOG)

**Goal:** The home page can search installed napplets so users can quickly find a napplet when many are installed.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with $gsd-review-backlog when ready)

### Phase 999.6: Full NAP-COMMON support with Applesauce APIs (BACKLOG)

**Goal:** Runtime fully supports NAP-COMMON so other users' profiles and common Nostr data can be easily loaded, using Applesauce packages' simple APIs where available and reviewing examples and documentation before writing custom implementation.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with $gsd-review-backlog when ready)

### Phase 999.7: Custom SVG vector app icon (BACKLOG)

**Goal:** The app uses a proper simple SVG vector icon instead of the default Deno Fresh icon.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with $gsd-review-backlog when ready)

### Phase 999.8: NAP-INTENT cross-napplet navigation (BACKLOG)

**Goal:** Runtime supports NAP-INTENT for cross-napplet navigation, including decisions for replacing the current napplet, opening a new browser tab, or stacking a new iframe napplet on top when launching a new napplet archetype.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with $gsd-review-backlog when ready)

### Phase 999.9: Home header account card and compact bottom nav (BACKLOG)

**Goal:** Move the sign-in button and account card into a header card on the home page so account controls are visible only when the user is not viewing a napplet, then reduce bottom nav height to two simple icon buttons: home on the left and the current account avatar on the right.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with $gsd-review-backlog when ready)

### Phase 999.10: Cyberpunk backend connection loading sequence (BACKLOG)

**Goal:** Add a polished cyberpunk-style loading animation for the browser tab's backend runtime connection flow, covering connection pending, connected, and bootup sequence states.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with $gsd-review-backlog when ready)
