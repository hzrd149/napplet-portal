# Project Retrospective: Napplet Portal

## Milestone: v1.1 — Runtime & UX Expansion

**Shipped:** 2026-07-31 (override closeout)
**Phases:** 7 | **Plans:** 32 | **Tasks:** 63

### What Was Built

- A resilient mobile shell with backend-owned account, connection, theme, and
  verified iframe lifecycle.
- Installed napplet discovery, approval, streaming catalog projection, search,
  and exact-identity launch.
- Backend RESOURCE/UPLOAD, COMMON/STORAGE, INTENT, and cross-tab MEDIA seams.
- Exhaustive pinned-contract parity, adversarial boundary matrices, lifecycle
  tests, production multi-client smokes, and local Chromium acceptance.

### What Worked

- Vertical tracer tests exposed wiring errors earlier than isolated unit tests.
- Generation-bound authority consistently prevented stale reconnect, signer,
  storage, intent, and media work from committing effects.
- Typed review caught WebSocket CSP and reconnect subscription defects before
  archival; focused regression tests then held those fixes through full gates.

### What Was Inefficient

- The historical browser media artifact depended on unavailable external blob
  state, making the final Playwright row non-deterministic.
- Serial external-artifact tests made full verification slow and initially
  obscured shared-resource contention.
- Some early summary one-liners were malformed, reducing generated milestone
  entry quality.

### Patterns Established

- Treat relay/Nostr results as partial streams, not completed fetches.
- Mint browser authority only from exact verified catalog launches and recheck
  it after every asynchronous boundary.
- Keep Playwright discovery separate from Deno tests and run external artifact
  tests serially.
- Use a fixed bootstrap hash plus Fresh's validated response nonce for strict
  CSP without breaking hydration.

### Key Lessons

- Browser acceptance fixtures must own every signed event and blob byte needed
  for deterministic production-path execution.
- Backend transport evidence is valuable but cannot substitute for physical
  browser playback, backgrounding, popup, or safe-area observations.
- Accepted residual risk should remain queryable in requirements, verification,
  audit, state, and milestone history rather than being collapsed into pass.

### Cost Observations

- The complete post-review gate passed 275 Deno tests plus check, build, and
  four non-media Chromium rows.
- Most rework clustered at boundary integration: catalog projection, pinned
  fetch lifetime, CSP hydration, and reconnect output ownership.

## Cross-Milestone Trends

| Milestone | Requirements | Automated gate | Residual gaps |
| --- | ---: | --- | ---: |
| v1.1 | 32/33 satisfied | 275 Deno tests; check/build; 4 Chromium rows | 1 (QLT-04) |

