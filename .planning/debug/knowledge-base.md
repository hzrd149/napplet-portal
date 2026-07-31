# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## loading-screen-never-clears — Terminal runtime failures left the shell bootstrapping forever
- **Date:** 2026-07-31
- **Error patterns:** loading screen never clears, napplet being verified, runtime.signer.error, offline signer redirects
- **Root cause(s):** Artifact resolution emitted a terminal runtime error that ConnectionController ignored; an offline restored signer was projected as active; the initial identity projection occurred before the WebSocket open seam.
- **Fix:** Terminal runtime messages now enter a retryable failed state, signer projection requires active status, and identity is replayed after the runtime socket opens.
- **Files changed:** shell/connection.ts, runtime/signer_service.ts, runtime/portal_runtime.ts, routes/api/runtime.ts, islands/NappletShell.tsx
- **Why not caught:** No regression test covered semantic runtime failure transitions, offline signer restoration, or post-open identity delivery.
- **Recurrence guard:** Regression tests in tests/connection_controller_test.ts, tests/signer_service_test.ts, tests/end_to_end_test.ts, and tests/websocket_session_test.ts.
---
