# Phase 3: Mobile Shell Resilience - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution
> agents. Decisions are captured in CONTEXT.md — this log preserves the
> alternatives considered.

**Date:** 2026-07-30 **Phase:** 3-Mobile Shell Resilience **Areas discussed:**
Connection Experience, Mobile Navigation and Account Chrome, Theme and Branding,
Reconnect Behavior, Connection Detail Surface, Ritual Interruption, Bottom Bar
Presentation, Account Sheet States, Sign-Out Aftermath, Theme Transition
Behavior, Constellation State Mapping, Home Header Responsiveness

---

## Connection Experience

| Decision             | Selected                                          | Alternatives considered               |
| -------------------- | ------------------------------------------------- | ------------------------------------- |
| Primary presentation | Full-screen wordless cyberpunk ritual             | Shell-visible layer; compact status   |
| Metaphor             | Cryptographic constellation                       | Five Rings; forged path               |
| Progress             | Verified segments plus honest indeterminate pulse | Fixed ceremony; raw telemetry         |
| Retry/failure        | Recoverable fracture                              | Rewind; collapse and rebirth          |
| Reduced motion       | Same constellation with discrete transitions      | Static glyph; native indicator        |
| Frequency            | Full cold start, abbreviated reconnect            | Full every time; first visit only     |
| Fast readiness       | Brief beat capped around one second               | Immediate finish; fixed long ceremony |
| Reveal               | Constellation resolves into shell chrome          | Aperture; dissolve                    |

**User's choice:** A measured, inspirational Musashi/cypherpunk constellation
ritual whose visuals carry meaning without words. **Notes:** The user stressed
that progress must be metered and measured, not merely decorative.

## Mobile Navigation and Account Chrome

| Decision            | Selected                            | Alternatives considered               |
| ------------------- | ----------------------------------- | ------------------------------------- |
| Home account header | Identity-first card                 | Command center; minimal chip          |
| Bottom controls     | Home, constellation status, Account | Two controls; four controls with Back |
| Home action         | Reveal Home and keep iframe mounted | Close iframe; prompt each time        |
| Account action      | Compact account sheet               | Full page; minimal popover            |

**User's choice:** Stable, compact shell navigation that preserves the running
napplet.

## Theme and Branding

| Decision     | Selected                              | Alternatives considered                  |
| ------------ | ------------------------------------- | ---------------------------------------- |
| Theme policy | System default with Light/Dark/System | Dark default; System only                |
| Persistence  | This browser across visits            | Account-wide; current tab                |
| Icon         | Sovereign constellation gate          | Five Rings; warrior mon                  |
| Palette      | Ink, bone, electric amber             | Obsidian/cyan; black/vermilion/parchment |

**User's choice:** A system-respecting theme with a coherent constellation-gate
identity.

## Reconnect Behavior

| Decision         | Selected                                 | Alternatives considered                  |
| ---------------- | ---------------------------------------- | ---------------------------------------- |
| Initial loss     | Quiet automatic recovery                 | Immediate Retry; user approval           |
| Hidden tab       | Suppress churn, retain token             | Continue backoff; intentional disconnect |
| Offline          | Suspend until online                     | Keep retrying; discard token             |
| Repeated failure | Low-frequency recovery plus manual Retry | Stop by attempt count; stop by time      |

**User's choice:** Persistent but storm-resistant recovery that respects mobile
lifecycle signals.

## Connection Detail Surface

| Decision         | Selected                  | Alternatives considered                |
| ---------------- | ------------------------- | -------------------------------------- |
| Detail level     | Minimal status sheet      | Concise visual detail; full dashboard  |
| Language         | One plain-language status | Symbols only; technical labels         |
| Secondary data   | None                      | Last contact; retry timing             |
| Retry visibility | After repeated failures   | Every disconnect; after recovery stops |

**User's choice:** Keep connection details minimal and actionable.

## Ritual Interruption

