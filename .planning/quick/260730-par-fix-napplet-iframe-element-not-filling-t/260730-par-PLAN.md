---
quick_id: 260730-par
status: planned
date: 2026-07-30
---

# Quick Task 260730-par: Fix napplet iframe element not filling the available height

## Task 1: Fix iframe height chain

- Files: `islands/NappletShell.tsx`, `assets/styles.css`
- Action: Ensure the napplet iframe and its containing stack have a definite full-height containing block while preserving the existing mounted shell and bottom navigation behavior.
- Verify: CSS includes explicit full-height/min-height constraints on the napplet stack and iframe parent chain.
- Done: The iframe element can resolve `height: 100%` against a full-height napplet container.

## Task 2: Add regression coverage

- Files: `tests/shell_architecture_test.ts`
- Action: Add assertions that protect the napplet iframe full-height contract.
- Verify: `deno task check` and `deno task test` pass.
- Done: Tests fail if the iframe height chain is removed.

## Verification

- Run `deno task check`.
- Run `deno task test`.
