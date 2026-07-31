---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Runtime & UX Expansion
current_phase: 7
current_phase_name: Intent Navigation
status: verifying
stopped_at: "09-08 gaps found: media browser artifact fixture"
last_updated: "2026-07-31T07:34:29.424Z"
last_activity: 2026-07-31
last_activity_desc: Completed Phase 7 production intent navigation integration
progress:
  total_phases: 7
  completed_phases: 6
  total_plans: 32
  completed_plans: 31
  percent: 86
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-30)

**Core value:** A napplet can run in a mobile browser while a server-side Deno runtime handles the heavy Nostr/runtime work.
**Current focus:** Phase 7 — Intent Navigation

## Current Position

Phase: 7 — Intent Navigation
Plan: 4 of 4 complete
Status: Phase complete — ready for verification
Last activity: 2026-07-31 — Completed Phase 7 production intent navigation integration

## Performance Metrics

**Velocity:**

- Total plans completed: 9
- Average duration: N/A
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. One-Day Napplet Runtime MVP | 6/6 | 99min | 17min |
| 2. Backend Runtime Expansion | 1/7 | 6min | 6min |
| 3. NAP Coverage, Policy, and Production Hardening | 0/TBD | - | - |
| 3 | 5 | - | - |
| 4 | 4 | - | - |

**Recent Trend:**

- Last 5 plans: none
- Trend: N/A

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 18min | 3 tasks | 32 files |
| Phase 01 P02 | 5min | 2 tasks | 4 files |
| Phase 01 P03 | 6min | 2 tasks | 6 files |
| Phase 01 P04 | 8min | 2 tasks | 12 files |
| Phase 01 P05 | 7min | 2 tasks | 5 files |
| Phase 01 P06 | 55min | 3 tasks | 18 files |
| Phase 02 P01 | 6min | 2 tasks | 8 files |
| Phase 02 P02 | 5min | 2 tasks | 7 files |
| Phase 02 P03 | 3min | 1 tasks | 5 files |
| Phase 02 P04 | 10min | 1 tasks | 5 files |
| Phase 02 P05 | 4min | 1 tasks | 12 files |
| Phase 02 P06 | 13min | 2 tasks | 10 files |
| Phase 02 P07 | 6min | 2 tasks | 9 files |
| Phase 03 P01 | 12min | 2 tasks | 12 files |
| Phase 03 P02 | 10min | 2 tasks | 9 files |
| Phase 03 P03 | 8min | 2 tasks | 6 files |
| Phase 03 P04 | 6min | 3 tasks | 6 files |
| Phase 03 P05 | 3min | 2 tasks | 6 files |
| Phase 04 P01 | 14min | 2 tasks | 4 files |
| Phase 04 P02 | 7min | 2 tasks | 5 files |
| Phase 04 P03 | 12min | 2 tasks | 7 files |
| Phase 04 P04 | 16min | 2 tasks | 5 files |
| Phase 05 P01 | 14min | 2 tasks | 5 files |
| Phase 05 P02 | 11min | 2 tasks | 7 files |
| Phase 05 P04 | 14min | 2 tasks | 11 files |
| Phase 06 P01 | 16min | 1 tasks | 7 files |
| Phase 06 P02 | 5min | 2 tasks | 7 files |
| Phase 06 P03 | 10min | 3 tasks | 8 files |
| Phase 07 P04 | 14min | 3 tasks | 12 files |
| Phase 08-cross-tab-media-sessions P01 | 7min | 2 tasks | 7 files |
| Phase 08-cross-tab-media-sessions P02 | 7min | 2 tasks | 8 files |
| Phase 08-cross-tab-media-sessions P03 | 35min | 2 tasks | 5 files |
| Phase 09-runtime-expansion-hardening P02 | 6min | 2 tasks | 5 files |
| Phase 09-runtime-expansion-hardening P03 | 8min | 2 tasks | 6 files |
| Phase 09-runtime-expansion-hardening P04 | 10min | 2 tasks | 4 files |
| Phase 09-runtime-expansion-hardening P05 | 14min | 2 tasks | 8 files |
| Phase 09-runtime-expansion-hardening P06 | 7min | 2 tasks | 4 files |
| Phase 09-runtime-expansion-hardening P08 | 92min | 2 tasks | 11 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table. Recent decisions affecting current work:

