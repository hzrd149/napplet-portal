# Roadmap: Napplet Portal v1.1

## Overview

Milestone v1.1 expands the proven backend runtime into a resilient mobile napplet platform. Work continues at Phase 3 and orders shared shell, catalog, transport-policy, state, and orchestration foundations before cross-tab media and final integrated hardening.

## Phases

- [x] **Phase 3: Mobile Shell Resilience** — Polish the shell and make runtime connectivity legible and recoverable on mobile. (completed 2026-07-31)
- [ ] **Phase 4: Installed Napplet Discovery** — Install, synchronize, search, and launch trusted napplets from the home catalog.
- [ ] **Phase 5: Resource and Blossom Transfer** — Add bounded resource resolution and explicit multi-server uploads.
- [ ] **Phase 6: Common Data and Durable Storage** — Expose stream-oriented common Nostr helpers and isolated persistent napplet state.
- [ ] **Phase 7: Intent Navigation** — Route declared intents to trusted installed handlers across shell surfaces.
- [ ] **Phase 8: Cross-Tab Media Sessions** — Coordinate one ownership-aware media session across mobile browser tabs.
- [ ] **Phase 9: Runtime Expansion Hardening** — Verify contract parity, security boundaries, failure behavior, and real-device flows end to end.

## Phase Details

### Phase 3: Mobile Shell Resilience

**Goal:** Users can understand and recover the mobile shell's backend connection while using coherent portal navigation and branding.
**Requirements:** SHL-01, SHL-02, SHL-03, CON-01, CON-02, CON-03, CON-04
**Plans:** 5/5 plans complete

- [x] 03-01-PLAN.md
- [x] 03-02-PLAN.md
- [x] 03-03-PLAN.md
- [x] 03-04-PLAN.md
- [x] 03-05-PLAN.md

**Success Criteria:**

1. Theme, branding, and account/navigation chrome remain consistent across home and napplet views.
2. Connection, bootstrapping, ready, retry, and failure produce truthful accessible states with reduced-motion support.
3. A suspended or disconnected mobile tab reconnects with capped jittered backoff through the existing token/grace boundary.
4. Offline, hidden, repeatedly failing, or intentionally closed tabs do not create duplicate sockets or retry storms.

### Phase 4: Installed Napplet Discovery

**Goal:** Users can build and navigate a trusted installed-napplet catalog from the portal home page.
**Requirements:** CAT-01, CAT-02, CAT-03, CAT-04
**Plans:** 3/4 plans executed

Plans:

- [x] 04-01-PLAN.md — Establish partial catalog truth, stale-bound install approval, and exact launch authority.
- [x] 04-02-PLAN.md — Construct arbitrary-coordinate production resolution and catalog synchronization lifecycle.
- [x] 04-03-PLAN.md — Carry install, synchronization, and launch safely across the runtime WebSocket.
- [ ] 04-04-PLAN.md — Complete accessible mobile install, partial catalog, local search, and API coverage UX.

**Success Criteria:**

1. A user can submit a valid `naddr`, review its verified manifest, approve installation, and see it appear without reloading.
2. Empty, loading, partial, stale, and failed synchronization remain usable and visibly distinct.
3. Search filters installed napplets by meaningful metadata while synchronization continues.
4. Launch uses the accepted manifest event identity and rejects unresolved or superseded entries.

### Phase 5: Resource and Blossom Transfer

**Goal:** Napplets can resolve bounded resources and upload blobs through backend-owned Blossom policy.
**Requirements:** RES-01, RES-02, RES-03, UPL-01, UPL-02, UPL-03

**Success Criteria:**

1. A napplet can inspect RESOURCE/UPLOAD availability and limits through pinned contract envelopes.
2. HTTP(S), Blossom, and BUD-10 reads enforce scheme, redirect, destination, MIME, size, timeout, and integrity policy.
3. Blossom reads try configured local cache endpoints before upstream sources without trusting cached executable bytes prematurely.
4. Uploads use the reviewed pinned SDK and return explicit required-success, partial-failure, and optional-local-copy outcomes.

### Phase 6: Common Data and Durable Storage

**Goal:** Napplets can use common Nostr helpers and durable isolated key-value state without taking backend authority into the browser.
**Requirements:** COM-01, COM-02, STO-01, STO-02, STO-03

**Success Criteria:**

1. A napplet can use canonical NIP-19 and common helper actions through NAP-COMMON.
2. Other-user profile/common data appears as partial and updating Applesauce-backed projections.
3. A napplet can set, get, list, and remove values in shared and supported per-instance scopes.
4. Storage survives reconnects/restarts and remains isolated by account and verified napplet identity with enforced quotas.

### Phase 7: Intent Navigation

**Goal:** Napplets can discover and invoke trusted archetype handlers using shell-controlled navigation behavior.
**Requirements:** INT-01, INT-02, INT-03

**Success Criteria:**

1. Available handlers derive only from installed verified manifest contracts.
2. Intent invocation returns canonical handled, unavailable, denied, and failed results.
3. Shell policy can focus/reuse, open a new tab, or stack an iframe without breaking sandbox, history, or runtime state.

### Phase 8: Cross-Tab Media Sessions

**Goal:** Napplets can participate in one backend-coordinated media session with deterministic playback ownership across tabs.
**Requirements:** MED-01, MED-02, MED-03, MED-04

**Success Criteria:**

1. A napplet can create and control an ownership-aware session through canonical NAP-MEDIA messages.
2. Starting or transferring playback selects exactly one active owner and stops the prior owner deterministically.
3. Every connected tab reflects current media state and can transfer or stop it from shell navigation.
4. Origin closure ends its session, and generation checks prevent stale tabs from reclaiming ownership.

### Phase 9: Runtime Expansion Hardening

**Goal:** The full v1.1 expansion is contract-compatible, secure at every proxy boundary, and verified on mobile devices.
**Requirements:** QLT-01, QLT-02, QLT-03, QLT-04

**Success Criteria:**

1. Contract and dispatcher tests demonstrate parity with every pinned NAP domain used by v1.1.
2. Adversarial tests cannot bypass URL policy, capabilities, storage isolation, signer separation, catalog authority, or sandboxing.
3. Automated coverage exercises normal, empty, partial, denied, stale, reconnect, and failure paths and `deno task check` passes.
4. Real-device UAT validates themes, navigation, reconnect recovery, intent surfaces, and cross-tab media ownership.

## Coverage

- v1.1 requirements: 33
- Mapped exactly once: 33
- Unmapped: 0

---
*Roadmap created: 2026-07-30 for milestone v1.1*
