---
phase: 01-one-day-napplet-runtime-mvp
verified: 2026-07-30T18:07:38Z
status: passed
score: "7/7 must-haves verified"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: "0/7"
  gaps_closed:

    - "Phase 1 MVP roadmap goal now validates as a user story."
  gaps_remaining: []
  regressions: []
human_verification:

  - test: "Package legitimacy approval"
    expected: "Confirm applesauce-accounts@6.2.0, applesauce-core@6.2.0, applesauce-relay@6.2.1, applesauce-signers@6.2.2, @kehto/runtime@0.20.1, @kehto/shell@0.19.1, @kehto/services@0.18.1, @kehto/nip@0.5.1, @napplet/core@0.31.0, @napplet/nap@0.31.0, and nostr-tools@2.24.1 on npm/jsr before trusting the pinned set."
    why_human: "Registry ownership/source legitimacy is a trust judgment; the lockfile and imports prove pins, not package provenance."

  - test: "Supplied napplet identity acceptance"
    expected: "Confirm the Security Lab coordinate/artifact captured in tests/fixtures/supplied_napplet_contract.json is the user's intended supplied napplet."
    why_human: "The code verifies signatures, hashes, and envelopes, but only the operator can confirm this is the intended supplied artifact."

  - test: "Responsive and accessibility shell pass"
    expected: "At 320, 390, 768, and 1440px plus safe-area emulation, Home/Profile/napplet/sign-in states have no horizontal overflow; long napplet names and pubkeys fit; focus, nav, dialog, live-region, and reduced-motion behavior match 01-UI-SPEC.md."
    why_human: "CSS and structural tests cannot fully prove visual layout quality across real viewport/safe-area combinations."

  - test: "Real supplied-napplet runtime acceptance"
    expected: "Using deno task build && deno task start with the supplied napplet, approve real Nostr Connect, bunker, nsec, relay, outbox, publish, reconnect, Back behavior, persistent iframe, retry notice, and mobile shell flows."
    why_human: "Automated tests exercise the fixture and state transitions, but real browser/device signer, relay, reconnect, and visual acceptance require operator judgment."
---

# Phase 1: Napplet Runtime MVP Verification Report

**Phase Goal:** As a mobile napplet user, I want to sign in, open the supplied verified sandboxed napplet in the mobile shell, and use the complete locked backend-proxied stream-first runtime seam, so that a mobile browser can run the napplet while the Deno server runtime owns the heavy Nostr work; the sign-in -> supplied napplet -> initial-plus-updating stream tracer is the one-day-targeted first checkpoint, while full completion has no one-day deadline (D-47).
**Verified:** 2026-07-30T18:07:38Z
**Status:** human_needed
**Re-verification:** Yes - previous blocker was the invalid MVP goal shape; the repaired goal passes `user-story.validate`.

## User Flow Coverage

User story: "As a mobile napplet user, I want to sign in, open the supplied verified sandboxed napplet in the mobile shell, and use the complete locked backend-proxied stream-first runtime seam, so that a mobile browser can run the napplet while the Deno server runtime owns the heavy Nostr work; the sign-in -> supplied napplet -> initial-plus-updating stream tracer is the one-day-targeted first checkpoint, while full completion has no one-day deadline (D-47)."

