# Roadmap: Napplet Portal

## Overview

Napplet Portal v1 is delivered as four coarse MVP phases that move from a safe Fresh mobile shell and account boundary, through the backend Nostr/runtime foundation, into sandboxed napplet execution with minimum NAP APIs, and finally into mobile diagnostics, security hardening, privacy, and release readiness. The roadmap compresses the research-suggested eight-step sequence into coarse delivery boundaries while preserving dependency order and mapping every explicit v1 requirement ID exactly once.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Secure Mobile Shell & Account Boundary** - Users can enter a safe Fresh app shell, sign in/out, and see account/session state without backend runtime logic leaking into islands.
- [ ] **Phase 2: Backend Nostr Runtime & Napplet Contracts** - Developers have the Applesauce-backed Nostr authority and Kehto/napplet-web contract foundation needed for real napplet execution.
- [ ] **Phase 3: Sandboxed Napplet Bridge & Minimum NAP APIs** - Napplets can run through a validated iframe/backend bridge and use the MVP NAP domains with server-enforced approvals.
- [ ] **Phase 4: Mobile Diagnostics, Security & Release Readiness** - Users and developers can validate the mobile runtime, inspect failures, manage risk, and ship with hardened deployment controls.

## Phase Details

### Phase 1: Secure Mobile Shell & Account Boundary
**Goal:** Users can open a mobile-first Napplet Portal shell, authenticate with a Nostr identity, and manage visible account/session state through a safe Fresh boundary.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, UX-02
**Success Criteria** (what must be TRUE):
  1. User can open the Fresh portal and see a product shell with fullscreen napplet viewport, bottom navigation, settings/sign-in entry points, and active-account placeholders instead of starter demo UI.
  2. User can sign in and out through a shell-owned Nostr account/session flow that supports NIP-46/Nostr Connect, read-only npub mode, and visible logout/revoke controls.
  3. Developer can add request-scoped server state through the typed Fresh State contract while hydrated islands remain limited to UI, iframe lifecycle, and transient message state.
  4. Sessions, signer authority, relay AUTH state, and any direct key-custody policy are visibly separated so napplets cannot access secrets or signing power through browser storage, logs, or island imports.
  5. User can reach sign-in, settings, permissions, installed napplets, relay/blossom configuration, and diagnostics from the mobile navigation even where later screens are still placeholders.
**Plans**: TBD
**UI hint**: yes

