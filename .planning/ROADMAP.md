# Roadmap: Napplet Portal

## Overview

Napplet Portal starts with a one-day MVP: load one sandboxed napplet in a mobile Fresh shell, support the essential Nostr sign-in paths, and prove that napplet messages can be proxied to a backend runtime that treats Nostr data as streams. Later phases expand the backend Nostr runtime, local Nostr relay and local Blossom cache backends, Kehto/napplet-web integration, NAP API coverage, approvals, diagnostics, and production hardening.

The roadmap intentionally avoids building everything at once. Phase 1 is the MVP. Phases 2 and 3 are expansion tracks for future work after the vertical slice proves the runtime direction.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: One-Day Napplet Runtime MVP** - User can sign in, load one sandboxed napplet, and see backend-proxied stream-oriented runtime data.
- [ ] **Phase 2: Backend Runtime Expansion** - Backend grows from MVP seam into durable Applesauce relay/event/account runtime with local relay/blob caching and Kehto contract integration.
- [ ] **Phase 3: NAP Coverage, Policy, and Production Hardening** - Runtime expands NAP domains, approval persistence, mobile diagnostics, and deployment/security controls.

## Phase Details

### Phase 1: One-Day Napplet Runtime MVP
**Goal:** User can sign in, open one known sandboxed napplet in the mobile shell, and receive backend-proxied runtime data through a simple stream-first architecture.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: MVP-01, MVP-02, MVP-03, MVP-04, MVP-05, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, STREAM-01, STREAM-02, STREAM-03, STREAM-04, STREAM-05, STREAM-06, STREAM-07, NAP-01, NAP-02, NAP-03, NAP-04, QUAL-01, QUAL-02, QUAL-03, QUAL-04
**Success Criteria** (what must be TRUE):
  1. User can open a non-starter Fresh shell on mobile, sign in with NIP-46 bunker URI, Nostr Connect QR/handoff, or isolated `nsec` dev mode, and see active account/pubkey state.
  2. User can launch one known/test napplet in a sandboxed iframe using `../napplet-web` where practical or a minimal compatible iframe adapter where necessary.
  3. Napplet can complete a minimal shell/runtime handshake, send correlated messages to the backend, and receive typed success/error responses without direct relay, signer, storage, or server access.
  4. Backend exposes at least one napplet-facing identity or Nostr-derived stream that can emit partial/empty/updating values without waiting for all relay data to finish loading.
  5. Runtime code follows pragmatic Applesauce/RxJS stream composition: avoid nested subscriptions, avoid blocking on complete data, and reserve `async`/`await` for one-shot setup or commands.
  6. MVP leaves an explicit seam for local Nostr relay and local Blossom cache backends so future phases can avoid always refetching napplet events/blobs from public relays and servers.
  7. `deno task check` passes, and MVP docs clearly mark mocked, incomplete, and deferred behavior.
**Plans**: TBD
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
  5. Developer can verify `../kehto`, `../napplet-web`, and `@napplet/*` contracts through documented adapters and tests.
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
| 1. One-Day Napplet Runtime MVP | 0/TBD | Not started | - |
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

When planning Phase 1, optimize for a working vertical slice in one day:

- Prefer a simple known/test napplet over a generalized catalog.
- Prefer one backend-proxied stream over complete relay sync.
- Prefer observable pipelines and partial updates over complete-data loading states.
- Leave a clear local relay/local Blossom cache seam, but defer durable cache policy and sync beyond the one-day MVP.
- Prefer explicit TODO/deferred notes over building broad settings, approvals, NAP domains, or production storage immediately.
- Treat `nsec` as dev mode, not a production key-custody decision.
