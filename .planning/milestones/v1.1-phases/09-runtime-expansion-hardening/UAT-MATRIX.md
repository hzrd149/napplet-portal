# Phase 9 UAT Matrix

**Evidence date:** 2026-07-31\
**Allowed statuses:** `AUTOMATED PASS`, `MANUAL PASS`,
`NOT RUN — accepted residual risk`

This ledger separates executable evidence from observations requiring physical
devices or live external services. `NOT RUN — accepted residual risk` is not a
pass. It records the user's D-15 unattended-run acceptance of a release risk,
not satisfaction of requirement wording that explicitly requires the
observation.

## Acceptance ledger

| Area                                                                    | Environment / device / service                                          | Status                           | Evidence or script                                                                                    | Release consequence                                                                    |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Pinned contract and dispatcher parity (QLT-01)                          | Deno 2.9.4, pinned `@napplet/core@0.31.0` and `@napplet/nap@0.31.0`     | AUTOMATED PASS                   | `tests/contract_parity_test.ts`; 100 exact rows across ten domains                                    | None                                                                                   |
| Hostile proxy boundaries (QLT-02)                                       | Deno unit/integration and built Fresh response tests                    | AUTOMATED PASS                   | Plans 09-02 through 09-06; transfer, authority, state, browser, and async-lifecycle matrices all pass | None                                                                                   |
| Complete runtime seam lifecycle (QLT-03)                                | Deno injected-clock tests plus built Fresh two-client WebSockets        | AUTOMATED PASS                   | `tests/lifecycle_matrix_test.ts`, `tests/production_multiclient_smoke_test.ts`                        | None                                                                                   |
| Theme, viewport, reduced motion, focus, and safe overflow               | Local Chromium `/snap/bin/chromium`, phone portrait/landscape emulation | AUTOMATED PASS                   | `portal_acceptance_test.ts`: phone tracer and accessible theme/focus row                              | Physical safe-area/browser-chrome behavior remains unobserved; see DEV-01              |
| Reconnect, offline/online, visibility, and recovery                     | Local Chromium plus built loopback Fresh server                         | AUTOMATED PASS                   | `portal_acceptance_test.ts`: reconnect/visibility row; production reconnect smoke                     | Physical background/suspend/resume remains unobserved; see DEV-01                      |
| Catalog, install, and verified launch                                   | Deterministic Deno relay/Blossom doubles and production transport tests | AUTOMATED PASS                   | Phase 4 verification and Phase 9 catalog/authority adversarial evidence                               | Public relay/Blossom interoperability remains unobserved; see LIVE-01                  |
| RESOURCE and UPLOAD                                                     | Deterministic Deno HTTP/Blossom doubles                                 | AUTOMATED PASS                   | Phase 5 verification plus Plan 09-02 adversarial transfer matrix                                      | Public/local operator Blossom interoperability remains unobserved; see LIVE-01         |
| COMMON and STORAGE                                                      | Deno stream, isolation, persistence, and restart tests                  | AUTOMATED PASS                   | Phase 6 verification plus Plan 09-04 state matrix                                                     | Live other-user evolution and target-deployment restart remain unobserved; see LIVE-02 |
| Intent stack, reuse, new tab, history, and popup close                  | Local Chromium plus built loopback Fresh server                         | AUTOMATED PASS                   | `portal_acceptance_test.ts`: history and popup rows                                                   | Physical touch/popup policy remains unobserved; see DEV-02                             |
| Media ownership and revoke-before-grant                                 | Deno built-production two-client WebSocket smoke                        | AUTOMATED PASS                   | `tests/media_transport_smoke_test.ts` via `tests/production_multiclient_smoke_test.ts`                | Does not replace browser playback observation                                          |
| Two-page media ownership in browser                                     | Local Chromium plus built loopback Fresh server                         | NOT RUN — accepted residual risk | MEDIA-01; one bounded closure attempt still stopped at `blob-unavailable` before media creation       | QLT-04 remains incomplete; browser playback/transfer is a release risk                 |
| Physical mobile shell, safe areas, themes, reconnect, and backgrounding | iOS Safari and Android Chrome; device/OS/browser version to be recorded | NOT RUN — accepted residual risk | DEV-01                                                                                                | Device-specific layout and recovery regressions may remain                             |
| Physical intent touch, popup, history, and autoplay behavior            | iOS Safari and Android Chrome; device/OS/browser version to be recorded | NOT RUN — accepted residual risk | DEV-02                                                                                                | Mobile popup/autoplay policy may differ from Chromium automation                       |
| Public relay and public/local Blossom interop                           | Named disposable relay/Blossom endpoints; versions and network recorded | NOT RUN — accepted residual risk | LIVE-01                                                                                               | External interoperability and operator-local cache behavior remain release risks       |
| Live COMMON evolution and durable STORAGE restart                       | Disposable account/data on target deployment                            | NOT RUN — accepted residual risk | LIVE-02                                                                                               | Deployment-specific streaming and persistence behavior remain release risks            |