| Decision      | Selected                    | Alternatives considered                    |
| ------------- | --------------------------- | ------------------------------------------ |
| Skip          | No ordinary skip            | Tap to finish; persistent Skip             |
| Interaction   | At reveal                   | Under the overlay; reveal immediately      |
| Slow startup  | Delayed Home/Account escape | Trap until ready/failure; auto-return Home |
| Escape timing | About three seconds         | About eight seconds; failure only          |

**User's choice:** Preserve the ritual while ensuring a slow connection cannot
trap the user.

## Bottom Bar Presentation

| Decision       | Selected                   | Alternatives considered    |
| -------------- | -------------------------- | -------------------------- |
| Layout         | Reserve safe space         | Overlay; auto-hide overlay |
| Visibility     | Always visible             | Dim; collapse              |
| Short viewport | Slimmer three-control bar  | Side rail; icon overlay    |
| Surface        | Opaque with amber boundary | Blurred glass; borderless  |

**User's choice:** Reliable, permanently available shell navigation that never
covers napplet UI.

## Account Sheet States

| Decision             | Selected                             | Alternatives considered                  |
| -------------------- | ------------------------------------ | ---------------------------------------- |
| Signed out           | One primary Sign In                  | All methods; separate page only          |
| Signer offline       | Preserve identity and offer recovery | Treat signed out; status only            |
| Runtime reconnecting | Separate from signer identity        | Mark account offline; hide runtime state |
| Sign Out             | Immediate, keep napplet visible      | Confirm and return Home; close napplet   |

**User's choice:** Keep identity, signer, and backend connection states
distinct; sign-out must not destroy the mounted napplet.

## Sign-Out Aftermath

| Decision             | Selected                                | Alternatives considered              |
| -------------------- | --------------------------------------- | ------------------------------------ |
| Napplet notification | Pinned Kehto identity/session mechanism | Reload; discover only through denial |
| Shell feedback       | Brief non-blocking confirmation         | None; persistent banner              |
| Protected call       | Contract-defined denial only            | Open account sheet; shell toast      |
| Continued activity   | Public/read-only where permitted        | Freeze all; reset streams            |

**User's choice:** Use the mechanism already provided by the Kehto runtime
packages. **Notes:** The exact pinned package surface must be verified during
research/planning.

## Theme Transition Behavior

| Decision       | Selected                  | Alternatives considered              |
| -------------- | ------------------------- | ------------------------------------ |
| First paint    | Correct theme immediately | Neutral frame; post-hydration switch |
| Live switch    | Immediate and discrete    | Crossfade; next navigation           |
| System change  | Follow live               | Next load; once per session          |
| Browser chrome | Follow active theme       | Neutral; next navigation             |

**User's choice:** Correct and responsive theme behavior, with an explicit
requirement not to introduce excessive supporting code.

## Constellation State Mapping

| Decision           | Selected                     | Alternatives considered               |
| ------------------ | ---------------------------- | ------------------------------------- |
| Success grammar    | Seed → link → cluster → gate | Brightness only; orbital convergence  |
| Retry vs offline   | Motion vs rest               | Color only; expand/disappear          |
| Repeated failure   | Stable fracture plus Retry   | Red collapse; no distinction          |
| Color independence | Geometry and motion          | Added state icons; text-only fallback |

**User's choice:** A complete nonverbal grammar carried by structure and motion.

## Home Header Responsiveness

| Decision          | Selected                   | Alternatives considered            |
| ----------------- | -------------------------- | ---------------------------------- |
| Narrow identity   | Avatar plus name           | Include npub/status; stacked card  |
| Narrow action     | Whole row opens sheet      | Trailing button; button below      |
| Offline exception | Small non-color mark       | Expand with text; no header change |
| Wide identity     | Add npub and signer status | Stay compact; operational panel    |

**User's choice:** Extremely compact on phones, progressively informative on
wider screens.

## the agent's Discretion

- No user-facing decision was delegated to the agent.
- Exact animation curves, spacing, typography, backoff constants within the
  chosen policy, and final SVG geometry remain implementation details.

## Deferred Ideas

- Passing shell theme preference across the napplet boundary requires a separate
  NAP capability and is outside Phase 3.
