---
phase: 09-runtime-expansion-hardening
plan: "02"
subsystem: security
tags: [deno, ssrf, websocket, binary-transfer, tdd]
requires:
  - phase: 09-runtime-expansion-hardening
    provides: exhaustive pinned NAP contract parity and release-blocking adversarial baseline
provides:
  - zero-red-row hostile URL, redirect, transport, and transfer matrix
  - generation-bound binary transfer correlations
  - strict outer runtime envelopes and non-empty resource batches
affects: [runtime-transport, resource-policy, upload-transfer, release-gates]
tech-stack:
  added: []
  patterns: [effect-first hostile boundary assertions, generation-bound correlation keys, sanitized stable errors]
key-files:
  created: [tests/adversarial_transport_transfer_test.ts]
  modified: [runtime/binary_transport.ts, runtime/resource_service.ts, runtime/transport.ts, routes/api/runtime.ts]
key-decisions:
  - "Binary correlation ownership includes the authenticated socket attachment generation while retaining compatibility for generation-less local consumers."
  - "Runtime forwarding accepts only the closed outer envelope, and resource batches must contain at least one request."
patterns-established:
  - "Adversarial rows assert absence of fetch, upload, settlement, and disclosure effects before checking stable public error shape."
  - "Transfer registries validate correlation IDs and generation values at both open and settle boundaries."
requirements-completed: [QLT-02, QLT-03]
coverage:
  - id: D1
    description: "Hostile URL and redirect inputs fail closed before private network effects and expose only sanitized errors."
    requirement: QLT-02
    verification:
      - kind: unit
        ref: "tests/adversarial_transport_transfer_test.ts#URL and redirect matrix rejects ambiguity and revalidates every hop"
        status: pass
    human_judgment: false
  - id: D2
    description: "Malformed, duplicate, stale, foreign, oversized, empty, late, and post-shutdown transfer inputs have zero unauthorized effect."
    requirement: QLT-03
    verification:
      - kind: integration
        ref: "deno test -A tests/adversarial_transport_transfer_test.ts tests/resource_policy_test.ts tests/resource_service_test.ts tests/binary_transport_test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The complete repository remains green after transport and transfer hardening."
    requirement: QLT-03
    verification:
      - kind: integration
        ref: "deno task test && deno task check"
        status: pass
    human_judgment: false
duration: 6min
completed: 2026-07-31
status: complete
---

# Phase 09 Plan 02: Transport and Transfer Adversarial Hardening Summary

**A zero-red-row hostile boundary matrix now blocks private URL effects, malformed transfer envelopes, and stale binary settlements while preserving sanitized ordered results.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-31T06:05:53Z
- **Completed:** 2026-07-31T06:11:37Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added five focused adversarial scenarios covering private URLs, redirect revalidation, strict controls, malformed binary frames, correlation lifecycle, empty batches, and mixed settlement.
- Bound active binary requests to exact connection, window, and attachment generation and carried authenticated generation through both binary route paths.
- Rejected extra runtime envelope fields, invalid correlation identities, and empty resource batches without weakening existing policy behavior.

## Task Commits

1. **Task 1: Trace one hostile resource request to a sanitized zero-effect denial** - `80db392` (RED), `e9490ea` (GREEN)
2. **Task 2: Exhaust URL, redirect, binary, and transfer adversarial rows** - `c6b8c44` (RED), `c15603c` (GREEN)

## Files Created/Modified

- `tests/adversarial_transport_transfer_test.ts` - Mandatory hostile boundary matrix with effect-first and disclosure assertions.
- `runtime/binary_transport.ts` - Generation-bound, validated active request ownership.
- `runtime/resource_service.ts` - Closed non-empty batch boundary.
- `runtime/transport.ts` - Strict outer runtime forwarding envelope.
- `routes/api/runtime.ts` - Authenticated attachment generation propagation across binary paths.

## Decisions Made

- Kept generation optional on the shared owner type for compatibility with isolated codec consumers, while production sockets always supply the authenticated attachment generation.
- Used the existing stable `ResourceServiceError` vocabulary for every denial so destinations, paths, response bodies, and secrets never enter projections.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The expanded RED matrix exposed three mandatory failures: extra outer fields were accepted, invalid generation/correlation identities could enter the active registry, and empty service batches succeeded. All were remediated within the declared owner files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Transport, URL policy, redirects, binary frames, and RESOURCE batch boundaries have zero mandatory red rows. Downstream Phase 09 work can build on exact generation ownership and stable sanitized errors.

## Self-Check: PASSED

- Created adversarial matrix exists and all 20 focused/existing transport-transfer tests pass.
- RED and GREEN commits `80db392`, `e9490ea`, `c6b8c44`, and `c15603c` exist.
- Full `deno task test` and `deno task check` pass.

---
*Phase: 09-runtime-expansion-hardening*
*Completed: 2026-07-31*
