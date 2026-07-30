---
id: SEED-004
status: dormant
planted: 2026-07-30
planted_during: Phase 01 - one-day-napplet-runtime-mvp verification
trigger_when: when relevant
scope: unknown
---

# SEED-004: Client-side loading overlay while the runtime session connects

## Why This Matters

_To be filled in. Run `$gsd-capture --seed --enrich SEED-004` to add context._

## When to Surface

**Trigger:** when relevant

This seed will surface during `$gsd-new-milestone` when the milestone scope matches.

## Scope Estimate

**Unknown** - run `$gsd-capture --seed --enrich SEED-004` to estimate effort.

## Breadcrumbs

- `islands/NappletShell.tsx` already tracks `connecting`, `runtimeError`, `runtime.connected`, `runtime.artifact`, and a 10s WebSocket connect timeout.
- `routes/api/runtime.ts` establishes the runtime WebSocket session and sends `runtime.connected` with `connectionId`, `windowId`, reconnect token, and resumed state.
- `runtime/connections.ts` owns connection attachment, reconnect tokens, grace-period detach, and window creation.
- `.planning/STATE.md` records the current Phase 01 verification focus and the decision to keep browser islands thin while backend runtime owns heavy state.

## Notes

Captured via one-shot seed capture. Enrich with trigger, why, and scope at your convenience.

Original idea: there should be a nice loading overload on the client side while the client page is waiting to connect to the backend runtime and establish a session.
