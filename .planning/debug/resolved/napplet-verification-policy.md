---
status: resolved
trigger: "The runtime repeatedly returns runtime.signer.error / Verified napplet could not be opened; determine whether napplet verification requirements should be loosened."
created: 2026-07-31
updated: 2026-07-31T14:48:42Z
---

# Debug Session: Napplet Verification Policy

## Symptoms

- **Expected:** The configured napplet resolves and opens, or the runtime reports the precise unavailable/invalid stage with a safe recovery path.
- **Actual:** Runtime returns `{\"type\":\"runtime.signer.error\",\"error\":\"Verified napplet could not be opened\"}`.
- **Errors:** Generic verified-napplet open failure; prior trace showed backend `blob unavailable`.
- **Timeline:** Repeated in the current HTTP-served portal after signer connection.
- **Reproduction:** Connect/restore a signer and let Home start the configured napplet coordinate.

## Current Focus

- **hypothesis:** Confirmed and fixed: transient artifact unavailability and catch-all error relabeling caused the misleading signer/verification symptom; strict production verification remains correct, while explicit loopback-only unsafe local bytes provide the approved offline testing seam.
- **test:** Human exercised the built runtime with a disposable UTF-8 HTML file in loopback unsafe mode, attempted unsafe startup on a public bind, and restarted with unsafe variables absent.
- **expecting:** Satisfied: unsafe mode launched with persistent visual/runtime distinction and actual-byte identity, public-bind startup failed closed without path leakage, and normal mode remained verified with no unsafe marker.
- **next_action:** None — the human-confirmed session is resolved and archived; commit and push the final resolution records.
- **bug_class:** heisenbug-mandelbug (reclassified: the same production path now succeeds because remote artifact availability changed; the deterministic catch-all reporting defect remains reproducible)
- **reasoning_checkpoint:**
  hypothesis: "Artifact bytes were unavailable at incident time; `sendActiveSigner` then collapsed the typed resolver error into `runtime.signer.error`, making an availability failure look like signer/verification rejection."
  confirming_evidence:
    - "Prior runtime trace recorded `blob unavailable`, which is emitted only after the artifact fetch stage exhausts candidates."
    - "The same manifest and production resolver now pass all signature, aggregate, capability, size/MIME, and SHA-256 checks with exact bytes from two manifest sources."
    - "The WebSocket catch block discards the caught error and always emits `Verified napplet could not be opened` as `runtime.signer.error`."
  falsification_test: "If the production resolver rejects the currently retrievable exact bytes with a signature, aggregate, capability, MIME, size, or SHA-256 error, then availability plus error-collapsing does not explain the symptom."
  fix_rationale: "Keep the production resolver byte-for-byte unchanged; map its typed failures to stable sanitized artifact categories, and add a separate config-authorized loopback-only local HTML source that is explicitly marked unsafe and retains byte-size/HTML/UTF-8, iframe, signer, capability, storage, URL, and origin boundaries."
  blind_spots: "The original transient outage cannot be replayed exactly now; physical mobile verification and a real process started with the unsafe environment remain human/E2E checks after automated coverage."
  candidate_causes:
    - "environment/data: all usable Blossom candidates were unavailable to the running process during the incident, so no executable bytes reached verification"
    - "code: the endpoint discarded `ArtifactResolutionError` and mislabeled every artifact failure as a signer error"
    - "config: there was no fail-closed local artifact mode for intentionally offline loopback testing"
  and_gate: "yes — the reported generic repeated symptom required both an artifact-resolution failure and the catch-all transport mapping; the absence of a local mode separately prevented testing through such outages"
- **tdd_checkpoint:**

## Evidence

- timestamp: 2026-07-31T13:44:31Z
  checked: Phase 0 semantic/keyword knowledge-base recall
  found: MemPalace is unavailable, so keyword fallback was used. The only prior entry shares `runtime.signer.error` but concerns shell/controller handling after a terminal error, not artifact availability or validity.
  implication: Treat `loading-screen-never-clears` as a low-specificity candidate only; do not infer that it explains the current artifact-resolution failure.
- timestamp: 2026-07-31T13:45:00Z
  checked: Complete artifact resolver and Blossom/cache transport path
  found: `PortalArtifactResolver` validates the manifest and delegates all signature, aggregate, per-path SHA-256, executable MIME/size, and capability checks to `resolveNapplet`; `BlossomCache` tries a fixed local proxy then HTTPS upstreams through `ResourceService`, which verifies the streamed SHA-256 before returning bytes. Unknown fetch failures become typed `blob-unavailable`, but the WebSocket route currently replaces the typed failure with `Verified napplet could not be opened`.
  implication: Existing verification requirements need not be loosened. Retrieval availability and byte invalidity are already separable at the resolver boundary but not at the client transport boundary.
