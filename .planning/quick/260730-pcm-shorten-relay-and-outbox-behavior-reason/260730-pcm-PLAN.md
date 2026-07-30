---
quick_id: 260730-pcm
status: executing
---

# Shorten Phase 01 API coverage reasons

## Task 1: Repair the coverage matrix

- **Files:** `.planning/phases/01-one-day-napplet-runtime-mvp/COVERAGE.md`
- **Action:** Condense the RELAY and OUTBOX behavior cells below the gate's 200-character limit without changing their capability decisions or runtime semantics.
- **Verify:** Run `check api-coverage.verify-pre` against the Phase 01 directory and require `passed: true`.
- **Done:** The verification preflight no longer blocks Phase 01 UAT.

## Task 2: Resume Phase 01 verification

- **Files:** `.planning/phases/01-one-day-napplet-runtime-mvp/01-UAT.md`
- **Action:** Rerun the Phase 01 verify-work initialization and preflight hooks, then continue from the existing UAT session.
- **Verify:** The workflow presents the current pending UAT test rather than a coverage gate error.
- **Done:** UAT is ready for the user's test result.
