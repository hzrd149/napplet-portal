---
status: resolved
trigger: "Client is loaded over HTTP, where crypto.randomUUID is unavailable; use @noble packages for client crypto compatibility."
created: 2026-07-31
updated: 2026-07-31
---

# Debug Session: HTTP Client Random UUID

## Symptoms

- **Expected:** The browser shell generates opaque correlation, reservation, request, and surface identifiers when served over HTTP.
- **Actual:** Client execution throws because `crypto.randomUUID` is not a function in a non-secure HTTP context.
- **Errors:** `crypto.randomUUID is not a function`.
- **Timeline:** Present when loading the portal over HTTP.
- **Reproduction:** Open the portal over HTTP and trigger a shell path that allocates an identifier.

## Current Focus

- **hypothesis:** Confirmed: direct browser calls to `crypto.randomUUID()` in `NappletShell` assumed a secure context, while the server-only Deno calls remain valid.
- **test:** Run the helper with `crypto.randomUUID` absent and verify UUID shape/version/variant and distinct values, then run check, full tests, and build.
- **expecting:** Complete: browser identifiers use Noble random bytes backed by `getRandomValues`, without SubtleCrypto, `Math.random`, or `randomUUID`.
- **next_action:** Resolved; commit and push the minimal browser-only fix.
- **reasoning_checkpoint:**
- hypothesis: Browser hydration fails over HTTP because NappletShell directly calls the secure-context-only `crypto.randomUUID` API.
  confirming_evidence:
    - Five direct calls existed in the hydrated NappletShell and no other island contained one.
    - The regression passes with `crypto.randomUUID` explicitly unavailable while `crypto.getRandomValues` remains present.
  falsification_test: If NappletShell had no direct call, or UUID generation still failed with only randomUUID removed, the hypothesis would be false.
  fix_rationale: A narrow UUID-v4 helper using pinned Noble random bytes preserves cryptographic entropy over HTTP and avoids changing server UUID behavior.
  blind_spots: Browser acceptance tests are excluded from the standard suite; the production client build verifies the helper bundles successfully.
- **tdd_checkpoint:**

## Evidence

- timestamp: 2026-07-31T00:00:00Z
  checked: Browser and server UUID call sites
  found: NappletShell contained five direct `crypto.randomUUID()` calls; the remaining calls were confined to server runtime modules.
  implication: The failure boundary is browser-only and does not require a shared crypto abstraction or server refactor.

- timestamp: 2026-07-31T00:01:00Z
  checked: Focused regression with `crypto.randomUUID` removed
  found: Sixteen generated identifiers were distinct and matched RFC 4122 UUID-v4 shape, version, and variant while `crypto.getRandomValues` remained available; NappletShell had no direct randomUUID calls.
  implication: The helper covers the reported non-secure HTTP capability gap using the intended entropy source.

- timestamp: 2026-07-31T00:04:00Z
  checked: Project-wide verification
  found: `deno task check`, all 286 non-browser tests, and `deno task build` passed; the final build bundles the helper only with NappletShell rather than as a separate Fresh island.
  implication: The minimal fix compiles, passes adjacent behavior, and integrates cleanly with Fresh production bundling.

## Eliminated

- hypothesis: Server runtime UUID generation also requires replacement.
  evidence: All remaining direct calls are in server-only runtime modules where Deno provides native `crypto.randomUUID`.
  timestamp: 2026-07-31T00:00:00Z

- hypothesis: SubtleCrypto or `Math.random` is required as an HTTP fallback.
  evidence: Noble `randomBytes` succeeds through `crypto.getRandomValues` with `randomUUID` absent.
  timestamp: 2026-07-31T00:01:00Z

## Resolution

- **root_cause:** NappletShell generated browser-side identifiers with `crypto.randomUUID()`, which is unavailable when the portal is served from a non-secure HTTP context even though `crypto.getRandomValues` remains exposed.
- **fix:** Added a browser UUID-v4 helper backed by pinned `@noble/hashes` `randomBytes`, set the RFC 4122 version and variant bits, and replaced only the five NappletShell calls while preserving native server UUID usage.
- **verification:** Focused regression passed (2 tests); `deno task check` passed; full suite passed (286 tests); `deno task build` passed.
- **files_changed:** [deno.json, deno.lock, islands/NappletShell.tsx, shell/browser_uuid.ts, tests/browser_uuid_test.ts, .planning/debug/resolved/http-client-random-uuid.md]
