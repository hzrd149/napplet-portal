---
id: SEED-005
status: dormant
planted: 2026-07-30T18:16:07Z
planted_during: Phase 01 — one-day-napplet-runtime-mvp
trigger_when: when relevant
scope: unknown
---

# SEED-005: Add a simple status dot to the bottom nav bar to reflect whether the browser tab is connected to the backend runtime

## Why This Matters

_To be filled in. Run `$gsd-capture --seed --enrich SEED-005` to add context._

## When to Surface

**Trigger:** when relevant

This seed will surface during `$gsd-new-milestone` when the milestone scope matches.

## Scope Estimate

**Unknown** — run `$gsd-capture --seed --enrich SEED-005` to estimate effort.

## Breadcrumbs

- `islands/NappletShell.tsx` — owns the `/api/runtime` WebSocket, runtime connection state, view navigation, and bottom nav markup.
- `.planning/STATE.md` — current Phase 01 focus is proving the backend runtime seam.
- `.planning/ROADMAP.md` — Phase 1 runtime MVP requires a backend-proxied stream seam; later phases expand runtime diagnostics and hardening.

## Notes

_Captured via one-shot seed capture. Enrich with trigger, why, and scope at your convenience._
