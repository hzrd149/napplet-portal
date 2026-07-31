---
phase: 05-resource-and-blossom-transfer
fixed_at: 2026-07-31T00:00:00Z
review_path: .planning/phases/05-resource-and-blossom-transfer/05-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 5: Code Review Fix Report

All four critical and three warning findings were fixed.

## Fixed Issues

- **CR-01** (`7de37bb`): Correlated resource metadata with binary frames, preserved observed MIME, and assembled batch results exactly once.
- **CR-02** (`5883f83`, `2fbce0e`): Added an Undici connector that pins each request hop to policy-authorized DNS answers while preserving Host and TLS SNI.
- **CR-03** (`be35765`): Applied the destination policy before signing/uploading, limited public uploads to HTTPS/443, and restricted the loopback exception to the configured local cache.
- **CR-04** (`df9d3e1`): Applied one absolute resource deadline across every candidate and redirect.
- **WR-01** (`fd5af8a`): Added a bounded binary upload metadata envelope and reconstructed the complete canonical request server-side.
- **WR-02** (`ab5d43e`): Distinguished caller cancellation from deadline expiry.
- **WR-03** (`940f003`): Replaced source-string transport assertions with behavioral PNG and mixed-batch binary assembly coverage.

## Verification

- `deno task check`: passed
- `deno task test`: 168 passed, 0 failed
- `deno task build`: passed

_Fixer: gsd-code-fixer_
