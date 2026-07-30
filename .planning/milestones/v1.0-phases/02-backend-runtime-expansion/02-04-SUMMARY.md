---
phase: 02-backend-runtime-expansion
plan: "04"
subsystem: backend-runtime
tags: [deno, nostr, nip-78, catalog, artifact-integrity]
requires:
  - phase: 02-backend-runtime-expansion
    plan: "02"
    provides: policy-safe relay publication and shared EventStore
  - phase: 02-backend-runtime-expansion
    plan: "03"
    provides: integrity-verified manifest and Blossom artifact resolution
provides:
  - Account-owned signed kind-30078 installed catalog codec and projection
  - Serialized accepted-manifest approval and uninstall replacement mutations
  - Browser-safe launch identity derived only from integrity-verified artifacts
affects: [02-05-settings-ui, 02-06-runtime-integration, catalog-ui, napplet-launch]
tech-stack:
  added: []
  patterns: [exact-public-codec, accepted-manifest-pinning, serialized-replacement-mutation]
key-files:
  created: [runtime/catalog.ts, tests/catalog_test.ts]
  modified: [runtime/artifacts.ts, runtime/portal_runtime.ts, runtime/transport.ts]
key-decisions:
  - "Public catalog content is an exact versioned codec containing only coordinate and accepted manifest event ID."
  - "Catalog mutations serialize per service, re-read the latest active-account replacement, and advance local projection only after every required relay accepts."
  - "Browser launch identity is projected only after the exact accepted manifest event ID crosses the existing verified artifact boundary."
requirements-completed: [V2-01, V2-09, V2-10]
coverage:
  - id: D1
    description: "Signed account-owned kind-30078 replacements reject malformed, foreign, incorrectly tagged, secret-bearing, and invalid-signature content."
    requirement: V2-09
    verification:
      - kind: unit
        ref: "tests/catalog_test.ts#catalog codec rejects malformed, foreign, unsigned, and secret-bearing public content"
        status: pass
    human_judgment: false
  - id: D2
    description: "Latest valid active-account replacement projects launch metadata only from the exact accepted integrity-verified manifest."
    requirement: V2-01
    verification:
      - kind: integration
        ref: "tests/catalog_test.ts#latest valid replacement is isolated to active account and projects verified accepted identity"
        status: pass
    human_judgment: false
  - id: D3
    description: "Approval remains pinned until full relay settlement and reports partial publication without advancing the accepted catalog."
    requirement: V2-10
    verification:
      - kind: integration
        ref: "tests/catalog_test.ts#approval serializes current projection, pins launch until settlement, and reports partial publish"
        status: pass
    human_judgment: false
  - id: D4
    description: "Concurrent mutations re-read the latest projection while uninstall publishes replacement state without deleting cached artifacts."
    requirement: V2-09
    verification:
      - kind: integration
        ref: "tests/catalog_test.ts#concurrent updates re-read latest projection; absent signer and uninstall are safe"
        status: pass
    human_judgment: false
duration: 10min
completed: 2026-07-30
status: complete
---

# Phase 2 Plan 4: Accepted-Manifest Catalog Summary

**A defensive signed NIP-78 catalog now serializes active-account replacements and exposes launch identity only from the exact accepted, integrity-verified manifest.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-30T20:26:41Z
- **Completed:** 2026-07-30T20:36:41Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- Added an exact public catalog codec for signed kind-30078 events with active-author, signature, exact `d` tag, NIP-5A coordinate, accepted event ID, duplicate, and unknown-field validation.
- Added latest-replacement loading and browser-safe projection whose title, version, capabilities, and launch data come only from the exact accepted verified artifact.
- Added serialized approval and uninstall commands that re-read current state, sign backend-created templates, await typed relay settlement, and advance local state only after complete acceptance.
- Integrated catalog projection and correlated commands into the runtime service hub and added exact accepted-event matching to artifact resolution.
- Passed the 76-test repository suite, focused tracer suite, formatting, lint, and TypeScript checks.

## Task Commits

1. **RED: Catalog lifecycle and security contracts** - `726e8a7` (test)
2. **GREEN: Accepted-manifest catalog runtime** - `bf7bf25` (feat)

## Files Created/Modified

- `runtime/catalog.ts` - Exact codec, loading, verified projection, serialized mutations, signing, and typed settlement.
- `runtime/artifacts.ts` - Rejects resolved manifests that differ from an accepted event ID.
- `runtime/portal_runtime.ts` - Exposes browser-safe catalog projection and correlated catalog commands through the service hub.
- `runtime/transport.ts` - Defines and defensively decodes catalog approval and uninstall commands.
- `tests/catalog_test.ts` - Covers zero/one/many loading, malformed and foreign inputs, latest replacement, signer absence, partial publication, accepted pinning, concurrent mutation, iframe identity exclusion, approval, and uninstall.

## Decisions Made

- Fail closed on all unknown public catalog fields so secrets or capability approvals cannot silently enter kind-30078 content.
- Keep the accepted manifest ID unchanged until every required relay reports acceptance; partial settlement is observable failure, not local success.
- Treat uninstall as a catalog replacement only; content-addressed artifacts remain under normal cache lifecycle.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed lint-only unused publish parameter**
- **Found during:** Task 1 GREEN verification
- **Issue:** The partial-publish test callback retained an unused parameter and failed the repository lint gate.
- **Fix:** Marked the intentionally unused parameter explicitly and reran focused and full verification.
- **Files modified:** `tests/catalog_test.ts`
- **Verification:** `deno task check`
- **Commit:** `bf7bf25`

**Total deviations:** 1 auto-fixed bug. **Impact:** No scope or runtime behavior change; all quality gates pass.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None - the new public-event, browser-command, signer, and artifact trust boundaries are covered by T-02-09 through T-02-11 in the plan threat model.

## Verification

- `deno test -A tests/catalog_test.ts tests/artifact_resolver_test.ts tests/runtime_contract_test.ts` — 9 passed, 0 failed.
- `deno task check` — formatting, lint, and TypeScript checks passed.
- `deno test -A` — 76 passed, 0 failed.
- Tracer feedback gate reran the focused suite and static gate successfully before expansion/close-out.

## Self-Check: PASSED

- Both created artifacts and all three modified integration files exist.
- RED commit `726e8a7` and GREEN commit `bf7bf25` exist in git history.
- Every task acceptance case and the plan-level verification commands pass.

## Next Phase Readiness

- The settings/catalog UI can consume the browser-safe projection and invoke correlated approval/uninstall commands without accepting iframe metadata as authority.
- Runtime integration can wire relay synchronization into `CatalogService.load` while preserving the exact codec and EventStore replacement semantics.
- No blockers.

---
*Phase: 02-backend-runtime-expansion*
*Completed: 2026-07-30*