- [MVP Scope]: The first Phase 1 checkpoint targets one day and proves sign-in, verified sandboxed napplet launch, and initial-plus-live backend stream data; full Phase 1 completion has no one-day deadline.
- [MVP Scope]: Phase 1 retains every locked decision D-01 through D-47 and implements SHELL, IDENTITY, RELAY, and OUTBOX without pulling deferred NAP domains into scope.
- [Sign-in]: Nostr Connect QR/URI is primary; bunker URI and nsec are secondary, with nsec labeled `Not recommended` rather than developer-only.
- [Runtime Style]: Applesauce/RxJS usage should be stream-first, avoid nested subscriptions, and avoid UI flows that wait for Nostr data to be complete.
- [Cache Backends]: Runtime should support local Nostr relays and local Blossom servers so napplet events/blobs can be cached locally instead of always loading from public relays/servers.
- [Roadmap]: Future phases expand backend Nostr runtime, Kehto/napplet contracts, NAP API breadth, policy, diagnostics, and production hardening.
- [Phase 1]: Production imports use pinned npm packages; sibling packages remain reference-only.
- [Phase 1]: Verify manifest signature, aggregate, and Blossom bytes before srcdoc injection.
- [Phase 1]: Process-owned signer and relay services survive transient browser sessions.
- [Phase 1]: Reconnect preserves connection-owned windows and logical subscriptions through grace.
- [Phase 1]: RELAY and OUTBOX use composed streams with centralized dedupe and complete required publish settlement.
- [Phase 02]: Use the human-approved exact npm:applesauce-loaders@6.2.0 production import. — Package legitimacy was explicitly confirmed before installation.
- [Phase 02]: Persist endpoint settings in one versioned atomic JSON snapshot with one BehaviorSubject-backed source. — Keeps backend authority reactive without introducing a second database technology.
- [Phase 02]: Use one process-owned EventStore, RelayPool, and unified loader lifecycle. — Applesauce owns event semantics and deterministic teardown without duplicated runtime state.
- [Phase ?]: Canonical relay equality is evaluated before precedence, blocking, deduplication, or AUTH permission.
- [Phase ?]: The local relay request is an internal cache boundary; only upstream EOSE is emitted to callers.
- [Phase ?]: Cache write settlement updates sanitized health asynchronously and never gates upstream event delivery.
- [Phase ?]: Local Blossom discovery is fixed to loopback and bounded; configured HTTP(S) endpoints contribute only upstream proxy hints.
- [Phase ?]: Cached executable bytes remain untrusted until existing signature, aggregate, and blob hash verification succeeds.
- [Phase ?]: Public catalog content is an exact versioned codec containing only coordinate and accepted manifest event ID.
- [Phase ?]: Catalog mutations serialize, re-read the latest active-account replacement, and advance locally only after complete required-relay acceptance.
- [Phase ?]: Launch identity is projected only after the exact accepted manifest event ID crosses the verified artifact boundary.
- [Phase ?]: [Phase 02]: Extend version-1 runtime settings snapshots additively so existing persisted state remains valid.
- [Phase ?]: [Phase 02]: Keep server-rendered settings inside a shell-owned history view so the napplet frame stays mounted.
- [Phase ?]: [Phase 02]: Project relay and Blossom cache health independently without gating settings or launch.
- [Phase ?]: Accepted manifest event IDs remain the only launch authority; unresolved entries cannot launch.
- [Phase ?]: Catalog projections emit from one process-owned CatalogService after verified loads or fully accepted mutations.
- [Phase ?]: Native catalog dialogs invalidate on replacement event identity and return focus to the invoking card.
- [Phase ?]: Pinned @kehto/runtime 0.20.1 and @napplet/core/@napplet/nap 0.31.0 remain the sole executable contract authority.
- [Phase ?]: Sibling source availability and marker mismatch are serialized as non-blocking diagnostic evidence.
- [Phase ?]: Reset connection failures only after a validated runtime artifact proves readiness.
- [Phase ?]: Keep signer identity independent from backend transport recovery.
- [Phase ?]: Use validated PORTAL_PORT binding for isolated production transport tests.
- [Phase ?]: [Phase 03]: Account navigation is a shell-owned sheet that preserves one verified napplet frame.
- [Phase ?]: [Phase 03]: Sign-out revokes backend authority before one canonical empty-pubkey identity.changed delivery.
- [Phase ?]: [Phase 03]: Signer and backend transport truth remain independently projected.
- [Phase ?]: [Phase 03]: Theme persistence is browser-local, closed to system/light/dark, and safely defaults to System.
- [Phase ?]: [Phase 03]: One stable pre-paint script owns document theme and browser theme-color without crossing the napplet boundary.
- [Phase ?]: [Phase 03]: Resolve every shell color through one closed semantic token vocabulary under html[data-theme], without adding component theme state.
- [Phase ?]: [Phase 03]: Leave routes/_app.tsx as the sole owner of browser theme-color metadata.
- [Phase ?]: [Phase 03]: Stable geometry identifiers mechanically link the ready PortalMark to the static SVG asset.
- [Phase ?]: [Phase 03]: The canonical square SVG is the sole favicon; the stale Fresh ICO fallback is removed.
- [Phase ?]: [Phase 04]: Accepted membership projects immediately while four-worker exact-key enrichment remains generation-checked.
- [Phase ?]: [Phase 04]: Install approval is source-catalog-bound and launch releases bytes only for the latest exact accepted triple.
- [Phase ?]: [Phase 04]: Load preview manifests by coordinate, but require exact accepted event IDs for approval and launch verification.
- [Phase ?]: [Phase 04]: One generation-guarded owner replaces catalog subscriptions on account, settings, and reconnect signals while preserving last-good truth on transient errors.
- [Phase ?]: [Phase 04]: Catalog projections contain display metadata only; executable bytes cross the WebSocket solely in a correlated successful launch result.
- [Phase ?]: [Phase 04]: Every socket generation uses a bounded 32-entry command registry settled on result, timeout, replacement, closure, or teardown.
- [Phase ?]: [Phase 04]: Catalog status travels independently from optional projection data so transient errors preserve last-good cards.
- [Phase ?]: [Phase 04]: Keep the raw catalog query in the shell and derive visible entries synchronously without transport work.
- [Phase ?]: [Phase 04]: Bind immutable install review to its source catalog generation and clear input only after accepted approval.
- [Phase ?]: [Phase 05]: Bind binary frames to authenticated socket ownership supplied out of band; never trust owner identifiers from frame bytes.
- [Phase ?]: [Phase 05]: Generate canonical RESOURCE and UPLOAD inspection envelopes from one immutable backend transfer policy snapshot.
- [Phase ?]: [Phase 05]: Authorize only the exact 127.0.0.1 cache origin as a separate destination class.
- [Phase ?]: [Phase 05]: Release resource bytes only after streamed size, observed MIME, and SHA-256 policy succeeds.
- [Phase ?]: [Phase 05]: Bind transfer authority to connection, window, verified napplet identity, and active account.
- [Phase ?]: [Phase 05]: Preserve transfer work through reconnect grace and abort only on authority invalidation or shutdown.
- [Phase ?]: [Phase 06]: Mint window capability authority only from a successful backend CatalogService.launch result.
- [Phase ?]: [Phase 06]: Treat omitted storage scope as shared and derive instance scope solely from the backend-issued instanceId.
- [Phase ?]: [Phase 06]: Encode storage authority as one opaque tuple containing account, exact manifest and artifact identity, canonical scope, and backend instance identity only for instance scope.
- [Phase ?]: [Phase 06]: Count UTF-8 key plus value bytes across shared and every instance namespace for the 512 KiB account/exact-manifest budget.
- [Phase ?]: [Phase 06]: Return shared EventStore truth before bounded COMMON profile/contact refresh work.
- [Phase ?]: [Phase 06]: Route COMMON mutations through PortalAccounts and one required-relay OutboxAdapter.
- [Phase ?]: Expose the IntentService created from the production CatalogService as the single process-owned intent authority.
- [Phase ?]: Bind fresh target WebSockets to backend-issued targetWindowIds and release verified launch bytes only after an exact single-use claim.
- [Phase ?]: Erase ticket fragments after opener severing and retain the exact allow-scripts-only iframe sandbox.
- [Phase ?]: [Phase 08]: Keep canonical media envelopes free of portal generation and owner identity; carry both only in coordinator projections and effects.
- [Phase ?]: [Phase 08]: Commit media authority before ordered delivery and convert current-owner delivery failure into immediate owner loss.
- [Phase ?]: [Phase 08]: Keep portal media controls top-level and canonical MEDIA confined to runtime.forward/runtime.event.
- [Phase ?]: [Phase 08]: Fence socket detach with attachment generations so stale closes cannot revoke resumed successors.
- [Phase ?]: [Phase 08]: Keep socket/account epoch and media generation exclusively in the shell controller while iframe messages remain canonical.
- [Phase ?]: [Phase 08]: Treat play promise fulfillment and rejection as the only source of browser playback truth.
- [Phase ?]: [Phase 09]: Binary transfer correlations bind to authenticated connection, window, and attachment generation.
- [Phase ?]: [Phase 09]: Runtime forward envelopes are closed and resource batches must be non-empty.
- [Phase ?]: [Phase 09]: Preserve exact manifest action grants; only explicit whole-domain grants authorize sibling actions.
- [Phase ?]: [Phase 09]: Revalidate active account and accepted catalog identity before async launch, signer, publication, and commit effects.
- [Phase ?]: [Phase 09]: Revalidate STORAGE authority inside the serialized owner and immediately before atomic rename.
- [Phase ?]: [Phase 09]: Leave QLT ledger completion to Plan 09-09 final reconciliation.
- [Phase ?]: [Phase 09]: Apply one immutable browser policy after Fresh request handling so shell and runtime responses share fail-closed headers.
- [Phase ?]: [Phase 09]: Admit iframe messages only from the current WindowProxy with opaque srcdoc origin, then recheck exact recipient authority before delivery.
- [Phase ?]: [Phase 09]: Terminalize successful intent navigation only after both caller commit and exact single-use target claim.
- [Phase ?]: [Phase 09]: Recheck process-owned attachment generation before runtime dispatch and after signer/artifact awaits.
- [Phase ?]: [Phase 09]: Leave QLT ledger completion to Plan 09-09 final reconciliation.

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2+] Catalog breadth, multi-user authentication, approval UX, durable cache policy, and NAP domains beyond SHELL, IDENTITY, RELAY, and OUTBOX remain deferred.
- [Phase 2] Fresh 2.3/Vite middleware cannot exercise WebSocket upgrades under `deno task dev`; use the production build/start path for runtime transport checks.
- Plan 09-08: two-page Chromium media row blocked because production verified artifact resolves blob-unavailable; close before QLT-04 reconciliation

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260730-par | Fix napplet iframe element not filling the available height | 2026-07-30 | 3000f4d | [260730-par-fix-napplet-iframe-element-not-filling-t](./quick/260730-par-fix-napplet-iframe-element-not-filling-t/) |
| 260730-phe | Restore Applesauce active account into signer runtime on startup | 2026-07-30 | 0fe5bd1 | [260730-phe-restore-applesauce-active-account-into-s](./quick/260730-phe-restore-applesauce-active-account-into-s/) |
| 260730-pcm | Shorten RELAY and OUTBOX behavior reasons in Phase 01 COVERAGE.md to satisfy the verify-work preflight gate, then rerun Phase 01 verification | 2026-07-30 | 1f54bd0 | [260730-pcm-shorten-relay-and-outbox-behavior-reason](./quick/260730-pcm-shorten-relay-and-outbox-behavior-reason/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Runtime | Full Applesauce event persistence, relay sync, relay settings, Blossom settings, local relay cache, local Blossom blob cache | Deferred to Phase 2 | MVP scope alignment |
| NAP APIs | Full NAP-RELAY, NAP-STORAGE, NAP-RESOURCE, NAP-INTENT, NAP-THEME, NAP-NOTIFY, approvals | Deferred to Phase 3 | MVP scope alignment |
| Security | Production hardening, CSP/Permissions-Policy audit, full security tests | Deferred to Phase 3 | MVP scope alignment |

## Session Continuity

Last session: 2026-07-31T07:34:29.408Z
Stopped at: 09-08 gaps found: media browser artifact fixture
Resume file: .planning/phases/09-runtime-expansion-hardening/09-08-SUMMARY.md
