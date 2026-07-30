---
id: SEED-001
status: dormant
planted: 2026-07-30T10:38:09+0100
planted_during: project initialization
trigger_when: when relevant
scope: unknown
---

# SEED-001: nostr signin flow needs to support nsec, nip-46 ( nostr-connect QR code and bunker URI ) and a read-only npub

## Why This Matters

_To be filled in. Run `/gsd-capture --seed --enrich SEED-001` to add context._

## When to Surface

**Trigger:** when relevant

This seed will surface during `/gsd-new-milestone` when the milestone scope matches.

## Scope Estimate

**Unknown** - run `/gsd-capture --seed --enrich SEED-001` to estimate effort.

## Breadcrumbs

- `.planning/PROJECT.md` - active requirements and context already include sign-in flows, backend-owned Nostr account state, and server-side runtime ownership.
- `.planning/research/FEATURES.md` - account sign-in is table stakes; NIP-46/Bunker is recommended and NAP identity should expose read-only pubkey/profile data.
- `.planning/research/PITFALLS.md` - key custody and signer/session confusion are called out as high-risk; direct `nsec` support needs explicit threat modeling.
- `.planning/research/STACK.md` - Applesauce signer/account packages and Nostr Connect support are identified as likely implementation dependencies.
- `.planning/research/ARCHITECTURE.md` - account/session service and signer adapter are proposed backend runtime boundaries.

## Notes

_Captured via one-shot seed capture. Enrich with trigger, why, and scope at your convenience._
