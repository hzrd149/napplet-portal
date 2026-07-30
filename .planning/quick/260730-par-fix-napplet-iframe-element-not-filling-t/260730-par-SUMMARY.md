---
quick_id: 260730-par
status: complete
date: 2026-07-30
commit: 3000f4d
---

# Quick Task 260730-par Summary

Fixed the napplet iframe height chain so the iframe occupies the flexible grid row instead of collapsing into the grid's auto row when no notice banner is present.

## Changes

- Added `grid-row: 2` and `min-height: 0` to `.napplet-frame` so the iframe always lands in the `minmax(0, 1fr)` row.
- Added `height: 100%` to `.napplet-stack` so the iframe's percentage height resolves against a definite containing block.
- Added shell architecture regression assertions for the iframe full-height contract.

## Verification

- `deno task check` passed.
- `deno test -A tests/shell_architecture_test.ts` passed.
- `deno task test` was attempted, but unrelated account-store tests failed while writing temp files with `Disk quota exceeded (os error 122)` / `Account snapshot could not be written`.

## Commit

- `3000f4d` - `fix: keep napplet iframe full height`
