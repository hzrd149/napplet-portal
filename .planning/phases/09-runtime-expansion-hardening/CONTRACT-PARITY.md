# Pinned NAP Contract Parity

Generated from `tests/fixtures/v1_1_contract_matrix.json` and joined exactly to
`runtime/nap_contract_registry.ts`. Package authority is pinned
`@napplet/core@0.31.0` / `@napplet/nap@0.31.0`; sibling sources are not imported.

## Release verdict

**PASS — 100 canonical discriminants, 100 registered rows, 10 domains, 0 blockers.**

`SILENT_IGNORE` is not a legal disposition. Missing, invented, wrong-direction,
missing-evidence, advertised-unsupported, and unadvertised-grant rows throw from
`auditContractParity` and are exercised by `tests/contract_parity_test.ts`.

| Domain | Napplet → runtime | Runtime → napplet | Total | Owner evidence |
| --- | ---: | ---: | ---: | --- |
| SHELL | 1 | 1 | 2 | `createIframeBridge`; iframe bridge tests |
| IDENTITY | 9 | 10 | 19 | portal window runtime; runtime contract tests |
| RELAY | 5 | 6 | 11 | `RelayAdapter`; tracer end-to-end tests |
| OUTBOX | 6 | 6 | 12 | `OutboxAdapter`; identity service tests |
| RESOURCE | 4 | 6 | 10 | `NapDispatcher`; dispatcher tests |
| UPLOAD | 3 | 4 | 7 | `NapDispatcher`; dispatcher tests |
| COMMON | 8 | 8 | 16 | `CommonService`; COMMON integration tests |
| STORAGE | 4 | 4 | 8 | `StorageService`; storage integration tests |
| INTENT | 3 | 4 | 7 | `IntentService`; production intent tests |
| MEDIA | 5 | 3 | 8 | media authority reducer; transport smoke tests |

Every row records package source, literal discriminant, direction, domain grant,
decoder, process owner, terminal semantics, requirement IDs, named test evidence,
advertisement state, and one legal disposition. Declaration extraction tests compare
all nine `@napplet/nap` domain fixtures directly with installed pinned `types.d.ts`;
the SHELL handshake is sourced from the pinned core envelope plus the portal bridge.

## Requirement ledger observation

All 33 v1.1 IDs occur once in REQUIREMENTS traceability and once in the matching
ROADMAP phase. Status vocabulary is closed to `Complete` / `Pending`. Thirteen
already-checked requirements still say `Pending` in the traceability table:
CAT-01..04, COM-01..02, STO-01..03, and MED-01..04. This contradiction is reported,
not rewritten here; final Phase 9 reconciliation owns completion-state edits.

Unselected domains (including NOTIFY, LINK, INC, CONFIG, KEYS, VALUE, and POW) are
outside the ten-domain v1.1 registry and therefore receive no manifest grant or
advertisement.