| Step | Expected | Evidence | Status |
|---|---|---|---|
| Open mobile shell | Fresh starter is replaced by a mobile shell with configured napplet tile or setup empty state. | `routes/index.tsx` renders `NappletShell`; `components/HomeView.tsx` has sign-in/configured/empty states; `tests/end_to_end_test.ts` verifies starter removal. | VERIFIED |
| Sign in | User can use Nostr Connect QR/link, bunker URI, or nsec dev mode; browser receives only safe public state. | `routes/signin.tsx`, `islands/SignInFlow.tsx`, `routes/api/signin/*`, `runtime/signer_service.ts`, `runtime/accounts.ts`; covered by `tests/accounts_test.ts`, `tests/signer_service_test.ts`, and `tests/shell_architecture_test.ts`. | VERIFIED |
| Open supplied sandboxed napplet | Verified artifact is mounted in a persistent opaque iframe with `sandbox="allow-scripts"`. | `components/NappletFrame.tsx` sets exact sandbox and registers identity before `srcdoc`; `runtime/artifacts.ts` verifies via `@kehto/nip`; fixture identity is in `tests/fixtures/supplied_napplet_contract.json`; tests pass. | VERIFIED |
| Complete shell/runtime handshake | Source-bound `shell.ready` produces exactly one `shell.init`; unknown/foreign messages are ignored. | `components/NappletFrame.tsx` and `runtime/portal_runtime.ts`; exercised by `tests/iframe_bridge_test.ts`, `tests/tracer_end_to_end_test.ts`, and `tests/end_to_end_test.ts`. | VERIFIED |
| Use backend-proxied stream seam | Napplet messages cross WebSocket ownership, receive correlated success/error responses, and get initial plus later stream updates. | `routes/api/runtime.ts`, `runtime/transport.ts`, `runtime/connections.ts`, `runtime/relay_adapter.ts`; exercised by `tests/runtime_contract_test.ts`, `tests/websocket_session_test.ts`, `tests/relay_stream_test.ts`, and end-to-end tracer tests. | VERIFIED |
| Outcome | A mobile browser can run the napplet while Deno owns signer, relay, stream, artifact, and account runtime work. | `main.ts` creates process-owned runtime/signer services; `utils.ts` exposes only browser-safe handles; islands import no backend authority modules; `deno task check` and 55 tests pass. | HUMAN NEEDED for final real-device/supplied-napplet acceptance |

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | User can open a non-starter Fresh shell on mobile, sign in with NIP-46 bunker URI, Nostr Connect QR/handoff, or isolated `nsec` dev mode, and see active account/pubkey state. | VERIFIED | `routes/signin.tsx`, `islands/SignInFlow.tsx`, `routes/api/signin/bunker.ts`, `connect.ts`, `nsec.ts`, `status.ts`; `tests/accounts_test.ts` proves all sign-in paths and safe identity projection; `tests/shell_architecture_test.ts` verifies approved copy and shell structure. |
| 2 | User can launch one known/test napplet in a sandboxed iframe using pinned npm packages aligned with reference-only contracts, or a minimal compatible iframe adapter where necessary. | VERIFIED | `deno.json` pins `@napplet/core@0.31.0` and `@napplet/nap@0.31.0`; `components/NappletFrame.tsx` uses exact `sandbox="allow-scripts"`; `tests/tracer_end_to_end_test.ts` and `tests/end_to_end_test.ts` verify supplied Security Lab mount. |
| 3 | Napplet can complete a minimal shell/runtime handshake, send correlated messages to the backend, and receive typed success/error responses without direct relay, signer, storage, or server access. | VERIFIED | `createIframeBridge()` and `decodeClientMessage()` enforce source/owner checks; `routes/api/runtime.ts` forwards only owned messages; tests cover shell init once, ownership rejection, origin rejection, and canonical envelopes. |
| 4 | Backend exposes at least one napplet-facing identity or Nostr-derived stream that can emit partial/empty/updating values without waiting for all relay data to finish loading. | VERIFIED | `runtime/relay_adapter.ts` merges cached values with live observable events and emits one nonterminal EOSE; `tests/relay_stream_test.ts` verifies stored-first value, EOSE, and later live tail. |
| 5 | Runtime code follows pragmatic Applesauce/RxJS stream composition: avoid nested subscriptions, avoid blocking on complete data, and reserve `async`/`await` for one-shot setup or commands. | VERIFIED | `runtime/relay_adapter.ts` uses RxJS `merge`, `tap`, and `finalize`; `runtime/outbox.ts` uses observable subscriptions and settlement only for publish commands; grep found no nested `subscribe` pattern in runtime stream code. |
| 6 | MVP leaves an explicit seam for local Nostr relay and local Blossom cache backends so future phases can avoid always refetching napplet events/blobs from public relays and servers. | VERIFIED | `runtime/config.ts` accepts relay and Blossom endpoint lists, including local endpoints; `runtime/artifacts.ts` has `NappletArtifactCache` seam and `InMemoryNappletArtifactCache`; README documents local endpoints as ordinary sources and durable caching as deferred. |
| 7 | `deno task check` passes, and MVP docs clearly mark mocked, incomplete, and deferred behavior. | VERIFIED | `deno task check` passed; `deno task test` passed with 55 tests. `README.md` documents exact NAP boundary, sensitive account storage, unbounded cache, and deliberate deferrals; `tests/docs_test.ts` verifies this coverage. |

