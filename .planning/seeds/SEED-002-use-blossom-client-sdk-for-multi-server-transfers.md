---
id: SEED-002
status: dormant
planted: 2026-07-30
planted_during: Phase 1 - One-Day Napplet Runtime MVP
trigger_when: when implementing configurable multi-server Blossom uploads, downloads, or durable blob caching
scope: unknown
---

# SEED-002: Use blossom-client-sdk for uploads and downloads across multiple Blossom servers

## Why This Matters

The backend runtime should use `blossom-client-sdk` as its standard Blossom client abstraction when it grows beyond the Phase 1 verified-download seam. This avoids maintaining bespoke multi-server upload/download behavior and keeps retries, server selection, and Blossom protocol handling aligned with the ecosystem library.

## When to Surface

**Trigger:** when implementing configurable multi-server Blossom uploads, downloads, or durable blob caching

This seed should surface during Phase 2 backend runtime expansion or any milestone that adds Blossom upload, replication, fallback, synchronization, or durable artifact-cache behavior.

## Scope Estimate

**Unknown** — evaluate the SDK API, package legitimacy, supported authentication/signing flow, multi-server failure semantics, and compatibility with local Blossom servers during planning.

## Breadcrumbs

- `.planning/ROADMAP.md` — Phase 2 owns local Blossom cache backends and configurable servers.
- `.planning/STATE.md` — durable Blossom settings and local blob caching are deferred to Phase 2.
- `runtime/artifacts.ts` — current Phase 1 verified multi-server download seam.
- `runtime/config.ts` — configured Blossom server list and public fallbacks.
- `README.md` — documents current `BLOSSOM_SERVERS` behavior and Phase 1 cache boundary.

## Notes

- Use the npm/JSR package as a production dependency after its normal package-legitimacy review; sibling source repositories remain reference-only.
- Preserve hash verification and server-owned policy even when delegating transport mechanics to the SDK.
- Define partial-success behavior explicitly for multi-server uploads and downloads rather than treating all servers as an all-or-nothing batch.