- timestamp: 2026-07-31T13:45:00Z
  checked: SBFL preconditions
  found: A focused test suite exists, but no failing automated reproduction or per-test coverage spectrum has been established yet.
  implication: SBFL skipped for now; first reproduce the reported live-source failure deterministically.
- timestamp: 2026-07-31T13:48:00Z
  checked: Effective source configuration and independent exact-hash retrieval
  found: Effective configured sources are `blossom.primal.net` and `blossom.band`; the manifest adds `blssm.us`, `cdn.hzrd149.com`, and `nostr.download`. The configured sources returned 404, while `blssm.us` and `cdn.hzrd149.com` each returned 531120 bytes whose SHA-256 exactly equals `05570ec277fda70751b374d3fe6b33019ce11aacf9d56c7e176e3605cd80dc55`; `nostr.download` returned 404.
  implication: Valid executable bytes are currently available from two signed manifest sources. The failure is not caused by every source lacking the blob.
- timestamp: 2026-07-31T13:52:00Z
  checked: Exact fixture through production `BlossomCache` → `ResourceService` → DNS policy → `pinnedFetch` → `resolveNapplet`
  found: Resolution completed in 2.6 seconds with dTag `security-lab`, the expected aggregate hash, and 531120 verified HTML bytes.
  implication: The normal production verification policy accepts the napplet and must remain unchanged. The earlier `blob unavailable` was transient/external or state-specific, not evidence that signature, aggregate, capability, MIME, size, or SHA-256 checks are too strict.
- timestamp: 2026-07-31T13:52:00Z
  checked: New explicit user testing requirement
  found: Local testing needs an off-by-default unsafe verification bypass, gated to validated loopback bind, backed by an explicit local artifact byte source, visibly/logically marked unsafe, with every non-artifact authority boundary retained.
  implication: Implement as a separate configuration-authorized local source rather than weakening or conditionally relaxing the production verifier.
- timestamp: 2026-07-31T13:58:00Z
  checked: Failure taxonomy after same-path retry
  found: The exact production path that previously traced `blob unavailable` now resolves successfully, while direct source observations show changing remote availability across candidates.
  implication: Reclassify the incident as environment-dependent Heisenbug/Mandelbug; the earlier SBFL skip is explicitly revoked as inapplicable to a flaky remote-availability spectrum. Use deterministic regression tests for the catch-all mapping and unsafe-mode gates instead.
- timestamp: 2026-07-31T14:05:00Z
  checked: Pre-fix focused regression matrix (7 test files)
  found: RED as expected with 10 type errors: no unsafe config fields, no local artifact loader/runtime option, no verification marker/UI prop, and no typed artifact failure mapper.
  implication: The tests directly exercise the missing behavior and now provide a deterministic oracle before implementation.
- timestamp: 2026-07-31T14:14:00Z
  checked: Focused regression and fix-acceptance revert guardrail
  found: 45/45 focused tests pass. With production changes stashed but agent-authored regression tests retained, the suite returned the original 10 missing-behavior/type failures; after reapplying the changes it returned to 45/45. The diff adds guarded behavior and tests rather than deleting or short-circuiting verification.
  implication: Target test, no-op/deletion, adjacent focused tests, and revert-and-reconfirm signals pass; mutation testing is unavailable because the repository has no Stryker configuration.
- timestamp: 2026-07-31T14:23:00Z
  checked: Full project verification
  found: `deno task check` passed formatting, lint, and type checking across 139/135 files; `deno task test` passed 296 tests with zero failures; `deno task build` completed client and SSR production bundles.
  implication: All applicable automated acceptance signals pass and the fix is ready for real-workflow human verification.
- timestamp: 2026-07-31T14:48:42Z
  checked: Human verification checkpoint in the approved local testing workflow
  found: The focused 45-test/local runtime workflow passed with a disposable UTF-8 HTML artifact, persistent unsafe banner, `unsafe-local` runtime classification, actual-byte SHA-256 identity, and unchanged capabilities; public-bind unsafe startup exited nonzero with a loopback-only explanation and no path leak; with unsafe variables absent, configuration and server/UI output remained verified and contained no unsafe marker.
  implication: The original workflow and both fail-closed boundaries are confirmed end to end; the session can be resolved and archived.
- timestamp: 2026-07-31T14:48:42Z
  checked: Semantic-memory archive integration
  found: Project configuration has `mempalace.enabled: false`; the durable knowledge-base entry was written instead.
  implication: MemPalace indexing is intentionally skipped, with `.planning/debug/knowledge-base.md` remaining the persistent recall source.

