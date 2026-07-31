---
status: investigating
trigger: "Make the Playwright two-page media browser row deterministic and green without external Blossom while preserving production WebSocket and artifact verification authority."
created: 2026-07-31T00:00:00Z
updated: 2026-07-31T08:00:00Z
---

## Current Focus

bug_class: bohrbug hypothesis: The browser row deterministically fails because
its built portal has no local Blossom on the production resolver's fixed
127.0.0.1:24242 discovery boundary, while the only configured/manifest sources
are external and the historical signed blob is not reliably available there.
test: serve the exact fixture bytes at the production local-Blossom boundary and
rerun only the two-page browser row expecting: runtime.start emits
runtime.artifact for both peers and the existing revoke-before-grant assertions
complete without altering resolver or transport authority next_action: add an
isolated Playwright-managed local Blossom fixture server containing the exact
SHA-256-verified signed artifact bytes

## Symptoms

expected: The Playwright two-page media row starts the verified napplet and
proves revoke-before-grant over the production WebSocket transport without
external services. actual: Sequential production runtime.start emits sanitized
runtime.signer.error before media creation. errors: Server evidence reports
verified historical artifact resolution as blob-unavailable. reproduction: Run
the two-page media browser row in tests/browser/portal_acceptance_test.ts
through the Playwright configuration. started: Introduced with the Phase 09-08
browser acceptance row; four non-media rows pass.

## Eliminated

## Evidence

- timestamp: 2026-07-31T07:55:00Z checked: Phase 09-08 summary and browser test
  found: Four non-media rows pass; only the media row fails before media
  creation while awaiting runtime.artifact after runtime.start. implication: The
  media reducer and transfer assertions are not reached; diagnosis must follow
  startup artifact resolution.
- timestamp: 2026-07-31T07:57:00Z checked: production runtime and artifact
  resolver found: createPortalRuntime resolves the signed fixture through
  resolveVerifiedArtifact and BlossomCache; resolution verifies the signed
  manifest, per-path SHA-256, and aggregate hash before emitting executable
  HTML. implication: A local server can supply bytes through the existing
  production boundary without bypassing security authority.
- timestamp: 2026-07-31T07:58:00Z checked: BlossomCache discovery and Playwright
  configuration found: Local discovery is fixed to HEAD http://127.0.0.1:24242/,
  but Playwright starts only the portal server; its configured Blossom defaults
  and manifest hints are external HTTPS services. implication: The harness lacks
  the deterministic local dependency that production code already prefers.
- timestamp: 2026-07-31T07:59:00Z checked: exact historical artifact source
  found: The remote artifact currently downloads as exactly 531120 bytes with
  SHA-256 05570ec277fda70751b374d3fe6b33019ce11aacf9d56c7e176e3605cd80dc55 and
  compresses to 72044 bytes. implication: The exact signed artifact can be
  pinned compactly as a repository test fixture and served locally; corrupted
  fixture bytes will still fail closed in the production resolver.
- timestamp: 2026-07-31T08:00:00Z checked: spectrum-based fault localization
  availability found: No per-test coverage spectrum is configured for the
  Playwright row. implication: SBFL is skipped; deterministic working-backwards
  evidence directly isolates the missing local artifact source.
- timestamp: 2026-07-31T08:20:00Z checked: direct production pinned-fetch and
  resolver probes found: After deferring Agent cleanup until response-body
  completion, pinnedFetch returns 531120 bytes and resolveVerifiedArtifact
  returns the signed security-lab artifact; focused regression, artifact
  resolver suite, and deno task check pass. implication: The response lifecycle
  deadlock is confirmed and fixed independently of the remaining browser-harness
  failure.
- timestamp: 2026-07-31T08:25:00Z checked: rebuilt Playwright two-page media row
  found: The row still exits 1 waiting for runtime.artifact with
  runtime.signer.error/blob-unavailable despite the exact loopback fixture and
  rebuilt server. implication: WINDOW 21 remains an unresolved
  built-Playwright-specific blocker; no browser acceptance pass can be claimed.

## Resolution

root_cause: The Playwright harness starts the production portal without a
deterministic server at its existing local Blossom discovery boundary, leaving
runtime.start dependent on unreliable external historical-blob availability.
fix: Commit 89c04d7 defers pinned Agent cleanup until response body
completion/cancellation and adds a focused readable-body regression. An exact
local Playwright fixture trial remains uncommitted because it did not green the
browser row. verification: Focused pinned-fetch + artifact resolver tests pass
(5/5); deno task check passes; rebuilt targeted Playwright media row fails with
the original sanitized blob-unavailable symptom. files_changed:
[runtime/pinned_fetch.ts, tests/pinned_fetch_test.ts] oracle_type: specified
