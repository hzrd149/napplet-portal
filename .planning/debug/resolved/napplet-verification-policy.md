---
status: resolved
trigger: "The runtime repeatedly returns runtime.signer.error / Verified napplet could not be opened; determine whether napplet verification requirements should be loosened."
created: 2026-07-31
updated: 2026-07-31T15:07:51Z
---

# Debug Session: Napplet Verification Policy

## Symptoms

- **Expected:** The configured napplet resolves and opens, or the runtime reports the precise unavailable/invalid stage with a safe recovery path.
- **Actual:** Runtime returns `{\"type\":\"runtime.signer.error\",\"error\":\"Verified napplet could not be opened\"}`.
- **Errors:** Generic verified-napplet open failure; prior trace showed backend `blob unavailable`.
- **Timeline:** Repeated in the current HTTP-served portal after signer connection.
- **Reproduction:** Connect/restore a signer and let Home start the configured napplet coordinate.

## Current Focus

- **hypothesis:** Confirmed: the prior implementation added an unsafe-only loopback authorization rule that was not part of the requested one-flag local testing bypass, so the otherwise-valid private bind is rejected only when the bypass is enabled.
- **test:** Commit the corrected debug and knowledge-base records, then push both commits to `origin/master`.
- **expecting:** Only the intentional code commit plus resolved-session/KB commit reach the remote; unrelated research cache files remain untracked.
- **next_action:** Commit `.planning/debug/resolved/napplet-verification-policy.md` and `.planning/debug/knowledge-base.md`, then push `master`.
- **bug_class:** bohrbug (the same explicit unsafe configuration deterministically fails on every non-loopback bind)
- **reasoning_checkpoint:**
  hypothesis: "The unsafe-only `isLoopbackBind` authorization check causes the valid `100.77.91.59` bind to fail because it imposes a loopback requirement beyond the requested explicit one-flag local testing contract."
  confirming_evidence:
    - "Unsafe configuration with exact `true`, an explicit HTML path, and `100.77.91.59` deterministically throws the loopback-only error."
    - "The same bind in normal mode resolves unchanged with zero warnings, proving general bind validation accepts it."
    - "Source inspection shows the loopback predicate is independent of the exact-boolean and explicit-path checks."
  falsification_test: "If removing only the loopback predicate still leaves the specified unsafe configuration rejected, or if it weakens any separate path/content/identity/warning boundary test, this hypothesis is wrong or incomplete."
  fix_rationale: "Delete only the extra loopback authorization predicate and its stale wording; retain valid bind parsing, exact opt-in parsing, the explicit local path requirement, bounded UTF-8 HTML loading, actual-byte SHA-256 identity, persistent unsafe warnings, and all runtime authority boundaries."
  blind_spots: "Automated process bootstrap verifies config acceptance but does not prove reachability from a physical mobile device; the user-provided live bind is the production-like address for that final operational property."
  candidate_causes:
    - "code: `loadRuntimeConfig` throws on every unsafe non-loopback bind even after general bind validation succeeds"
    - "config: the reported bind might have been malformed or rejected by the shared validator, which the normal-mode control disproved"
    - "environment: host routing/firewall could still affect mobile reachability after startup, but cannot explain the observed pre-serve config throw"
  and_gate: "no — the loopback predicate alone fully explains the deterministic startup rejection; network reachability is a separate post-start concern"
- **tdd_checkpoint:**

## Evidence

- timestamp: 2026-07-31T14:54:28Z
  checked: Reopened-session knowledge-base record and complete unsafe configuration/bootstrap implementation
  found: The prior KB entry repeats the loopback-only design. `loadRuntimeConfig` independently validates `PORTAL_BIND`, then throws whenever unsafe mode is enabled and the already-valid bind is not numeric loopback; `runtime/bind.ts` delegates to that function, so the same policy blocks production startup. The exact boolean and explicit-path checks are separate predicates.
  implication: The reported private bind is rejected solely by a policy predicate added in the previous fix; removing it need not affect bind syntax validation or any other unsafe artifact boundary.
- timestamp: 2026-07-31T14:54:54Z
  checked: One-variable unsafe configuration reproduction on `PORTAL_BIND=100.77.91.59`
  found: `loadRuntimeConfig` deterministically threw `Unsafe local artifact mode requires a validated loopback PORTAL_BIND` before returning configuration.
  implication: The user-reported workflow is reproducible, and the thrown message identifies the loopback-only admission predicate as the immediate failure site.
