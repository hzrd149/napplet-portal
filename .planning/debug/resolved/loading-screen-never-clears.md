---
status: resolved
trigger: "Investigate why the main loading screen never disappears, even after I connect a signer. The status draw is stuck in the status message saying the napplet is being verified. This could mean either it is not being loaded or there is no default one to load now that we have the installed list."
created: 2026-07-31
updated: 2026-07-31T01:32:00Z
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
- **hypothesis:** Confirmed: a terminal runtime failure reaches `ConnectionController` phase `failed`, but `NappletShell` leaves `ritualVisible` true because its snapshot callback clears the ritual only for `ready`.
- **test:** Focused regression, revert-and-reconfirm, `deno task check`, full `deno task test`, and `deno task build`.
- **expecting:** Complete: every required verification signal passed, with 284 full-suite tests green.
- **next_action:** Resolved; commit the minimal fix, regression, debug record, and knowledge-base update, then push.
- **reasoning_checkpoint:**
  hypothesis: Terminal runtime failure leaves the blocking overlay mounted because the shell's failed snapshot branch does not clear `ritualVisible`.
  confirming_evidence:
    - The controller regression proves runtime terminal messages produce phase `failed`.
    - The new focused shell regression fails because the failed branch contains the error projection but no `setRitualVisible(false)` transition.
  falsification_test: If the current failed branch already cleared ritual visibility, or the focused regression passed before the fix, this hypothesis would be false.
  fix_rationale: Clearing ritual visibility in the terminal failed branch exposes the already-rendered Home and existing error/retry controls without changing controller retry semantics or cold-start behavior.
  blind_spots: The source-level regression does not execute Preact browser state transitions; full tests and build cover compilation and adjacent behavior.
  candidate_causes:
    - code: The shell's failed-state projection omits the ritual visibility transition.
    - environment/data: Artifact unavailability triggers the terminal failure but does not itself determine whether the browser overlay remains mounted.
  and_gate: yes — the original stuck symptom requires a terminal backend failure and the shell's omitted failed-state ritual transition; the prior fix addressed only the controller half.
- **prior_reasoning_checkpoint:**
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

- timestamp: 2026-07-31T01:19:00Z
  checked: Focused shell regression for terminal failure visibility
  found: The new test failed while confirming configured cold start still initializes the ritual, ready still uses its bounded transition, and failed still exposes error/retry wiring; only the failed branch lacked `setRitualVisible(false)`.
  implication: The continuation root cause is confirmed and the minimal correction is a single state update in the existing failed branch.

- timestamp: 2026-07-31T01:22:00Z
  checked: Focused shell regression after the failed-state visibility correction
  found: All four setup visibility tests passed, including assertions for terminal failure, configured cold start, bounded ready transition, error projection, and retry wiring.
  implication: The minimal production change satisfies the driving regression without weakening the explicitly held-out shell behaviors.

- timestamp: 2026-07-31T01:31:00Z
  checked: Revert-and-reconfirm and project-wide verification
  found: Removing only `setRitualVisible(false)` made the focused test fail; reapplying it restored green. `deno task check`, all 284 tests, and the production build passed.
  implication: The fix is causally tied to the reported overlay defect and introduces no detected adjacent regression.

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

- **root_cause:** The configured fixture artifact blob is unavailable from the production resolver, causing the backend to emit `runtime.signer.error`; after the prior correction makes `ConnectionController` enter `failed`, `NappletShell` still clears the blocking ritual only for `ready`, so terminal failure leaves the overlay mounted above Home and its recovery UI. Independently, the restored remote signer was projected as active while offline and the initial identity projection was sent before WebSocket open; those projection defects were corrected previously.
- **fix:** NappletShell now clears `ritualVisible` when the connection snapshot enters terminal `failed`, revealing Home and existing recovery UI; the focused regression preserves cold-start, ready, error, and retry behavior.
- **verification:**
  - target_test: { result: pass, suites: [tests/setup_visibility_test.tsx], oracle_type: specified_and_derived }
  - mutation_check: { result: skipped, reason_if_skipped: "No Stryker or mutation-test configuration is present." }
  - no_op_deletion: { result: pass, deletion_justified_by_rca: false }
  - adjacent_tests: { result: pass, suites_run: [deno_task_check, deno_task_test_284_tests, deno_task_build, tests/setup_visibility_test.tsx] }
  - revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
  - guardrail_verdict: accepted
- **files_changed:** [shell/connection.ts, runtime/signer_service.ts, runtime/portal_runtime.ts, routes/api/runtime.ts, islands/NappletShell.tsx, tests/connection_controller_test.ts, tests/signer_service_test.ts, tests/end_to_end_test.ts, tests/websocket_session_test.ts, tests/setup_visibility_test.tsx, .planning/debug/resolved/loading-screen-never-clears.md, .planning/debug/knowledge-base.md]
