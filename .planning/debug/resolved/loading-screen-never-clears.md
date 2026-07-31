---
status: resolved
trigger: "Investigate why the main loading screen never disappears, even after I connect a signer. The status draw is stuck in the status message saying the napplet is being verified. This could mean either it is not being loaded or there is no default one to load now that we have the installed list."
created: 2026-07-31
updated: 2026-07-31T00:45:00Z
---

# Debug Session: Loading Screen Never Clears

## Symptoms

- **Expected:** After a signer connects, the portal should either load a configured/default or installed napplet and leave the verification loading state, or clearly show that no napplet is selected/available.
- **Actual:** The main loading overlay remains indefinitely and the status drawer says the napplet is being verified.
- **Errors:** No explicit error message reported.
- **Timeline:** Observed after the installed-napplet catalog/default-loading changes; whether it worked earlier is not yet established.
- **Reproduction:** Start the portal, connect a signer, and observe that the main loading screen and verification status never clear.

## Current Focus

- **bug_class:** bohrbug
- **hypothesis:** Confirmed: production artifact resolution fails because the configured fixture blob is unavailable, the backend emits `runtime.signer.error`, and the connection controller ignores that terminal error while remaining in `bootstrapping`. Separate projection defects explain the misleading signed-out drawer and sign-in bounce.
- **test:** Production build/start plus a real Chromium trace of Home and `/signin` WebSocket frames.
- **expecting:** Confirmed by observed `runtime.signer.error`, persistent ritual, `signer.active` redirect, and backend artifact resolver logs.
- **next_action:** Resolved; regression tests, full quality gates, build, and revert-and-reconfirm all passed.
- **reasoning_checkpoint:**
  hypothesis: The loading ritual remains forever when artifact resolution fails because `ConnectionController` enters bootstrapping before `runtime.start` but recognizes only `runtime.artifact` as terminal; it ignores `runtime.signer.error`.
  confirming_evidence:
    - Chromium received `runtime.signer.error` after `runtime.start`, while the DOM still showed "The napplet is being verified" three seconds later.
    - Backend logs show artifact resolution failed with `blob unavailable`, and no `runtime.artifact` was emitted.
  falsification_test: Receipt of `runtime.signer.error` causing the controller to leave bootstrapping or hide the ritual would disprove the code-path claim; the observed controller and DOM did neither.
  fix_rationale: Marking runtime terminal messages failed ends the false bootstrapping state while preserving manual retry; projecting only truly active identities prevents false sign-in success; replaying identity in the socket-open seam ensures the already-open transport receives the initial snapshot.
  blind_spots: The external reason each configured Blossom source lacked the blob was not decomposed beyond the resolver's deterministic `blob unavailable` result.
  candidate_causes:
    - code: ConnectionController handles `runtime.artifact` but not `runtime.signer.error`, `runtime.error`, or `runtime.auth.required`; initial identity is also emitted before WebSocket open and can be lost.
    - environment/data: The configured verified artifact blob is unavailable from the configured Blossom sources in the reproduced production environment.
    - config: NAPPLET_COORDINATE is present and matches the fixture, eliminating missing/default selection.
  and_gate: yes — indefinite verifying requires launch failure (here blob unavailable) AND the client failing to transition out of bootstrapping on the backend's terminal error.
- **tdd_checkpoint:**

## Evidence

- timestamp: 2026-07-31T00:01:00Z
  checked: Reporter-visible account and navigation state
  found: Account drawer simultaneously reports "No account is connected", "Signed out", "No signer", and "Backend disconnected"; opening sign-in immediately redirects to Home.
  implication: The failure boundary may precede catalog/default selection: route guarding appears to believe an account session exists while the shell/runtime projection reports none, or navigation is being redirected for a reason other than authenticated state.

- timestamp: 2026-07-31T00:02:00Z
  checked: routes/signin.tsx and islands/SignInFlow.tsx
  found: The server route has no authentication redirect. On mount the island always opens `/api/signin/connect`, sends `signer.start`, and redirects to `/` only when that socket emits `signer.active`; the parallel `/api/signin/status` fetch never redirects.
  implication: The immediate return Home is positive evidence that the server-owned signer connection service reports an active identity, not a Fresh route guard.

- timestamp: 2026-07-31T00:03:00Z
  checked: islands/NappletShell.tsx initial state and ritual rendering
  found: `ritualVisible` initializes from `Boolean(coordinate)`, the overlay renders whenever it is true and `srcdoc` is empty, and the account profile remains null until a runtime `identity.changed` message arrives. The overlay disappears only after the connection controller reaches `ready`.
  implication: With any configured coordinate, absent runtime transport/projection can independently produce the reported overlay and signed-out/disconnected drawer before catalog or iframe launch code runs.

- timestamp: 2026-07-31T00:04:00Z
  checked: shell/connection.ts and routes/api/runtime.ts
  found: The exact status copy "The napplet is being verified" corresponds to controller phase `bootstrapping`, entered immediately after receipt of `runtime.connected` and immediately before sending `runtime.start`. The backend then restores the signer and either sends `runtime.auth.required`, `runtime.error`, or a `runtime.artifact`; only `runtime.artifact` moves the controller to `ready`.
  implication: The runtime WebSocket is connected (so "Backend disconnected" means "not artifact-ready", not literal transport disconnection), but the controller has no terminal transition for `runtime.auth.required` or `runtime.error`. The reported state can therefore persist after an auth/config rejection.