### Phase 2: Backend Nostr Runtime & Napplet Contracts
**Goal:** Developers can rely on a backend-owned Nostr runtime and pinned napplet integration contracts before exposing privileged napplet APIs.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: NOSTR-01, NOSTR-02, NOSTR-03, NOSTR-04, NOSTR-05, NOSTR-06, NOSTR-07, NOSTR-08, NAPLET-01, NAPLET-02, NAPLET-03, NAPLET-04, NAPLET-05, NAPLET-06, NAPLET-07
**Success Criteria** (what must be TRUE):
  1. Developer can inspect a backend Nostr runtime that uses Applesauce where practical for event storage, relay pools, loaders, account/signer seams, and database integration.
  2. Backend can persist and expose Nostr event state with dedupe, relay provenance, replaceable/addressable/delete semantics, query deadlines, EOSE/CLOSED handling, and subscription teardown.
  3. User can configure read/write/fallback relays, Blossom servers, and inspect relay health while the backend applies NIP-65 routing and NIP-42 relay AUTH independently from portal login.
  4. Developer can verify the exact ../kehto and ../napplet-web exports, local @napplet/* version strategy, adapter boundary, and unsupported-domain failure behavior used by the portal.
  5. User can open a catalog-installed napplet record whose manifest, identity, source, capabilities, and runtime-attested identity are stored by the portal rather than trusted from iframe claims.
**Plans**: TBD
**UI hint**: yes

### Phase 3: Sandboxed Napplet Bridge & Minimum NAP APIs
**Goal:** Napplets can execute inside a restrictive iframe and call the MVP NAP surface only through backend validation, correlation, lifecycle cleanup, and approval enforcement.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: BRIDGE-01, BRIDGE-02, BRIDGE-03, BRIDGE-04, BRIDGE-05, BRIDGE-06, BRIDGE-07, NAP-01, NAP-02, NAP-03, NAP-04, NAP-05, NAP-06, NAP-07, NAP-08, NAP-09, NAP-10, NAP-11, NAP-12, UX-04, SEC-03
**Success Criteria** (what must be TRUE):
  1. User can open a sandboxed napplet iframe whose browser messages are validated for source, origin, nonce, session identity, and schema before any backend envelope is accepted.
  2. Napplet can complete NAP-SHELL handshake and use backend-proxied request/response or streaming calls with correlation IDs, typed errors, selected transport behavior, and cleanup on navigation/logout/disconnect.
  3. Napplet can use the minimum useful NAP domains: relay query/subscribe/publish, read-only identity, scoped storage, mediated resource reads, intent, theme, and in-app notifications.
  4. User sees approval modals that clearly identify the napplet, account, requested capability, target relays/resources/event kind, and irreversible effects before sensitive signing or publish behavior proceeds.
  5. User can inspect, deny, remember, and revoke server-side capability grants scoped by account, napplet identity/version, method/domain, normalized scope, expiry, and revocation state; unsafe resource requests are blocked before SSRF or unbounded network access.
**Plans**: TBD
**UI hint**: yes

### Phase 4: Mobile Diagnostics, Security & Release Readiness
**Goal:** Users and developers can validate Napplet Portal on real mobile browsers, understand runtime failures, and deploy with explicit security, privacy, and verification gates.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: UX-01, UX-03, UX-05, UX-06, SEC-01, SEC-02, SEC-04, SEC-05, SEC-06, SEC-07
**Success Criteria** (what must be TRUE):
  1. User can run napplets in a fullscreen mobile layout that handles safe areas, dynamic viewport height, keyboard occlusion, touch controls, offline/loading/failure states, permission denial, runtime errors, and napplet crashes.
  2. Developer or advanced user can inspect active sessions, recent NAP envelopes, relay health, grants, storage usage, runtime errors, and sensitive redaction behavior from diagnostics.
  3. Physical iOS Safari and Android Chrome verification confirms the mobile shell, iframe lifecycle, approvals, navigation, and keyboard behavior work outside desktop emulation.
  4. Release build passes Deno format, lint, type-checking, route/security checks, iframe/session/permission enforcement checks, and sensitive log redaction checks.
  5. Deployment readiness documents minimal Deno permissions, CSP/Permissions-Policy, privacy observations, and protections against leaking secrets, signer payloads, session secrets, relay metadata, or napplet usage beyond the stated model.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Secure Mobile Shell & Account Boundary | 0/TBD | Not started | - |
| 2. Backend Nostr Runtime & Napplet Contracts | 0/TBD | Not started | - |
| 3. Sandboxed Napplet Bridge & Minimum NAP APIs | 0/TBD | Not started | - |
| 4. Mobile Diagnostics, Security & Release Readiness | 0/TBD | Not started | - |

## Requirement Coverage

| Requirement | Phase |
|-------------|-------|
| SHELL-01 | Phase 1 |
| SHELL-02 | Phase 1 |
| SHELL-03 | Phase 1 |
| SHELL-04 | Phase 1 |
| SHELL-05 | Phase 1 |
| AUTH-01 | Phase 1 |
| AUTH-02 | Phase 1 |
| AUTH-03 | Phase 1 |
| AUTH-04 | Phase 1 |
| AUTH-05 | Phase 1 |
| AUTH-06 | Phase 1 |
| AUTH-07 | Phase 1 |
| UX-02 | Phase 1 |
| NOSTR-01 | Phase 2 |
| NOSTR-02 | Phase 2 |
| NOSTR-03 | Phase 2 |
| NOSTR-04 | Phase 2 |
| NOSTR-05 | Phase 2 |
| NOSTR-06 | Phase 2 |
| NOSTR-07 | Phase 2 |
| NOSTR-08 | Phase 2 |
| NAPLET-01 | Phase 2 |
| NAPLET-02 | Phase 2 |
| NAPLET-03 | Phase 2 |
| NAPLET-04 | Phase 2 |
| NAPLET-05 | Phase 2 |
| NAPLET-06 | Phase 2 |
| NAPLET-07 | Phase 2 |
| BRIDGE-01 | Phase 3 |
| BRIDGE-02 | Phase 3 |
| BRIDGE-03 | Phase 3 |
| BRIDGE-04 | Phase 3 |
| BRIDGE-05 | Phase 3 |
| BRIDGE-06 | Phase 3 |
| BRIDGE-07 | Phase 3 |
| NAP-01 | Phase 3 |
| NAP-02 | Phase 3 |
| NAP-03 | Phase 3 |
| NAP-04 | Phase 3 |
| NAP-05 | Phase 3 |
| NAP-06 | Phase 3 |
| NAP-07 | Phase 3 |
| NAP-08 | Phase 3 |
| NAP-09 | Phase 3 |
| NAP-10 | Phase 3 |
| NAP-11 | Phase 3 |
| NAP-12 | Phase 3 |
| UX-04 | Phase 3 |
| SEC-03 | Phase 3 |
| UX-01 | Phase 4 |
| UX-03 | Phase 4 |
| UX-05 | Phase 4 |
| UX-06 | Phase 4 |
| SEC-01 | Phase 4 |
| SEC-02 | Phase 4 |
| SEC-04 | Phase 4 |
| SEC-05 | Phase 4 |
| SEC-06 | Phase 4 |
| SEC-07 | Phase 4 |

**Coverage:** 59/59 explicit v1 requirement IDs mapped exactly once. Note: REQUIREMENTS.md previously stated 60 total, but the v1 section contains 59 explicit requirement IDs.
