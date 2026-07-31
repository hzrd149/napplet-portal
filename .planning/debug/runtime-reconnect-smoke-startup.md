---
status: awaiting_human_verify
trigger: "Diagnose and fix deterministic failure in tests/runtime_reconnect_smoke_test.ts: built server never accepts selected port, ConnectionRefused at connectRuntime after Phase5 review fixes/current master."
created: 2026-07-31T03:07:53+00:00
updated: 2026-07-31T03:26:00+00:00
---

## Current Focus

bug_class: bohrbug
reasoning_checkpoint:
  hypothesis: CatalogService.project causes the server crash because its refresh of an already-empty projection synchronously notifies the endpoint listener, whose callback calls project again without a state change, recursing until stack overflow.
  confirming_evidence:
    - built-server stderr directly reports Maximum call stack size exceeded along sendCatalog -> CatalogService.project -> refresh -> notify -> sendCatalog
    - focused unit regression reproduces the same stack overflow when a listener reads project after notification
  falsification_test: if suppressing notifications for unchanged empty projections does not make both the focused unit regression and production reconnect smoke pass, this hypothesis is wrong or incomplete
  fix_rationale: make refresh emit only when the empty projection actually changes, preserving reactive notifications while making projection reads idempotent
  blind_spots: same-event non-empty projection refresh may have a related idempotence issue, but it is not required for the reported no-catalog crash and existing catalog tests cover enrichment behavior
  candidate_causes:
    - code: synchronous feedback loop between a projection read and change notification
    - environment: restored account data supplies an active identity while EventStore has no catalog, selecting the empty-event branch; environment alone was disproved because the standalone server stays healthy until WebSocket catalog projection
  and_gate: no; the code-level unconditional notification fully explains the crash, while restored account data only selects a valid input state that production must support
next_action: parent orchestrator reviews the committed Phase 5 gap fix and verification evidence

## Symptoms

expected: the built Fresh server accepts the test-selected loopback port and the reconnect smoke client establishes its runtime connection
actual: the built server never accepts the selected port; connectRuntime ends with ConnectionRefused
errors: ConnectionRefused at connectRuntime in tests/runtime_reconnect_smoke_test.ts
reproduction: run tests/runtime_reconnect_smoke_test.ts on current master after the Phase 5 review fixes
started: after Phase 5 review fixes/current master; exact introducing commit not yet confirmed

## Eliminated

- hypothesis: built production server always exits after the first GET / request
  evidence: direct production child remained alive and accepted a second HTTP connection after readiness
  timestamp: 2026-07-31T03:13:20+00:00
- hypothesis: selected port, bind parsing, or readiness cancellation prevents the server from listening
  evidence: exact standalone Deno spawn/fetch-cancel probe connected successfully after readiness on the selected port
  timestamp: 2026-07-31T03:15:00+00:00

## Evidence

- timestamp: 2026-07-31T03:07:53+00:00
  checked: user-provided reproduction report
  found: failure is deterministic and occurs before the server accepts its selected port
  implication: classify provisionally as a Bohrbug and inspect startup/child-process failure before transport behavior
- timestamp: 2026-07-31T03:11:30+00:00
  checked: unchanged focused smoke test with DENO_DIR=/tmp/tmp.cWkhDx6fAY/deno-cache
  found: waitForHttp returned successfully, then connectRuntime received ConnectionRefused immediately afterward at line 64; total runtime was 17 seconds
  implication: the server did bind and answer GET /, but stopped listening between readiness and WebSocket connection; a simple initial bind failure is eliminated
- timestamp: 2026-07-31T03:13:20+00:00
  checked: direct `deno task start` on fixed port 43127 followed by ordinary HTTP requests
  found: process remained alive after readiness and accepted a subsequent connection to /api/runtime (403 without WebSocket headers)
  implication: production server startup and bind are healthy outside the Deno test harness; the fatal-readiness hypothesis is disproved for an ordinary HTTP client
- timestamp: 2026-07-31T03:15:00+00:00
  checked: exact standalone Deno child plus fetch body cancellation and subsequent TCP connect
  found: child remained alive and accepted the connection
  implication: readiness cancellation and child process mechanics are eliminated
- timestamp: 2026-07-31T03:17:00+00:00
  checked: smoke child stderr captured concurrently
  found: first WebSocket opens, then uncaught RangeError Maximum call stack size exceeded follows sendCatalog -> CatalogService.project -> CatalogService.#refresh -> CatalogService.#notify recursively
  implication: ConnectionRefused is secondary; unconditional catalog notifications crash the server before reconnect
- timestamp: 2026-07-31T03:19:00+00:00
  checked: agent-authored focused catalog regression with a subscriber that reads the projection
  found: test fails before fix with the same synchronous stack overflow
  implication: root cause is reproduced at unit scope with a derived reactive-contract oracle

## Resolution

root_cause: CatalogService.#refresh unconditionally notifies listeners when the effective projection remains EMPTY; the runtime listener responds by reading project(), creating a synchronous notification/read feedback loop that overflows the stack and terminates the production server.
fix: Guard both no-identity and no-event refresh branches so they reset and notify only when the projection actually transitions to EMPTY; add a unit regression for subscriber projection reads and retain child stdout/stderr so future smoke failures expose the server cause.
verification:
  target_test: { result: pass }
  mutation_check: { result: skipped, reason_if_skipped: "Stryker is not configured in this Deno repository", mutant_killed: false }
  no_op_deletion: { result: pass, deletion_justified_by_rca: false }
  adjacent_tests: { result: pass, suites_run: ["tests/catalog_test.ts", "deno task check", "deno task test (169 tests)"] }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
  guardrail_verdict: accepted
files_changed: [runtime/catalog.ts, tests/catalog_test.ts, tests/runtime_reconnect_smoke_test.ts]
oracle_type: derived