- timestamp: 2026-07-31T14:55:20Z
  checked: Normal-mode control using the identical `PORTAL_BIND=100.77.91.59`
  found: `loadRuntimeConfig` returned bind `100.77.91.59`, `unsafeSkipVerification=false`, and zero warnings.
  implication: The bind is valid configuration; the unsafe-only loopback check is the confirmed single cause of the pre-serve rejection.
- timestamp: 2026-07-31T14:56:39Z
  checked: Pre-fix specified-oracle regressions for config and production bootstrap
  found: `deno test -A tests/config_test.ts tests/env_test.ts` produced exactly two failures: direct unsafe config threw the loopback error, and `runtime/bind.ts` exited nonzero instead of printing `100.77.91.59`. The new normal-mode control and seven adjacent tests passed.
  implication: The regressions reproduce the precise requirement defect without weakening normal verified mode or unrelated configuration behavior.
- timestamp: 2026-07-31T14:57:43Z
  checked: Post-fix specified-oracle config and production-bootstrap regressions
  found: All 9 tests passed. Unsafe mode retained `100.77.91.59`, the bootstrap printed that bind and emitted a sanitized persistent `UNSAFE` warning, normal mode stayed unsafe-disabled and warning-free, and exact boolean/path plus invalid-bind checks remained green.
  implication: Removing only the loopback predicate fixes the requested configuration seam while retaining adjacent fail-closed configuration behavior.
- timestamp: 2026-07-31T14:58:25Z
  checked: Focused unsafe/artifact/runtime/controller/UI/WebSocket regression matrix
  found: All 46 focused tests passed across config, environment bootstrap, artifact resolution, end-to-end runtime, controller classification, setup visibility, and WebSocket error handling.
  implication: The bind correction leaves the 5 MiB/UTF-8/HTML boundaries, actual-byte identity, retained capabilities, unsafe markers, persistent UI warning, and typed artifact failures intact.
- timestamp: 2026-07-31T14:58:48Z
  checked: Full formatting, lint, and type-check gate
  found: `deno task check` passed after checking formatting across 139 files, lint across 135 files, and all TypeScript modules.
  implication: The minimal correction is formatted, lint-clean, and type-correct across the project.
- timestamp: 2026-07-31T15:04:49Z
  checked: Full non-browser project test suite with a bounded summary capture
  found: `deno task test` exited 0 with 298 passed, 0 failed in 2m3s.
  implication: All project configuration, artifact, runtime, security, and documentation regressions remain green after the bind-policy correction.
- timestamp: 2026-07-31T15:05:41Z
  checked: Production build and fix diff/mutation-tool availability
  found: `deno task build` completed 54-module client and 865-module SSR bundles. The diff removes only the RCA-identified loopback authorization and replaces its tests/copy with specified behavior; no Stryker or other mutation configuration exists.
  implication: Production bundling passes. The no-op/deletion signal is justified by the confirmed over-constraint, and mutation testing must be recorded as skipped rather than passed.
- timestamp: 2026-07-31T15:06:12Z
  checked: Revert half of the fix-acceptance counterfactual
  found: With only the loopback predicate restored and the corrected regressions retained, the target returned to exactly 7 passed and 2 failed at the direct config and production-bootstrap private-bind checks.
  implication: The reported defect returns when the removed predicate returns; reapplying the correction must now reconfirm causation.
- timestamp: 2026-07-31T15:07:02Z
  checked: Reapply half of the fix-acceptance counterfactual
  found: Removing the predicate again restored the identical target to 9 passed, 0 failed. All five applicable guardrail signals now agree; mutation testing is the only skipped signal because no mutation tool is configured.
  implication: The code change is causally responsible for the corrected behavior and is accepted for commit.
- timestamp: 2026-07-31T15:07:51Z
  checked: Final implementation diff and code commit
  found: `git diff --check` passed; commit `b43510e` contains only `.env.example`, `README.md`, `runtime/config.ts`, `tests/config_test.ts`, and `tests/env_test.ts`. Unrelated `.planning/research/.cache` files were not staged.
  implication: The minimal correction is committed atomically and the resolved records can be updated without incorporating unrelated worktree state.

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

