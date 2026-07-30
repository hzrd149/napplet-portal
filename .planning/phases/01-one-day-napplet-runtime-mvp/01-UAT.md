---
status: testing
phase: 01-one-day-napplet-runtime-mvp
source: [01-VERIFICATION.md]
started: 2026-07-30T18:08:00Z
updated: 2026-07-30T18:08:00Z
---

## Current Test

number: 1
name: Package legitimacy approval
expected: |
  Confirm applesauce-accounts@6.2.0, applesauce-core@6.2.0, applesauce-relay@6.2.1,
  applesauce-signers@6.2.2, @kehto/runtime@0.20.1, @kehto/shell@0.19.1,
  @kehto/services@0.18.1, @kehto/nip@0.5.1, @napplet/core@0.31.0,
  @napplet/nap@0.31.0, and nostr-tools@2.24.1 on npm/jsr before trusting the
  pinned set.
awaiting: user response

## Tests

### 1. Package legitimacy approval

expected: Confirm each pinned package/version on npm/jsr and approve the set.
result: pending

### 2. Supplied napplet identity acceptance

expected: Confirm the captured Security Lab coordinate/artifact is the user's intended supplied napplet.
result: pending

### 3. Responsive and accessibility shell pass

expected: At 320, 390, 768, and 1440px plus safe-area emulation, Home/Profile/napplet/sign-in states have no horizontal overflow; long napplet names and pubkeys fit; focus, nav, dialog, live-region, and reduced-motion behavior match 01-UI-SPEC.md.
result: pending

### 4. Real supplied-napplet runtime acceptance

expected: Using `deno task build && deno task start` with the supplied napplet, approve real Nostr Connect, bunker, nsec, relay, outbox, publish, reconnect, Back behavior, persistent iframe, retry notice, and mobile shell flows.
result: pending

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
