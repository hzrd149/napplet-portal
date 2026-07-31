# Phase 9 UAT Matrix

**Evidence date:** 2026-07-31  
**Allowed statuses:** `AUTOMATED PASS`, `MANUAL PASS`, `NOT RUN — accepted residual risk`

This ledger separates executable evidence from observations that require a physical device or live external service. A `NOT RUN — accepted residual risk` row is not a pass and does not satisfy requirement wording that explicitly requires that observation.

| Area | Acceptance surface | Status | Evidence / residual-risk record |
|---|---|---|---|
| Contract parity | QLT-01: pinned 0.31.0 contracts and production dispatcher parity across ten domains | AUTOMATED PASS | `tests/contract_parity_test.ts`; 100 canonical rows, closed dispositions, and reference-only sibling repositories. |

## Residual-risk script rules

- Use only disposable accounts, manifests, events, blobs, and storage keys.
- Record device, OS/browser version, endpoint class, date, and observable outcome only.
- Never record signer material, reconnect tokens, authorization headers, private payloads, or local secret-bearing paths.