No `MANUAL PASS` is claimed in this unattended run.

## Residual-risk scripts

All scripts are owned by the release operator. Use only disposable accounts,
manifests, events, blobs, and storage keys. Record date, environment fields, and
observable outcomes only. Never record signer material, reconnect tokens,
authorization headers, private payloads, or secret-bearing paths.

### DEV-01 — Physical shell and reconnect

- **Owner:** Release operator
- **Environment:** One supported iOS Safari device and one supported Android
  Chrome device; record hardware model, OS, browser version,
  viewport/orientation, text scale, reduced-motion setting, and network type.
- **Script:** Start the production build on a TLS-capable test host behind a
  trusted access boundary. Sign in with a disposable account, launch a verified
  disposable napplet, check portrait/landscape safe areas and System/light/dark
  themes, enable reduced motion and text scaling, background for less than and
  greater than reconnect grace, toggle network, resume, and confirm one truthful
  connection sequence without duplicate work.
- **Accepted rationale:** Physical devices are unavailable in the unattended
  environment; D-15 permits explicit residual risk after automated gates pass.
- **Consequence:** Device browser chrome, safe areas, background throttling, and
  recovery remain unobserved.

### DEV-02 — Physical intent and media interaction

- **Owner:** Release operator
- **Environment:** Same physical device matrix as DEV-01; record popup/autoplay
  settings.
- **Script:** With disposable verified caller/handler napplets, exercise reuse,
  stack, and new-tab intents; use Back/Forward, close or block the target, and
  confirm focus recovery. Open two tabs under one disposable account,
  create/play a media session, transfer A→B, confirm A stops before B plays,
  background/close/reconnect, then stop from the non-owner shell.
- **Accepted rationale:** Touch activation, popup policy, and autoplay are
  browser/device judgments unavailable locally.
- **Consequence:** QLT-04 remains incomplete until supported real devices
  successfully exercise this script.

### LIVE-01 — Relay and Blossom interoperability

- **Owner:** Release operator
- **Environment:** Explicit public test relay, public Blossom server, and
  operator-controlled loopback/local Blossom server; record URLs without
  credentials, server versions, and network conditions.
- **Script:** Configure disposable endpoints, install a disposable signed
  manifest, resolve a hash-known resource through local-first then upstream
  fallback, upload disposable bytes to required servers, and verify explicit
  per-server settlement, hash/MIME/size checks, and optional local copy only
  after required remote success.
- **Accepted rationale:** External services were not contacted by the hermetic
  release run.
- **Consequence:** Service-specific protocol, availability, and cache
  interoperability remain unobserved.

### LIVE-02 — Live COMMON and durable STORAGE

- **Owner:** Release operator
- **Environment:** Target deployment, disposable accounts, explicit test relay,
  and isolated temporary storage directory.
- **Script:** Publish disposable profile/follows changes from another account
  and confirm partial then updating COMMON projections. Write shared and
  instance-scoped disposable keys, reconnect, restart the portal, verify
  persistence and isolation, then delete all test data.
- **Accepted rationale:** The release run uses deterministic doubles and
  temporary local persistence rather than live services or a target host.
- **Consequence:** Deployment filesystem semantics and live relay evolution
  remain unobserved.

### MEDIA-01 — Local Chromium media browser closure

- **Owner:** Release operator
- **Environment:** Deno 2.9.4, exact `@playwright/test@1.62.1`,
  `/snap/bin/chromium`, built Fresh server, and an exact verified artifact
  available through the production Blossom boundary.
- **Script:** Run `deno task build`, then
  `deno run -A npm:@playwright/test@1.62.1 test tests/browser/portal_acceptance_test.ts --grep "two browser pages"`.
  Require both pages to receive verified artifacts and observe prior-owner stop
  before successor grant/play.
- **Accepted rationale:** One bounded exact-fixture attempt fixed the
  independent `pinnedFetch` deadlock but the browser path still ended at
  sanitized `blob-unavailable`; the user directed that no further gap loop
  occur.
- **Consequence:** Browser-level cross-tab media playback is not release-proven
  even though the built Deno two-client media smoke passes.
