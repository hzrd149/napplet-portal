# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## loading-screen-never-clears — Terminal runtime failures left the shell bootstrapping forever
- **Date:** 2026-07-31
- **Error patterns:** loading screen never clears, napplet being verified, runtime.signer.error, offline signer redirects
- **Root cause(s):** Artifact resolution emitted a terminal runtime error that ConnectionController initially ignored; after the controller entered failed, NappletShell still left the blocking ritual visible; an offline restored signer was projected as active; the initial identity projection occurred before the WebSocket open seam.
- **Fix:** Terminal runtime messages now enter a retryable failed state, terminal failure clears the blocking ritual to reveal Home and recovery UI, signer projection requires active status, and identity is replayed after the runtime socket opens.
- **Files changed:** shell/connection.ts, runtime/signer_service.ts, runtime/portal_runtime.ts, routes/api/runtime.ts, islands/NappletShell.tsx
- **Why not caught:** No regression test covered semantic runtime failure transitions, failed-state ritual visibility, offline signer restoration, or post-open identity delivery.
- **Recurrence guard:** Regression tests in tests/connection_controller_test.ts, tests/setup_visibility_test.tsx, tests/signer_service_test.ts, tests/end_to_end_test.ts, and tests/websocket_session_test.ts.
---

## napplet-verification-policy — Artifact availability was mislabeled as signer/verification failure
- **Date:** 2026-07-31
- **Error patterns:** runtime.signer.error, Verified napplet could not be opened, blob unavailable, runtime.artifact.error, unsafe-local
- **Root cause(s):** At incident time no artifact source delivered bytes to the runtime; independently, `sendActiveSigner` discarded the typed `ArtifactResolutionError` and emitted a generic `runtime.signer.error`, misrepresenting availability as signer/verification failure. Current exact bytes pass the unchanged production verifier, so verification strictness was not causal.
- **Fix:** Preserved the normal verified resolver; mapped typed failures to sanitized artifact categories; added an off-by-default explicit local HTML source gated to numeric loopback, bounded to UTF-8 HTML and 5 MiB, identified by actual-byte SHA-256, visibly marked `unsafe-local`, and isolated from retained origin, sandbox, signer, capability, storage, URL, and message boundaries.
- **Files changed:** .env.example, README.md, assets/styles.css, deno.json, islands/NappletShell.tsx, main.ts, routes/api/runtime.ts, routes/index.tsx, runtime/artifacts.ts, runtime/config.ts, runtime/portal_runtime.ts, shell/connection.ts, tests/artifact_resolver_test.ts, tests/config_test.ts, tests/connection_controller_test.ts, tests/end_to_end_test.ts, tests/env_test.ts, tests/setup_visibility_test.tsx, tests/websocket_session_test.ts
- **Why not caught:** No regression gate covered typed artifact-error preservation across the WebSocket boundary, and no configuration/runtime/UI test matrix covered a fail-closed, visibly distinct, loopback-only local artifact mode.
- **Recurrence guard:** Passing regression tests in tests/websocket_session_test.ts, tests/config_test.ts, tests/env_test.ts, tests/artifact_resolver_test.ts, tests/end_to_end_test.ts, tests/connection_controller_test.ts, and tests/setup_visibility_test.tsx cover error taxonomy, config gates, public-bind rejection, actual-byte identity, retained capabilities, controller classification, and persistent UI distinction.
---
