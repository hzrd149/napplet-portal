---
id: SEED-003
status: dormant
planted: 2026-07-30
planted_during: Phase 01 - one-day-napplet-runtime-mvp verification
trigger_when: when relevant
scope: unknown
---

# SEED-003: Support NAP-NOTIFY with Web Push or active-tab browser notifications

## Why This Matters

_To be filled in. Run `$gsd-capture --seed --enrich SEED-003` to add context._

## When to Surface

**Trigger:** when relevant

This seed will surface during `$gsd-new-milestone` when the milestone scope matches.

## Scope Estimate

**Unknown** - run `$gsd-capture --seed --enrich SEED-003` to estimate effort.

## Breadcrumbs

- `.planning/STATE.md` defers full NAP-NOTIFY and other NAP APIs to Phase 3.
- `.planning/REQUIREMENTS.md` includes `V2-14`: runtime implements basic NAP-INTENT, NAP-THEME, and NAP-NOTIFY.
- `.planning/research/FEATURES.md` frames basic NAP-NOTIFY as in-app toasts/badges first, with OS push notifications later due browser permission and background constraints.
- `.planning/research/SUMMARY.md` lists basic `notify` alongside broader NAP coverage.
- `.planning/phases/01-one-day-napplet-runtime-mvp/COVERAGE.md` marks NOTIFY as deferred by locked Phase 1 scope.

## Notes

Captured via one-shot seed capture. Enrich with trigger, why, and scope at your convenience.

Original idea: support NAP-NOTIFY using Web Push notifications, or use the browser Notification API when an active tab is open.