## Eliminated

- hypothesis: Every configured and manifest-declared Blossom source lacks the artifact.
  evidence: Independent bounded HTTPS GETs retrieved exact-size, exact-SHA-256 bytes from both `blssm.us` and `cdn.hzrd149.com`.
  timestamp: 2026-07-31T13:48:00Z
- hypothesis: Production resource policy or pinned transport deterministically rejects the valid manifest sources.
  evidence: The exact production resolver succeeded end-to-end through `ResourceService` and `pinnedFetch` in the same environment.
  timestamp: 2026-07-31T13:52:00Z

## Resolution

- **root_cause:** At incident time, no artifact source delivered bytes to the runtime; independently, `sendActiveSigner` discarded the typed `ArtifactResolutionError` and emitted a generic `runtime.signer.error`, misrepresenting availability as signer/verification failure. Current exact bytes pass the unchanged production verifier, so verification strictness is not causal.
- **fix:** Kept the normal `resolveNapplet` verification path unchanged; added stable sanitized `runtime.artifact.error` categories; added off-by-default `NAPPLET_UNSAFE_SKIP_VERIFICATION` plus explicit `NAPPLET_UNSAFE_LOCAL_ARTIFACT_PATH`, rejected before serving unless the bind is numeric loopback; bounded local input to UTF-8 HTML and 5 MiB; assigned actual-byte SHA-256 identity; marked runtime/browser/startup as `unsafe-local`; retained origin, sandbox, signer, capability, storage, URL, and message boundaries.
- **verification:**
  target_test: { result: pass, detail: "45/45 focused tests" }
  mutation_check: { result: skipped, reason_if_skipped: "no Stryker/package mutation configuration", mutant_killed: false }
  no_op_deletion: { result: pass, deletion_justified_by_rca: false }
  adjacent_tests: { result: pass, suites_run: ["45 focused config/env/artifact/runtime/controller/UI/WebSocket tests", "296 full non-browser tests", "deno task check", "deno task build"] }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
  human_checkpoint: { result: pass, detail: "Approved local unsafe-mode, public-bind rejection, and normal verified-mode workflows all passed" }
  guardrail_verdict: accepted
- **oracle_type:** specified — explicit user security/configuration contract plus existing NIP-5D/runtime transport contracts.
- **files_changed:** [.env.example, README.md, assets/styles.css, deno.json, islands/NappletShell.tsx, main.ts, routes/api/runtime.ts, routes/index.tsx, runtime/artifacts.ts, runtime/config.ts, runtime/portal_runtime.ts, shell/connection.ts, tests/artifact_resolver_test.ts, tests/config_test.ts, tests/connection_controller_test.ts, tests/end_to_end_test.ts, tests/env_test.ts, tests/setup_visibility_test.tsx, tests/websocket_session_test.ts]

## Prevention

- **Branched 5-Whys:**
  - **Environment/data branch:** The runtime could not open the napplet because no candidate returned artifact bytes at incident time. That condition could change between attempts because the usable Blossom candidates are remote and independently available. The production verifier correctly rejected the absence of bytes; loosening signature, aggregate, MIME, size, capability, or SHA-256 checks would not address availability.
  - **Code branch:** The user saw a signer/verification failure because `sendActiveSigner` discarded the typed `ArtifactResolutionError`. The transport catch-all emitted one generic `runtime.signer.error`, so the UI and operator could not distinguish an unavailable artifact from invalid bytes or signer failure.
  - **Config branch:** Offline testing remained blocked because the only launch path required remotely retrieved verified bytes. No explicit local-source configuration existed, so a controlled test could not bypass remote availability while retaining the remaining runtime authority boundaries.
  - **AND-gate:** The misleading reported incident required both remote artifact unavailability and catch-all error relabeling. The lack of a local testing seam was a separate contributor to recovery/testing, not a reason to weaken production verification.
- **Why not caught:** No regression gate covered typed artifact-error preservation across the WebSocket boundary, and no configuration/runtime/UI test matrix covered a fail-closed, visibly distinct, loopback-only local artifact mode.
- **Recurrence guard:** Passing regressions now cover stable `runtime.artifact.error` mapping in `tests/websocket_session_test.ts`, explicit/off-by-default loopback configuration in `tests/config_test.ts`, public-bind bootstrap rejection without path leakage in `tests/env_test.ts`, bounded actual-byte local identity and capability retention in `tests/artifact_resolver_test.ts` and `tests/end_to_end_test.ts`, controller distinction in `tests/connection_controller_test.ts`, and persistent UI distinction in `tests/setup_visibility_test.tsx`.
