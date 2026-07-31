---
phase: 07-intent-navigation
verified: 2026-07-31T04:55:33Z
status: passed
score: 12/12 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 7: Intent Navigation Verification Report

**Phase Goal:** Napplets can discover and invoke trusted archetype handlers using shell-controlled navigation behavior.
**Verified:** 2026-07-31T04:55:33Z
**Status:** passed
**Re-verification:** No — initial goal-backward verification after the code-review fix pass

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | INT-01 handlers derive only from the active account's current accepted, integrity-verified catalog artifacts. | ✓ VERIFIED | `CatalogService.authoritySnapshot()` is the sole registry input in `runtime/intent.ts`; strict declaration decoding is at the verified manifest boundary. Contract, catalog runtime, registry, production signature, and full-suite tests pass. |
| 2 | Handler selection is deterministic and malformed, superseded, unresolved, or uninstalled declarations have no authority. | ✓ VERIFIED | `runtime/intent.ts` sorts by dTag then accepted manifest event ID and rechecks generation; `tests/intent_registry_test.ts` proves deterministic selection and stale revocation. |
| 3 | Transient catalog errors may retain last-good display but never stale invocation authority. | ✓ VERIFIED | Registry authority and last-good projection are separate; the focused stale-authority test passes. |
| 4 | INT-02 returns exactly one correlated canonical handled, unavailable, denied, or failed outcome. | ✓ VERIFIED | Idempotent settlement in `IntentService`; focused runtime tests cover success, rejection, lifecycle failure, and removed-handler unavailable projection. |
| 5 | Backend policy alone authorizes reuse, new-tab, or stack navigation. | ✓ VERIFIED | Strict internal reserve/authorized/ack codecs route through authenticated runtime ownership; shell mode adapters cannot mint launch authority. Navigation and production tests pass. |
| 6 | Intent payloads are bounded strict JSON and reach an exact verified target only through a private, expiring, single-use ticket. | ✓ VERIFIED | Payload/frame codecs, generation/account/window binding, atomic ticket deletion, expiry, and replay rejection are implemented and exercised in `tests/intent_runtime_test.ts`. |
| 7 | Reuse focuses only an exact same-account, verified-handler identity. | ✓ VERIFIED | `SurfaceStackController.focusReusable()` matches account plus verified identity; the exact-identity test passes. |
| 8 | New-tab reservation opens synchronously, retains its handle, and severs opener before ticket consumption. | ✓ VERIFIED | `PopupReservationController` reserves synchronously; `/intent/reserved` serves a parser-blocking external script whose first statement clears `window.opener`. Popup and response-order tests pass. |
| 9 | Stacked frames retain `sandbox="allow-scripts"`, source ownership, opaque browser history, Back, and Close behavior without remounting unrelated frames. | ✓ VERIFIED | `NappletFrame`, retained `IntentSurface` stack, opaque surface IDs, and source-bound sockets are wired in `NappletShell`; all stack/sandbox/history tests pass. |
| 10 | Production owns one `IntentService` built from the same production `CatalogService`. | ✓ VERIFIED | `main.ts` constructs `processRuntime` with production settings, constructs one catalog service, then calls `processRuntime.configureCatalog(catalogService)`; production singleton test passes. |
| 11 | The production build/start WebSocket path carries handlers, invocation, ticket claim, and correlated settlement. | ✓ VERIFIED | Built-server runtime smoke passes, focused production intent tests pass, and `deno task build` succeeds. |
| 12 | Reconnect, replacement, and teardown do not replay navigation, leak tickets, or preserve stale authority. | ✓ VERIFIED | Reconnect-aware `ConnectionRegistry` sends, generation invalidation, terminal cleanup, and bounded expiring endpoint correlations are wired; reconnect, registry churn, lifecycle, and full-suite tests pass. |

