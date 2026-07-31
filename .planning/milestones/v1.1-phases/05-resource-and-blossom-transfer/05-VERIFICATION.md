---
phase: 05-resource-and-blossom-transfer
verified: 2026-07-31T03:19:00Z
status: passed
score: 10/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps: []
re_verification:
  previous_status: passed
  previous_score: 10/10
  gaps_closed:
    - "The built-server reconnect smoke now passes after unchanged empty catalog projections stopped synchronously notifying projection-reading subscribers."
    - "The canonical workspace check passes after the repository-local verifier cache was removed from deno check discovery."
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "Public/local Blossom interoperability and physical mobile-browser behavior are observed on real services/devices."
    addressed_in: "Phase 9"
    evidence: "Phase 9 success criterion 4 and 09-05 explicitly retain public/local Blossom and physical-device rows as NOT RUN — accepted residual risk under unattended acceptance."
---

# Phase 5: Resource and Blossom Transfer Verification Report

**Phase Goal:** Napplets can resolve bounded resources and upload blobs through backend-owned Blossom policy.
**Verified:** 2026-07-31T03:19:00Z
**Status:** passed
**Re-verification:** Yes — prior goal evidence regression-checked after commits `d9ab1fd` and `b0cbc65`; both recorded workspace caveats are closed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | A napplet can inspect canonical RESOURCE and UPLOAD availability and backend limits. | ✓ VERIFIED | `TRANSFER_POLICY` drives exact `resource.info`/`upload.info` envelopes; `binary_transport_test.ts` and `nap_dispatcher_test.ts` passed. |
| 2 | HTTP(S), Blossom, and BUD-10-style hash reads are bounded by scheme, redirect, destination, MIME, size, timeout, and integrity policy. | ✓ VERIFIED | `ResourceDestinationPolicy`, `pinnedFetch`, and `ResourceService` authorize and pin every hop, manually redirect, stream-limit, sniff MIME, and hash bytes. All 3 policy and all 6 service tests passed. |
| 3 | Blossom reads try the exact configured loopback cache before public upstreams without trusting cache bytes. | ✓ VERIFIED | `ResourceService.#blossomRead` orders local then upstream candidates and verifies SHA-256 before release; all 4 cache tests and the corrupt-cache fallback service test passed. |
| 4 | Uploads use the exact reviewed SDK pin with backend signer authority and expose required/partial/local outcomes canonically. | ✓ VERIFIED | `deno.json`/lock pin `blossom-client-sdk@5.0.0`; adapter scopes kind-24242 auth, pins destinations, verifies descriptors, and service emits ordered bounded tokens. All 6 transfer tests passed. |
| 5 | Binary content crosses iframe/WebSocket boundaries without JSON/base64 expansion or ownership escape. | ✓ VERIFIED | Binary codec binds kind, ID, declared length and socket owner; all 6 binary transport tests passed. |
| 6 | Production resource metadata and binary bytes are assembled exactly once with observed MIME for single and mixed-batch results. | ✓ VERIFIED | `ResourceBinaryAssembler` correlates metadata and payload frames; rewritten behavioral PNG/mixed-batch integration assertions in `end_to_end_test.ts` passed. |
| 7 | Upload optional request metadata survives the binary boundary. | ✓ VERIFIED | `encodeUploadPayload` carries bounded metadata and `routes/api/runtime.ts` reconstructs it before dispatcher execution; binary and end-to-end tests passed. |
| 8 | Required upload destinations are public HTTPS/443 and DNS-authorized before signing and network use; the only private exception is the exact local cache origin. | ✓ VERIFIED | `BlossomTransferAdapter.uploadRequired` uses `ResourceDestinationPolicy` and passes approved addresses to the pinned connector; policy and transfer tests passed. |
| 9 | Required-server partial/full failure and optional-local success/failure remain explicit and ordered without contract extension fields. | ✓ VERIFIED | Four settlement matrices assert `ok`, terminal status, URL ordering, exact sanitized tokens, descriptor matching, and closed fields in `blossom_transfer_test.ts`; all passed. |
| 10 | Cancellation, quotas, expiry, shutdown, and upload status are owner-scoped and do not leak late or foreign results. | ✓ VERIFIED | The named dispatcher cancellation/expiry test, quota test, scoped-status test, and WebSocket ownership tests passed. |