**Score:** 7/7 truths verified, 0 present-behavior-unverified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `main.ts`, `utils.ts` | Singleton Fresh/runtime composition and typed browser-safe route state | VERIFIED | `main.ts` creates one app, runtime, account store, and signer service; `utils.ts` exposes typed handles only. |
| `runtime/config.ts` | Immutable, validated startup configuration with endpoint seams | VERIFIED | Defaults, normalization, bind parsing, reconnect window, relay/signer/Blossom lists; covered by `tests/config_test.ts` and `tests/env_test.ts`. |
| `runtime/accounts.ts`, `runtime/account_store.ts`, `runtime/signer_service.ts` | Server-owned account, signer, persistence, restoration, and safe identity projection | VERIFIED | All sign-in paths, persistence, offline restore, sign-out, and cancellation covered by account/signer tests. |
| `runtime/artifacts.ts` | Verified artifact resolver/cache seam | VERIFIED | Uses `@kehto/nip/5d`, merges configured/manifest servers, fail-closed errors, held cache/retry; covered by `tests/artifact_resolver_test.ts`. |
| `runtime/connections.ts`, `runtime/transport.ts` | Owned WebSocket/window/subscription/correlation transport | VERIFIED | Owner IDs, reconnect tokens, grace cleanup, pending correlations; covered by `tests/websocket_session_test.ts` and `tests/runtime_contract_test.ts`. |
| `runtime/relay_adapter.ts`, `runtime/outbox.ts`, `runtime/portal_runtime.ts` | Stream-first RELAY/OUTBOX/identity runtime services | VERIFIED | Store-first/live RELAY, no-EOSE OUTBOX, publish settlement, shared service hub; covered by `tests/relay_stream_test.ts` and `tests/identity_service_test.ts`. |
| `routes/index.tsx`, `routes/signin.tsx`, `routes/api/runtime.ts`, `routes/api/signin/*` | Shell, sign-in, and runtime HTTP/WebSocket routes | VERIFIED | Home shell, sign-in APIs, same-origin runtime socket, auth gate, artifact delivery, runtime forwarding. |
| `islands/NappletShell.tsx`, `islands/SignInFlow.tsx`, `components/NappletFrame.tsx`, `components/HomeView.tsx`, `components/ProfileView.tsx`, `assets/styles.css` | Mobile shell, sign-in UI, persistent iframe, Home/Profile, responsive styling | VERIFIED with human visual acceptance pending | Structural/copy/accessibility tests pass; real-device layout remains in human verification. |
| `README.md` | Operator setup, sensitive-state, exact coverage, deferrals | VERIFIED | `tests/docs_test.ts` passes; docs name env vars, loopback boundary, exact NAP coverage, and deferrals. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `main.ts` | `routes/api/runtime.ts` / `runtime/portal_runtime.ts` | Process singleton imports and request-state injection | VERIFIED | `processRuntime = portalRuntime`; middleware assigns `ctx.state.runtime` and `ctx.state.signer`. |
| `routes/index.tsx` | `islands/NappletShell.tsx` | SSR shell route renders island with configured coordinate | VERIFIED | Root page passes `config.coordinate` into shell. |
| `islands/NappletShell.tsx` | `routes/api/runtime.ts` | Same-origin WebSocket to `/api/runtime` | VERIFIED | Shell opens socket, sends `runtime.start`, forwards iframe messages, and consumes `runtime.artifact`/`runtime.event`. |
| `components/NappletFrame.tsx` | iframe source | `mountVerifiedFrame()` registers source identity before setting `srcdoc` | VERIFIED | `tests/iframe_bridge_test.ts` proves order and source binding. |
| `runtime/portal_runtime.ts` | `runtime/artifacts.ts` | `resolveVerifiedArtifact()` | VERIFIED | Verified artifact bytes are resolved before namespace prelude and iframe delivery. |
| `runtime/portal_runtime.ts` | `runtime/relay_adapter.ts` / `runtime/outbox.ts` | Runtime service hub owns per-window delivery and cleanup | VERIFIED | `RuntimeServiceHub` tests prove shared identity/relay/outbox authority and independent windows. |
| `runtime/outbox.ts` | `runtime/accounts.ts` | Injected identity and `signEvent` authority | VERIFIED | `tests/identity_service_test.ts` proves signer-unavailable publish failure and backend signing before settlement. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `NappletShell` | `profile`, `srcdoc`, `identity` | `/api/runtime` messages from process runtime and signer state | Yes | VERIFIED |
| `NappletFrame` | `srcdoc`, verified identity | `runtime.resolveArtifact()` through `routes/api/runtime.ts` | Yes, verified supplied fixture bytes | VERIFIED |
| `SignInFlow` | QR URI and signer status | `/api/signin/connect` WebSocket, `/api/signin/status`, bunker/nsec POST endpoints | Yes, server-owned signer service projection | VERIFIED |
| `HomeView` / `ProfileView` | configured/sign-in/profile states | `NappletShell` state derived from config and runtime messages | Yes | VERIFIED |
| `relay_adapter` streams | cached/live event stream | injected store query plus relay pool observable | Yes, tested with stored and live events | VERIFIED |
| `outbox` streams | outbox event/publish results | preset + NIP-65 relays, pool observable, backend signer | Yes, tested with live event and settled publish | VERIFIED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Quality gate | `deno task check` | fmt/lint/check succeeded for 53/50 checked files | PASS |
| Full project test gate | `deno task test` | 55 passed, 0 failed | PASS |
| MVP user story validator | `gsd_run query user-story.validate --story "$PHASE_GOAL" --raw` | `valid: true`; role/capability/outcome extracted | PASS |
| Supplied napplet tracer | Included in `deno task test`: `tests/tracer_end_to_end_test.ts` | verified mount, exact handshake, stored event, EOSE, live event | PASS |
| Runtime ownership/reconnect | Included in `deno task test`: `tests/websocket_session_test.ts` | reconnect, owner cleanup, correlation, same-origin rejection passed | PASS |

