---
status: testing
phase: 01-one-day-napplet-runtime-mvp
source: [01-VERIFICATION.md]
started: 2026-07-30T18:08:00Z
updated: 2026-07-30T18:20:12Z
---

## Current Test

number: 3
name: Responsive and accessibility shell pass
expected: |
  At 320, 390, 768, and 1440px plus safe-area emulation, Home/Profile/napplet/
  sign-in states have no horizontal overflow; long napplet names and pubkeys
  fit; focus, nav, dialog, live-region, and reduced-motion behavior match
  01-UI-SPEC.md.
awaiting: user response

## Tests

### 1. Package legitimacy approval

expected: Confirm each pinned package/version on npm/jsr and approve the set.
result: passed

### 2. Supplied napplet identity acceptance

expected: Confirm the captured Security Lab coordinate/artifact is the user's intended supplied napplet.
result: passed

### 3. Responsive and accessibility shell pass

expected: At 320, 390, 768, and 1440px plus safe-area emulation, Home/Profile/napplet/sign-in states have no horizontal overflow; long napplet names and pubkeys fit; focus, nav, dialog, live-region, and reduced-motion behavior match 01-UI-SPEC.md.
result: pending

### 4. Real supplied-napplet runtime acceptance

expected: Using `deno task build && deno task start` with the supplied napplet, approve real Nostr Connect, bunker, nsec, relay, outbox, publish, reconnect, Back behavior, persistent iframe, retry notice, and mobile shell flows.
result: pending

## Summary

total: 4
passed: 2
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
