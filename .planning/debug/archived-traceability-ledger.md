---
status: resolved
trigger: "Post-archive requirement traceability test fails because .planning/REQUIREMENTS.md is removed."
created: 2026-07-31
updated: 2026-07-31T00:09:00Z
---

# Debug Session: Archived Traceability Ledger

## Symptoms

- Expected: `deno task test` passes both while a milestone is active and after
  `gsd-complete-milestone` archives its requirements ledger.
- Actual: `tests/requirement_traceability_test.ts` hard-codes
  `.planning/REQUIREMENTS.md`, so post-cleanup execution fails with file not
  found.
- Error: missing `.planning/REQUIREMENTS.md` during the traceability test.
- Timeline: introduced when the v1.1 traceability test was added; exposed only
  after milestone cleanup removed the active requirements file.
- Reproduction: run `deno test -A tests/requirement_traceability_test.ts` after
  v1.1 archival.

## Current Focus

- hypothesis: the traceability test assumed the transient active-ledger path survives milestone cleanup
- test: active and archived lifecycle layouts plus the complete repository gate
- expecting: active layout wins when present; otherwise the newest numeric complete archived ledger pair is selected
- next_action: resolved
- bug_class: bohrbug
- reasoning_checkpoint:
    hypothesis: the test's unconditional active-path read causes NotFound after cleanup because the canonical v1.1 files move to versioned archive paths
    confirming_evidence:
      - exact test fails at the active requirements read before parsing
      - explicit archived v1.1 pair parses to 33 IDs with every error collection empty
    falsification_test: if an active-first pinned-v1.1 resolver still fails on the archived-only checkout, the hypothesis is wrong
    fix_rationale: prefer the active ledger, then select the newest complete archived requirements/roadmap pair by numeric milestone version
    blind_spots: no concurrent cleanup during a single test run is modeled; repository tests assume a stable checkout
    candidate_causes:
      - code: hard-coded active-only test fixture path
      - environment/config: milestone cleanup lifecycle removes active ledger and creates versioned archive pair
    and_gate: no; the code assumption alone explains the deterministic failure under the valid archived layout

## Evidence

- timestamp: 2026-07-31T00:01:00Z
  checked: exact reproduction command against current checkout
  found: test fails deterministically with NotFound at tests/requirement_traceability_test.ts:5 while reading `.planning/REQUIREMENTS.md`; parser is never invoked
  implication: failure is at test fixture path resolution, not traceability parser logic or archived ledger contents
- timestamp: 2026-07-31T00:02:00Z
  checked: git history, test name/oracle, and milestone archive layout
  found: the test is explicitly named for 33 v1.1 requirements; cleanup archived the matching pair as `v1.1-REQUIREMENTS.md` and `v1.1-ROADMAP.md`
  implication: fallback must be pinned to v1.1 rather than selecting an arbitrary newest archived milestone
- timestamp: 2026-07-31T00:03:00Z
  checked: first archived-pair parser probe
  found: Deno 2.9 `eval` rejected the obsolete `--allow-read` flag before executing code
  implication: this is a probe-command error, not evidence for or against the hypothesis; rerun with supported syntax
- timestamp: 2026-07-31T00:04:00Z
  checked: parser result using the explicit archived v1.1 requirements and roadmap pair
  found: parser returned exactly 33 IDs and empty duplicates, unmapped, illegalStatuses, roadmapMismatches, and claimContradictions
  implication: archived content is valid and directly falsifies parser/data-corruption alternatives
- timestamp: 2026-07-31T00:06:00Z
  checked: target test after applying the resolver and lifecycle boundary coverage
  found: all 3 focused tests pass, including the original 33-ID assertion and active/archive resolver cases
  implication: the fix addresses the reproduced failure and preserves both required lifecycle states
- timestamp: 2026-07-31T00:07:00Z
  checked: static quality gate and adjacent contract-registry test
  found: `deno task check` passes 138 formatted files, 134 linted files, and type-checking; contract parity passes 4/4
  implication: the change is type-safe, formatted, lint-clean, and does not regress the parser's adjacent contract registry behavior
- timestamp: 2026-07-31T00:08:00Z
  checked: revert-and-reconfirm guardrail
  found: removing only the resolver restored the exact NotFound failure; reapplying it restored 3/3 passing focused tests
  implication: the patch is causally responsible for fixing the archived-layout failure
- timestamp: 2026-07-31T00:09:00Z
  checked: repository-wide non-browser test suite
  found: `deno task test` completed successfully after the traceability test entered the suite with all three cases green
  implication: no held-out non-browser regression was introduced
- timestamp: 2026-07-31T08:50:00Z
  checked: archive fallback version selection
  found: active layout wins; archived v1.10 wins over v1.2; incomplete v2.0 requirements without a matching roadmap is ignored
  implication: the fix survives future milestone archival without hard-coding v1.1 or weakening the 33-ID oracle

## Eliminated

## Resolution

- root_cause: `tests/requirement_traceability_test.ts` unconditionally reads the transient active requirements path, although milestone cleanup moves the v1.1 ledger pair to stable versioned archive paths.
- fix: added an active-first resolver with deterministic numeric selection of the newest complete archived requirements/roadmap pair and lifecycle boundary tests
- oracle_type: specified
- verification:
    target_test: { result: pass }
    mutation_check: { result: skipped, reason_if_skipped: "Stryker is not configured or installed in this Deno repository", mutant_killed: null }
    no_op_deletion: { result: pass, deletion_justified_by_rca: false }
    adjacent_tests: { result: pass, suites_run: ["deno task check", "tests/contract_parity_test.ts", "deno task test"] }
    revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
    guardrail_verdict: accepted
- files_changed: [tests/requirement_traceability_test.ts]