### Probe Execution

Step 7c: SKIPPED. No `scripts/*/tests/probe-*.sh` files were found, and the phase plans/summaries do not declare runnable probe scripts.

### Requirements Coverage

| Requirement | Source Plan(s) | Status | Evidence |
|---|---|---|---|
| MVP-01 | 01-01, 01-04, 01-06 | SATISFIED | Non-starter shell in `routes/index.tsx`, `HomeView`, `NappletShell`; end-to-end starter-free test. |
| MVP-02 | 01-01, 01-03, 01-04, 01-06 | SATISFIED | Supplied Security Lab fixture, artifact resolver, exact sandboxed iframe, tracer/end-to-end tests. |
| MVP-03 | 01-01, 01-04, 01-06 | SATISFIED | Pinned `@napplet/core@0.31.0` and `@napplet/nap@0.31.0`; canonical NAP 0.31 envelope tests. |
| MVP-04 | 01-01, 01-03, 01-06 | SATISFIED | `/api/runtime`, transport codec, and process runtime receive/route napplet messages. |
| MVP-05 | 01-01, 01-03, 01-06 | SATISFIED | Correlated owner envelopes, typed auth/error paths, no direct relay/signer access from iframe. |
| AUTH-01 | 01-01, 01-02, 01-04 | SATISFIED | `/signin` route and sign-in flow start Nostr sign-in from shell. |
| AUTH-02 | 01-02, 01-04 | SATISFIED | Bunker URI endpoint and UI; `tests/accounts_test.ts` covers bunker activation. |
| AUTH-03 | 01-01, 01-02, 01-04 | SATISFIED | Nostr Connect QR/link flow and signer WebSocket; QR/URI parity tests. |
| AUTH-04 | 01-02, 01-04 | SATISFIED | nsec endpoint and UI; account tests verify private key projection exclusion. |
| AUTH-05 | 01-02 | SATISFIED | Read-only mode is explicitly deferred in `runtime/accounts.ts` and README, per Phase 1 boundary. |
| AUTH-06 | 01-02, 01-04, 01-06 | SATISFIED | Profile and identity projection show active/offline pubkey state; account/signer tests pass. |
| STREAM-01 | 01-01, 01-05, 01-06 | SATISFIED | Stream-first RELAY/OUTBOX implementation and docs; relay tests pass. |
| STREAM-02 | 01-01, 01-05 | SATISFIED | RxJS observable composition in relay/outbox adapters; no nested subscriptions found. |
| STREAM-03 | 01-05 | SATISFIED | `relay_adapter.ts` composes with `merge`/`finalize`; tests prove dedupe/lifecycle behavior. |
| STREAM-04 | 01-01, 01-05 | SATISFIED | Runtime does not wait for stream completeness; publish/setup async paths are command-like. |
| STREAM-05 | 01-01, 01-04, 01-06 | SATISFIED | Shell uses `Waiting for updates` and no blocking loading screen; copy/structure tests pass. |
| STREAM-06 | 01-05 | SATISFIED | First napplet-facing stream returns stored/initial value then later update. |
| STREAM-07 | 01-01, 01-03, 01-05 | SATISFIED | Local relay/Blossom endpoint seams in config/artifacts; reconnect/session tests pass. |
| NAP-01 | 01-01, 01-03, 01-04, 01-06 | SATISFIED | `shell.ready` -> exactly one `shell.init`; source-bound bridge tests. |
| NAP-02 | 01-01, 01-02, 01-04, 01-05, 01-06 | SATISFIED | Identity service broadcasts public active/offline/unavailable account state. |
| NAP-03 | 01-01, 01-05, 01-06 | SATISFIED | Backend-proxied RELAY and OUTBOX streams covered by relay/identity tests. |
| NAP-04 | 01-01, 01-03, 01-05, 01-06 | SATISFIED | Unsupported/invalid runtime messages fail closed or are ignored; recognized error paths are typed. |
| QUAL-01 | 01-01, 01-04, 01-06 | SATISFIED | Islands contain UI/transport only; tests forbid backend authority imports. |
| QUAL-02 | 01-01, 01-02, 01-03, 01-04, 01-05, 01-06 | SATISFIED | Signers, account store, relay adapters, and event stores remain backend-side; tests check secret-free transport/projection. |
| QUAL-03 | 01-01, 01-06 | SATISFIED AUTOMATED; HUMAN ACCEPTANCE PENDING | `deno task check` and `deno task test` pass; final real-device supplied-napplet UAT remains human-needed. |
| QUAL-04 | 01-06 | SATISFIED | README marks exact delivered/deferred scope; `tests/docs_test.ts` passes. Note: `.planning/REQUIREMENTS.md` still lists QUAL-04 as pending, but code/docs now satisfy it. |