- **root_cause:** The original incident combined transient artifact unavailability with catch-all artifact error relabeling. During its fix, unsafe local testing was additionally restricted to numeric loopback binds; that extra policy deterministically rejects the otherwise-valid private/mobile bind `100.77.91.59` and was not part of the requested explicit one-flag bypass contract.
- **fix:** Preserved the original typed artifact error mapping and unsafe local artifact boundaries, but removed the extra unsafe-only numeric-loopback admission check. Unsafe mode now accepts any separately validated `PORTAL_BIND`, including `100.77.91.59`, while exact opt-in, explicit path, 5 MiB/UTF-8/HTML checks, actual-byte SHA-256 identity, persistent warnings, and all non-verification authority boundaries remain unchanged. README and `.env.example` now describe trusted private-network mobile testing without a second acknowledgment flag.
- **verification:**
  target_test: { result: pass, detail: "9/9 corrected config and production-bootstrap tests" }
  mutation_check: { result: skipped, reason_if_skipped: "no Stryker/package mutation configuration", mutant_killed: false }
  no_op_deletion: { result: pass, deletion_justified_by_rca: true, detail: "removed only the confirmed extra authorization predicate" }
  adjacent_tests: { result: pass, suites_run: ["46 focused config/env/artifact/runtime/controller/UI/WebSocket tests", "298 full non-browser tests", "deno task check", "deno task build"] }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
  guardrail_verdict: accepted
- **oracle_type:** specified — explicit user security/configuration contract plus existing NIP-5D/runtime transport contracts.
- **files_changed:** [.env.example, README.md, assets/styles.css, deno.json, islands/NappletShell.tsx, main.ts, routes/api/runtime.ts, routes/index.tsx, runtime/artifacts.ts, runtime/config.ts, runtime/portal_runtime.ts, shell/connection.ts, tests/artifact_resolver_test.ts, tests/config_test.ts, tests/connection_controller_test.ts, tests/end_to_end_test.ts, tests/env_test.ts, tests/setup_visibility_test.tsx, tests/websocket_session_test.ts]

## Prevention

- **Branched 5-Whys:**
  - **Environment/data branch:** The runtime could not open the napplet because no candidate returned artifact bytes at incident time. That condition could change between attempts because the usable Blossom candidates are remote and independently available. The production verifier correctly rejected the absence of bytes; loosening signature, aggregate, MIME, size, capability, or SHA-256 checks would not address availability.
  - **Code branch:** The user saw a signer/verification failure because `sendActiveSigner` discarded the typed `ArtifactResolutionError`. The transport catch-all emitted one generic `runtime.signer.error`, so the UI and operator could not distinguish an unavailable artifact from invalid bytes or signer failure.
  - **Config branch:** Offline testing remained blocked because the only launch path required remotely retrieved verified bytes. No explicit local-source configuration existed, so a controlled test could not bypass remote availability while retaining the remaining runtime authority boundaries.
  - **AND-gate:** The misleading reported incident required both remote artifact unavailability and catch-all error relabeling. The lack of a local testing seam was a separate contributor to recovery/testing, not a reason to weaken production verification.
- **Why not caught:** No regression gate covered typed artifact-error preservation across the WebSocket boundary, and the first unsafe-mode regression matrix encoded an agent-added loopback restriction instead of the requested mobile/private-bind workflow.
- **Recurrence guard:** Passing regressions cover stable `runtime.artifact.error` mapping in `tests/websocket_session_test.ts`; exact/off-by-default unsafe configuration plus private-bind and normal-mode controls in `tests/config_test.ts`; private-bind production bootstrap with sanitized warning in `tests/env_test.ts`; bounded actual-byte identity and capability retention in `tests/artifact_resolver_test.ts` and `tests/end_to_end_test.ts`; controller classification in `tests/connection_controller_test.ts`; and persistent UI distinction in `tests/setup_visibility_test.tsx`.

### Requirements correction: private/mobile bind admission

- **Branched 5-Whys:** The unsafe testing flag remained unusable in the live mobile workflow because the prior fix treated loopback-only admission as a security requirement. General bind validation already accepts the private address, and artifact authority remains gated by exact opt-in plus an explicit local file; the additional bind predicate was therefore an independent code-policy over-constraint rather than a necessary part of the bypass boundary. Host routing or firewall state can affect reachability after startup, but cannot cause the observed pre-serve loopback exception.
- **Why not caught:** The original regression suite encoded the agent-added loopback policy as its oracle instead of checking the requested mobile/private-bind workflow, so check, test, build, and human verification all reinforced the wrong requirement.
- **Recurrence guard:** `tests/config_test.ts` now requires unsafe mode to retain `100.77.91.59` and separately requires normal mode to stay unsafe-disabled and warning-free; `tests/env_test.ts` requires the production bind bootstrap to accept that address while emitting a sanitized persistent unsafe warning.