**Score:** 10/10 truths verified (0 present but behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|---|---|---|
| 1 | Live public/local Blossom interoperability and physical mobile observations | Phase 9 | `09-05-PLAN.md` requires an honest UAT matrix and explicitly labels unrun physical/live rows `NOT RUN — accepted residual risk`; these are not automated Phase 5 implementation gaps. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `runtime/transport.ts`, `runtime/binary_transport.ts` | Closed pinned envelopes and bounded binary codec | ✓ VERIFIED | Substantive, imported by browser/server transport, and behavior-tested. |
| `runtime/resource_policy.ts`, `runtime/pinned_fetch.ts` | Every-hop SSRF policy and address-pinned connection | ✓ VERIFIED | Public/forbidden/mixed DNS and exact-cache cases tested; approved addresses flow into Undici lookup. |
| `runtime/resource_service.ts`, `runtime/blossom_cache.ts` | Bounded HTTP/Blossom resolution and local-first cache | ✓ VERIFIED | Real streamed byte flow, hash/MIME validation, shared deadline, fallthrough and artifact consumers verified. |
| `runtime/blossom_transfer.ts` | Backend-authorized multi-server transfer | ✓ VERIFIED | Exact SDK adapter, destination policy, descriptor validation, bounded settlement and retained status are wired. |
| `runtime/nap_dispatcher.ts`, `runtime/portal_runtime.ts`, `runtime/catalog.ts`, `main.ts` | Process ownership, reactive projection, and lifecycle | ✓ VERIFIED | Singleton services feed dispatcher; window expiry/shutdown invoke abort/cleanup; unchanged empty catalog reads are idempotent and cannot crash the built runtime through synchronous listener feedback. |
| `routes/api/runtime.ts`, `islands/NappletShell.tsx` | WebSocket/iframe control and binary seam | ✓ VERIFIED | Canonical controls, upload metadata, response metadata, binary payloads and owner correlation are wired and behavior-tested. |
| `tests/catalog_test.ts`, `tests/runtime_reconnect_smoke_test.ts` | Regression proof for production reconnect startup | ✓ VERIFIED | The focused projection-read regression and built Fresh server reconnect smoke both passed in the independently run 169-test workspace suite. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Verified iframe | backend dispatcher | source-bound bridge, strict codec, owned WebSocket frames | ✓ WIRED | Normal single, batch, info, upload and status actions reach the dispatcher. |
| Resource service | outbound destination | authorize every hop then `pinnedFetch(...approvedAddresses)` | ✓ WIRED | DNS validation constrains the connector address, closing the review's rebinding gap. |
| Blossom request | local then upstream | exact cache candidate followed by canonical public servers | ✓ WIRED | Hash is checked before Blob release and corrupt/missing local data falls through. |
| Active backend account | Blossom servers | `PortalAccounts.signEvent` -> adapter auth -> pinned upload | ✓ WIRED | Signer authority stays process-side and every descriptor is validated. |
| Window lifecycle | in-flight work/status | `destroyWindow` -> `abortWindow` / owner cleanup | ✓ WIRED | Named cancellation, grace, quota, shutdown and foreign-status tests passed. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `NappletShell.tsx` | RESOURCE Blob(s) | server metadata plus correlated binary frames | Yes; MIME and payload reconstructed exactly once | ✓ FLOWING |
| `ResourceService` | bounded bytes/Blob | pinned fetch stream or local/upstream Blossom candidate | Yes; incremental hash, size and MIME checks precede release | ✓ FLOWING |
| `BlossomTransferService` | UploadResult/UploadStatus | per-server verified SDK descriptors and sanitized failures | Yes; ordered required and optional-local outcomes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full automated workspace suite | `DENO_DIR=$PWD/.deno deno task test` | `169 passed, 0 failed`; the built Fresh server reconnect smoke passed in 51 seconds | ✓ PASS |
| Formatting/lint/type gate | `deno task check` | Exit 0 after moving the repository-local verifier cache out of `deno check` discovery; 96 files formatted, 93 linted, all project modules type-checked | ✓ PASS |
| Phase 5 behavioral set | Same full-suite run (single execution) | 6 binary + 3 policy + 6 service + 4 cache + 6 transfer + 3 dispatcher + 4 end-to-end + related contract/ownership tests passed | ✓ PASS |
| Catalog feedback regression | Same full-suite run | `reading an unchanged catalog projection does not notify listeners` passed; the built runtime no longer overflows through `sendCatalog -> project -> refresh -> notify` | ✓ PASS |

The previous smoke caveat was a real runtime defect rather than unrelated infrastructure: an unchanged empty catalog projection synchronously notified a listener that read the projection again, overflowing the production server stack before reconnect. Commit `d9ab1fd` makes empty projection reads idempotent and adds a focused regression; the independent 169/169 run confirms both that regression and the production reconnect smoke. The prior check caveat was caused by a verifier-created `.deno` cache inside the repository being included by bare `deno check`; with that generated cache moved out of discovery, the canonical check exits 0.

### Probe Execution

No Phase 5 PLAN or SUMMARY declares a probe script, and no applicable `probe-*.sh` exists. **SKIPPED (no phase probe).**

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|---|---|---|---|
| RES-01 | 05-01, 05-04 | ✓ SATISFIED | Exact backend-derived RESOURCE info envelope and dispatcher tests. |
| RES-02 | 05-01, 05-02, 05-04 | ✓ SATISFIED | Production binary result assembly plus HTTPS/hash/batch policy tests. |
| RES-03 | 05-02, 05-04 | ✓ SATISFIED | Local-first candidates, every-hop policy, hash/MIME/size/deadline validation and fallthrough tests. |
| UPL-01 | 05-01, 05-04 | ✓ SATISFIED | Exact UPLOAD info and byte-bearing request transport including optional metadata. |
| UPL-02 | 05-03, 05-04 | ✓ SATISFIED | Exact SDK pin, backend signer, destination-pinned upload and descriptor validation. |
| UPL-03 | 05-03, 05-04 | ✓ SATISFIED | All four required/optional-local settlement matrices and owner-scoped status. |

No Phase 5 requirement is orphaned.

### Anti-Patterns Found

No unreferenced `TBD`, `FIXME`, or `XXX`, placeholder implementation, hardcoded user-visible empty result, or console-only handler was found in the Phase 5 production/test files. Parser `return null`/`[]` sites are deliberate fail-closed branches, not stubs.

### Human Verification Required

None for the automated Phase 5 goal under the user's unattended acceptance. Public/local Blossom interoperability and physical-device/mobile-network observations are **Phase 9 NOT RUN residual UAT** and are not represented as executed passes here.

### Disconfirmation Pass

- **Potential partial requirement checked:** normal RESOURCE traffic originally handled only a fixed tracer; current code now registers metadata for arbitrary single/batch results and the behavioral PNG/mixed-batch test passes.
- **Potential misleading test checked:** the former source-string “end-to-end” assertion was replaced; the current test invokes `ResourceBinaryAssembler` with real encoded frames and validates MIME/bytes/exact-once assembly. It is still a component integration harness, not a live browser/server observation.
- **Uncovered error path considered:** live public Blossom/network interoperability is intentionally not exercised by deterministic tests and remains Phase 9 residual UAT; no automated Phase 5 must-have depends on claiming that observation occurred.

### Gaps Summary

No Phase 5 implementation gap remains. All ten merged roadmap/plan truths and RES-01..03/UPL-01..03 retain substantive, wired, behavioral evidence. The formerly failing built-server reconnect smoke is now green inside a 169/169 workspace run, and the canonical formatting/lint/type gate exits 0. Live external Blossom and physical mobile checks remain explicitly **NOT RUN** Phase 9 residual UAT under the accepted unattended policy.

---

_Verified: 2026-07-31T03:19:00Z_
_Verifier: the agent (gsd-verifier)_