No orphaned Phase 1 requirements were found. The 26 requirement IDs listed by the user, ROADMAP Phase 1, and PLAN frontmatter are all accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| None | - | No unresolved `TBD`, `FIXME`, or `XXX` markers in changed application/test files | - | No blocker debt markers found. |
| `routes/api/runtime.ts` | 143 | "Configured napplet is not available in this tracer" | INFO | Runtime error copy for unsupported configured coordinate; not a placeholder because it is an active fail-closed guard. |

### Human Verification Required

#### 1. Package legitimacy approval

**Test:** Confirm each pinned package/version on npm/jsr and approve the set.
**Expected:** No suspicious package substitution or unapproved source/version drift.
**Why human:** Lockfiles prove exact pins, not ecosystem trust.

#### 2. Supplied napplet identity acceptance

**Test:** Confirm the captured Security Lab coordinate/artifact is the user's intended supplied napplet.
**Expected:** `tests/fixtures/supplied_napplet_contract.json` represents the intended supplied artifact, not a substitute.
**Why human:** Cryptographic verification proves artifact integrity, not operator intent.

#### 3. Responsive and accessibility shell pass

**Test:** Inspect the shell at 320, 390, 768, and 1440px plus safe-area emulation.
**Expected:** No horizontal overflow; long names/pubkeys/notices fit; focus/nav/dialog/live-region/reduced-motion behavior matches `01-UI-SPEC.md`.
**Why human:** Visual fit and real viewport behavior cannot be fully proven by grep or unit tests.

#### 4. Real supplied-napplet runtime acceptance

**Test:** Run `deno task build && deno task start` with the supplied napplet and exercise Nostr Connect, bunker, nsec, relay, outbox, publish, reconnect, Back behavior, persistent iframe, retry notices, and mobile shell flows.
**Expected:** The supplied napplet proves the backend-proxied seam and the shell matches the approved design contract.
**Why human:** Automated tests prove fixture-level behavior and state transitions; real browser/device signer and network flows still need operator approval.

### Gaps Summary

No automated blocker gaps were found. The repaired MVP user story validates, all seven roadmap success criteria are supported by substantive and wired code, every Phase 1 requirement ID is accounted for, `deno task check` passes, and `deno task test` passes with 55 tests.

The phase is not marked `passed` because final supplied-napplet/mobile-shell acceptance still requires human verification.

---

_Verified: 2026-07-30T18:07:38Z_
_Verifier: the agent (gsd-verifier)_