- timestamp: 2026-07-31T00:05:00Z
  checked: Local environment and persisted account inputs
  found: `NAPPLET_COORDINATE` is configured to the fixture coordinate and `.data/accounts.json` exists. Thus this local reproduction has a configured launch target and persisted account material; it is not a no-default/no-selection setup.
  implication: Catalog default selection is not on the initial launch path: Home always starts the configured coordinate directly through `ConnectionController`.

- timestamp: 2026-07-31T00:06:00Z
  checked: Production build
  found: `deno task build` succeeds, and an existing production `deno serve` process is listening at the configured bind address on port 8000.
  implication: The live production endpoint can be queried without using the known Vite dev-server WebSocket limitation.

- timestamp: 2026-07-31T00:07:00Z
  checked: Live `/api/signin/status` after process account restoration
  found: The endpoint returns status `offline` with a pubkey, while `SignerConnectionService` internally projects any non-unavailable identity, including offline, as state `active`.
  implication: `/signin` is not guarding an authenticated/online signer. Its socket subscribes to the service's `active` state and immediately emits `signer.active`, producing the observed redirect Home even though the restored remote signer is offline.

- timestamp: 2026-07-31T00:08:00Z
  checked: Production Chromium Home WebSocket and DOM trace
  found: The runtime socket received `runtime.connected`, sent `runtime.start` with the configured fixture coordinate, received catalog loading projections, then received `runtime.signer.error` with "Verified napplet could not be opened". Three seconds later the ritual still existed and the page still said "The napplet is being verified" with signed-in guidance absent.
  implication: The configured/default target is selected and launch is attempted. The indefinite state is a launch failure plus missing client terminal-error handling, not a missing catalog default or catalog launch command.

- timestamp: 2026-07-31T00:09:00Z
  checked: Production backend debug trace for the same Chromium session
  found: The runtime accepted the coordinate and active signer projection, then artifact resolution logged `resolve failed blob unavailable`; the endpoint caught this and sent `runtime.signer.error`.
  implication: The immediate launch failure is verified artifact blob unavailability in the runtime environment.

- timestamp: 2026-07-31T00:09:30Z
  checked: Sign-in Chromium WebSocket trace
  found: Navigating to `/signin` opened `/api/signin/connect`, which immediately received `signer.active` for the restored offline account and redirected to `/`; the new Home runtime then repeated the launch attempt.
  implication: The reported "route guard" is actually client-side reaction to a misleading signer-service projection.

## Eliminated

- hypothesis: No configured/default napplet is selected after installed-catalog changes.
  evidence: `NAPPLET_COORDINATE` is configured and the browser sent that exact coordinate in `runtime.start`; the server accepted it as matching the fixture.
  timestamp: 2026-07-31T00:08:00Z

- hypothesis: Installed catalog synchronization or `catalog.launch` is blocking initial launch.
  evidence: Initial Home launch bypasses catalog selection and starts the configured coordinate directly; the trace reached artifact resolution before catalog readiness.
  timestamp: 2026-07-31T00:08:30Z

- hypothesis: The runtime WebSocket never connects.
  evidence: Chromium received `runtime.connected`, sent `runtime.start`, and received subsequent runtime messages.
  timestamp: 2026-07-31T00:08:45Z

## Resolution

- **root_cause:** The configured fixture artifact blob is unavailable from the production resolver, causing the backend to emit `runtime.signer.error`; `ConnectionController` has no transition for that (or other runtime terminal errors), so it remains in `bootstrapping` and the loading ritual says "The napplet is being verified" indefinitely. Independently, the restored remote signer is offline but `SignerConnectionService` projects it as `active`, causing `/signin` to redirect Home, while the initial `identity.changed` projection is sent during runtime session construction before the WebSocket `open` handler and is lost, leaving the Home account drawer signed out.
- **fix:** ConnectionController now treats runtime.signer.error, runtime.error, and runtime.auth.required as retryable terminal failures; signer projection now requires an actually active identity; the runtime bridge replays the current identity from the WebSocket open seam; the shell surfaces signer launch errors.
- **verification:**
  - target_test: { result: pass, suites: [tests/connection_controller_test.ts, tests/signer_service_test.ts, tests/end_to_end_test.ts, tests/websocket_session_test.ts], oracle_type: specified_and_derived }
  - mutation_check: { result: skipped, reason_if_skipped: "No Stryker or mutation-test configuration is present." }
  - no_op_deletion: { result: pass, deletion_justified_by_rca: false }
  - adjacent_tests: { result: pass, suites_run: [deno_task_check, deno_task_test, deno_task_build, tests/shell_resilience_test.tsx] }
  - revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
  - guardrail_verdict: accepted
- **files_changed:** [shell/connection.ts, runtime/signer_service.ts, runtime/portal_runtime.ts, routes/api/runtime.ts, islands/NappletShell.tsx, tests/connection_controller_test.ts, tests/signer_service_test.ts, tests/end_to_end_test.ts, tests/websocket_session_test.ts, .planning/debug/loading-screen-never-clears.md]
