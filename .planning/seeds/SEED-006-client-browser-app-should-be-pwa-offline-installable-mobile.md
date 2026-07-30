---
id: SEED-006
status: dormant
planted: 2026-07-30T18:22:10Z
planted_during: Phase 01 — one-day-napplet-runtime-mvp
trigger_when: when relevant
scope: unknown
---

# SEED-006: The client browser app should be a PWA, support offline, and be installable on a mobile phone

## Why This Matters

_To be filled in. Run `$gsd-capture --seed --enrich SEED-006` to add context._

## When to Surface

**Trigger:** when relevant

This seed will surface during `$gsd-new-milestone` when the milestone scope matches.

## Scope Estimate

**Unknown** — run `$gsd-capture --seed --enrich SEED-006` to estimate effort.

## Breadcrumbs

- `main.ts` — registers `staticFiles()`, the likely serving path for a web app manifest, icons, and service worker assets.
- `routes/_app.tsx` — owns shared document metadata including viewport and theme color.
- `routes/index.tsx` and `routes/signin.tsx` — currently set page-level theme color metadata.
- `static/` — existing public asset location for install icons, manifest, and service worker file candidates.
- `.planning/ROADMAP.md` — Phase 1 and later phases already emphasize mobile browser usage and production hardening.

## Notes

_Captured via one-shot seed capture. Enrich with trigger, why, and scope at your convenience._