**Score:** 12/12 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `runtime/catalog.ts` | Verified immutable archetype declarations | ✓ VERIFIED | Strict decoder and signature/integrity authority boundary are substantive and consumed by catalog snapshots. |
| `runtime/intent.ts` | Registry, selection, invocation, tickets, canonical results | ✓ VERIFIED | Substantive state machine wired to catalog and transport; focused behavior tests pass. |
| `runtime/transport.ts` | Exact intent/navigation codecs | ✓ VERIFIED | Exact-key command, reservation, authorization, acknowledgement, claim, and reserved-path codecs are used by backend and shell. |
| `runtime/portal_runtime.ts` | Process runtime intent composition | ✓ VERIFIED | Production and fixture resolvers preserve declarations; service hub dispatches queries, reserve, ack, claim, and cleanup. |
| `components/NappletFrame.tsx` | Source-bound sandboxed surface | ✓ VERIFIED | Wired into the shell with exact `allow-scripts` sandbox. |
| `islands/NappletShell.tsx` | Reuse/new-tab/stack execution and history | ✓ VERIFIED | All three modes are wired to runtime reservation/authorization and retained surfaces. |
| `main.ts` | Production-owned catalog and intent composition | ✓ VERIFIED | Production settings, catalog authority, and one configured intent service are wired. |
| `routes/api/runtime.ts` | Authenticated production WebSocket routing | ✓ VERIFIED | Ownership checks, reconnect-aware output, bounded correlations, reserve/invoke/ack/claim routing, and close cleanup are substantive. |
| `routes/intent/reserved.tsx` | Minimal opener-safe reservation response | ✓ VERIFIED | Dedicated response supplies restrictive CSP and loads the external bootstrap before other executable code. |
| `static/intent-reserved.js` | Opener-sever-first ticket bootstrap | ✓ VERIFIED | Clears opener first, erases fragment, claims exact ticket, then mounts an `allow-scripts` iframe. |
| `tests/intent_*.ts*` and reconnect/session tests | Behavioral coverage | ✓ VERIFIED | 32 focused tests and the complete 213-test suite pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `runtime/catalog.ts` | `runtime/intent.ts` | Current verified authority snapshot | ✓ WIRED | Intent registry rebuild consumes accepted ready artifacts and exact verified identities. |
| `runtime/portal_runtime.ts` | `runtime/catalog.ts` | Verified production resolver | ✓ WIRED | Explicit `verifyEvent`, exact identity checks, and frozen declarations precede registry projection. |
| `runtime/intent.ts` | `runtime/transport.ts` | Reserved-path and internal message contracts | ✓ WIRED | Shared constructor/codecs carry reservation ID, invocation ID, target, ticket, and generation. |
| `islands/NappletShell.tsx` | `components/NappletFrame.tsx` | One retained source-bound frame per surface | ✓ WIRED | Reuse/stack surfaces preserve verified identity and exact sandbox. |
| Browser history | Shell stack registry | Opaque surface IDs | ✓ WIRED | Push/pop/close operations use shell-owned IDs and retain unrelated surfaces. |
| `main.ts` | `runtime/portal_runtime.ts` | Production settings plus shared catalog | ✓ WIRED | The production composition root creates the runtime and configures its single intent service. |
| `routes/api/runtime.ts` | Shell/runtime clients | Authenticated reconnect-aware WebSocket | ✓ WIRED | Runtime forwarding validates connection/window ownership and sends through the resumable registry. |
| `routes/intent/reserved.tsx` | `runtime/intent.ts` | External opener-sever bootstrap and ticket claim | ✓ WIRED | Minimal route starts a target runtime window and claims the opaque single-use ticket. |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Produces Real Data | Status |
|---|---|---|---|---|
| Intent registry | Handler candidates | Active account's accepted ready `CatalogService.authoritySnapshot()` artifacts | Yes — exact signed manifests and accepted artifact identities | ✓ FLOWING |
| Invocation result | Canonical correlated outcome | Verified selection → exact catalog launch → shell ack | Yes — original request ID and terminal backend state | ✓ FLOWING |
| Target surface | Payload, identity, srcdoc | Private ticket claim bound to target window and generation | Yes — exact verified launch result; no static fallback | ✓ FLOWING |
| Shell surfaces | Reuse/new-tab/stack state | Backend authorization plus claimed target identity | Yes — retained surface registry and per-surface runtime owner | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Phase 7 focused contracts, runtime, navigation, production, and reconnect behavior | `deno test -A tests/intent_contract_test.ts tests/catalog_runtime_test.ts tests/intent_registry_test.ts tests/intent_runtime_test.ts tests/intent_navigation_test.tsx tests/intent_production_test.ts tests/runtime_reconnect_smoke_test.ts tests/websocket_session_test.ts` | 32 passed, 0 failed | ✓ PASS |
| Full workspace regression suite | `deno task test` | 213 passed, 0 failed | ✓ PASS |
| Format, lint, and type checking | `deno task check` | 111 formatted files, 108 linted files, type checks passed | ✓ PASS |
| Production Fresh build | `deno task build` | Client and SSR builds completed successfully | ✓ PASS |

### Probe Execution

No standalone `probe-*.sh` is declared for Phase 7. The phase's production probe is the built Fresh server smoke in `tests/runtime_reconnect_smoke_test.ts`; it passed in both the focused and full-suite runs.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| INT-01 | 07-01, 07-02, 07-04 | Inspect handlers derived from installed, verified manifest contracts | ✓ SATISFIED | Verified authority snapshot, strict declarations, signature enforcement, registry and production tests. |
| INT-02 | 07-01 through 07-04 | Invoke archetype/action and receive canonical result | ✓ SATISFIED | Deterministic selection, exact launch, single terminal settlement, canonical outcome tests. |
| INT-03 | 07-02 through 07-04 | Reuse/focus, new tab, or stacked iframe with sandbox/history | ✓ SATISFIED | All three shell paths are wired; popup, stack, source, sandbox, history, CSP, and production tests pass. |

No Phase 7 requirement is orphaned.

### Anti-Patterns Found

No unreferenced `TBD`, `FIXME`, or `XXX` debt markers were found in Phase 7 files. Defensive `return null` branches are decoder/ownership rejection paths, not stubs. No placeholder rendering, hardcoded empty dynamic data, or console-only implementation blocks were found.

### Human Verification Required

None for the Phase 7 automated contract. Subjective browser/mobile perception is explicitly residual Phase 9 hardening and is not a missing Phase 7 implementation truth.

### Disconfirmation Pass

- Partial-requirement search: the earlier review's disconnected reuse/stack path is now wired through inline reservations, ticket claim, exact identity focus/push, acknowledgement, and cleanup.
- Misleading-test search: production authorization now shares `createReservedIntentLaunchPath` with the shell validator; tests no longer substitute the incompatible `/napplet?...` path that masked the original defect.
- Uncovered-error-path search: blocked/stale popup, invalid signature, removed handler, unmatched/duplicate/expired correlation, foreign ownership, reconnect rebinding, account/generation revocation, and ticket replay paths all have executable coverage.

### Gaps Summary

No blocking gaps or warnings remain. All roadmap criteria and INT-01 through INT-03 are implemented, wired through production, and behaviorally exercised.

---

_Verified: 2026-07-31T04:55:33Z_
_Verifier: the agent (gsd-verifier)_
