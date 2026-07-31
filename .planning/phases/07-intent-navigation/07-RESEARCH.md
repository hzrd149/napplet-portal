# Phase 7: Intent Navigation - Research

**Researched:** 2026-07-31
**Domain:** Pinned NAP-INTENT contracts, trusted manifest-derived routing, and shell-owned browser navigation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Handler discovery
- Build the handler registry only from exact accepted manifest events already admitted by CatalogService.
- Decode handler declarations with pinned 0.31.0 contracts and omit malformed, superseded, unresolved, or uninstalled entries.
- Project handler availability reactively as catalog truth changes, preserving last-good partial state during transient sync failures.
- Use stable verified napplet identity plus declared archetype as the canonical handler key.

### Invocation and policy
- Validate the invoking napplet session, requested archetype, payload envelope, and target handler before navigation.
- Return canonical handled, unavailable, denied, and failed outcomes with correlation and sanitized reasons.
- Default deterministically when multiple handlers exist, while allowing an explicit installed target only if policy permits it.
- Never deliver intent payloads to a handler until its exact accepted artifact is verified for launch.

### Shell navigation modes
- Keep mode selection in shell/backend policy: reuse/focus an existing matching surface when safe, otherwise use the declared allowed mode.
- New-tab launch uses a constrained portal URL and backend-issued correlation, not caller-supplied arbitrary URLs.
- Stacked iframe navigation preserves sandbox attributes and gives the shell explicit back/close ownership.
- Browser history represents shell-visible navigation without reloading or remounting unrelated active napplet state.

### Failure and lifecycle behavior
- Catalog replacement or uninstall immediately removes authority for future invocations and safely fails in-flight unresolved launches.
- Popup blocking, closed tabs, verification failures, denied modes, and stale generations settle once with canonical outcomes.
- Focus/reuse never crosses account or verified napplet identity boundaries.
- Test registry churn, competing handlers, stale caller/target sessions, blocked popup, stack history, and reconnect behavior.

### the agent's Discretion
Choose the deterministic handler ordering, bounded intent payload size, and compact shell controls where the pinned contracts do not dictate them, reusing existing catalog and navigation patterns.

### Deferred Ideas (OUT OF SCOPE)
Public intent marketplaces, uninstalled remote handlers, user-authored routing rules, and cross-origin arbitrary navigation remain outside this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INT-01 | Napplet can inspect available intent handlers derived from installed, verified manifest contracts. | Exact 0.31.0 availability/candidate shapes, canonical archetype-tag codec, and CatalogService-derived projection. |
| INT-02 | Napplet can invoke a supported archetype/action and receive a canonical handled, unavailable, denied, or failed result. | Exact envelopes/results, validation order, outcome mapping, and settlement/generation rules. |
| INT-03 | Shell policy can focus or reuse the current handler, open a new browser tab, or stack a new iframe while preserving sandbox and history behavior. | Navigation responsibility split, same-origin portal launch tickets, sandbox parity, stack/history model, and browser constraints. |
</phase_requirements>

## Summary

Phase 7 should add one backend `IntentService` derived from `CatalogService`, one strict NAP-INTENT dispatcher at the authenticated runtime-window boundary, and one shell navigation command/result seam. The pinned packages define request, availability, candidate, result, and envelope shapes, but do **not** provide a shell-side manifest archetype decoder or navigation implementation. [VERIFIED: pinned `@napplet/core@0.31.0` and `@napplet/nap@0.31.0` declarations/source]

The trusted declaration is the exact signed manifest tag `['archetype', slug, convention]`; the canonical 0.31.0 producer requires a lowercase-hyphen slug and a queryless `napplet:<same-slug>/<action>` convention. Parse these tags while constructing `VerifiedCatalogArtifact`, retain them beside the accepted manifest event ID and stable identity, and let `IntentService` consume only ready entries from the current catalog generation. [VERIFIED: sibling `../napplet` 0.31.0 source and codebase `runtime/catalog.ts`, used as reference-only]

Navigation is split deliberately: the backend validates caller ownership, catalog authority, handler selection, mode policy, and exact launch verification; the island alone performs browser focus/open/history/iframe operations and acknowledges the correlated command. A new tab must be opened synchronously from the napplet-originated `message` event before asynchronous verification, using only a same-origin portal URL issued by the shell/backend; otherwise popup blockers make success nondeterministic. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Window/open]

**Primary recommendation:** Implement a catalog-derived `IntentService` with generation-bound launch tickets, then execute backend-authorized `reuse`, `new-tab`, or `stack` commands in a multi-frame shell controller without changing the existing `sandbox="allow-scripts"` boundary. [VERIFIED: codebase grep + pinned contracts]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Decode accepted archetype declarations | API / Backend | Database / Storage | Only the backend owns signed manifests and accepted catalog generations. [VERIFIED: codebase grep] |
| Project/query handler availability | API / Backend | Browser / Client | Backend owns authority; browser only relays canonical results and changes. [VERIFIED: pinned INTENT types] |
| Validate and select handler | API / Backend | — | Caller session, account, current generation, policy, and launch verification are backend facts. [VERIFIED: codebase grep] |
| Focus/open/stack browser surface | Browser / Client | API / Backend | Browser APIs must execute in the island, after backend policy produces a constrained command. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Window/open] |
| Preserve exact launch bytes | API / Backend | Blossom / cache storage | Existing `CatalogService.launch()` and resolver already gate accepted event ID and verified bytes. [VERIFIED: codebase grep] |
| Stack/back/close UI and history | Browser / Client | — | The shell owns mounted frames and same-document session history. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/History/pushState] |

## Exact Pinned Contract Findings

### NAP-INTENT envelopes

| Direction | Type | Required payload | Optional result fields |
|-----------|------|------------------|------------------------|
| napplet → runtime | `intent.invoke` | `id`, `request` | — |
| napplet → runtime | `intent.available` | `id`, `archetype` | — |
| napplet → runtime | `intent.handlers` | `id` | — |
| runtime → napplet | `intent.invoke.result` | `id` | `result`, `error` |
| runtime → napplet | `intent.available.result` | `id` | `availability`, `error` |
| runtime → napplet | `intent.handlers.result` | `id` | `handlers`, `error` |
| runtime → napplet | `intent.changed` | `availability` | — |

All rows above are exact exports of `@napplet/nap/intent/types` 0.31.0. [VERIFIED: pinned npm package declarations]

`IntentRequest` requires `archetype`; `action`, `payload`, `convention`, `handler`, and `behavior` are optional. `action` defaults to `open` in the convenience API, `handler` accepts `default`, `choose`, or a string, and behavior exposes optional `focus`, `newWindow`, and `reuse` booleans. [VERIFIED: pinned `@napplet/core@0.31.0` declarations]

`IntentAvailability` is `{ archetype, available, candidates, hasDefault }`; each candidate is `{ dTag, title?, actions, conventions, isDefault? }`. `IntentResult` always requires `{ ok, archetype, action, handled }` and may include `{ handler, windowId, convention, error }`. [VERIFIED: pinned `@napplet/core@0.31.0` declarations]

The contract has no distinct enum for unavailable/denied/failed. Resolve this by always returning a canonical `IntentResult`: `ok:false`, `handled:false`, requested archetype/defaulted action, and one sanitized stable error string (`unavailable`, `denied`, or `failed`); reserve the envelope-level `error` for malformed/top-level processing where no valid result can be formed. [VERIFIED: pinned result/envelope types; recommendation]

### Manifest declaration availability — RESOLVED

The exact 0.31.0 `@napplet/core` and `@napplet/nap` packages expose INTENT messages and API types but no manifest archetype codec. [VERIFIED: pinned package export maps and source grep]

The canonical 0.31.0 producer emits exactly one three-field tag per declaration: `['archetype', slug, convention]`. The slug matches `^[a-z0-9][a-z0-9-]*$`; convention matches queryless `^napplet:([^/?#\s]+)/([^/?#\s]+)$`; its archetype segment must equal the slug; blank values, extra tag fields, fragments, queries, mismatches, and numbered `NAP-<n>` identifiers are invalid. [VERIFIED: sibling `../napplet/packages/vite-plugin/src/manifest.ts` at the pinned release lineage]

Therefore add a small first-party strict codec at the verification boundary; this is contract validation, not a replacement library. Actions are derived from the convention's final path segment, conventions remain the full stable strings, duplicate identical declarations collapse, and a malformed declaration omits that declaration without invalidating otherwise verified launch bytes. [VERIFIED: canonical producer shape; recommendation]

## Standard Stack

### Core

| Library / facility | Version | Purpose | Why Standard |
|--------------------|---------|---------|--------------|
| `@napplet/core` | 0.31.0 | `IntentRequest`, `IntentAvailability`, `IntentCandidate`, `IntentResult` | Locked production contract and import map. [VERIFIED: npm registry + `deno.json`] |
| `@napplet/nap/intent` | 0.31.0 | Exact INTENT envelope unions and domain constant | Locked production contract; no new dependency. [VERIFIED: npm registry + pinned package exports] |
| Existing `CatalogService` | repository | Accepted manifest authority, current generation, verified launch gate | Already enforces exact catalog event and manifest event identity. [VERIFIED: codebase grep] |
| Web platform `window.open`, History API, iframe sandbox | browser | New-tab, same-document stack history, isolation | These operations belong to the browser shell. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Window/open] |

### Supporting

| Facility | Version | Purpose | When to Use |
|----------|---------|---------|-------------|
| Deno test runner | 2.9.4 | Deterministic service/codec/controller tests | Every backend and pure shell state transition. [VERIFIED: environment probe] |
| Existing `ConnectionRegistry` and runtime owner IDs | repository | Authenticate connection/window ownership and reconnect generation | Every invoke and browser acknowledgement. [VERIFIED: codebase grep] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Derive from `CatalogService` | Re-query manifests independently | Re-querying creates a second authority and can resurrect superseded/uninstalled handlers; reject. [VERIFIED: codebase architecture] |
| Same-document frame stack | Route reload per handler | Reloading remounts unrelated state and violates the locked history behavior; reject. [VERIFIED: current shell architecture] |
| Browser shell opens portal URL | Handler-provided URL | Arbitrary navigation violates the locked sandbox/policy boundary; reject. [VERIFIED: CONTEXT.md] |

**Installation:** None. Both NAP packages are already pinned in `deno.json` and `deno.lock`. [VERIFIED: codebase grep]

## Package Legitimacy Audit

| Package | Registry | Published | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----------|-----------|-------------|---------|-------------|
| `@napplet/core` | npm | 2026-07-28 | 1,352/wk at audit | github.com/sandwichfarm/napplet | SUS (too new) | Existing locked pin; no install; preserve 0.31.0. [VERIFIED: npm registry + legitimacy seam] |
| `@napplet/nap` | npm | 2026-07-28 | 1,503/wk at audit | github.com/sandwichfarm/napplet | SUS (too new) | Existing locked pin; no install; preserve 0.31.0. [VERIFIED: npm registry + legitimacy seam] |

Neither package declares a `postinstall` script. [VERIFIED: npm registry]

**Packages removed due to SLOP verdict:** none. [VERIFIED: legitimacy seam]
**Packages flagged as suspicious [SUS]:** both locked existing packages; since Phase 7 installs neither, no install checkpoint is required. [VERIFIED: `deno.json` + legitimacy seam]

## Architecture Patterns

### System Architecture Diagram

```text
sandboxed caller iframe
  │ postMessage: intent.* (source-bound)
  ▼
NappletShell bridge ── runtime.forward + connection/window owner ──► /api/runtime
                                                                  │ strict decode
                                                                  ▼
                                                           IntentService
                                              ┌──────── catalog projection/current generation
                                              ├──────── account + caller identity ownership
                                              ├──────── deterministic policy/handler selection
                                              └──────── CatalogService.launch exact artifact gate
                                                                  │
                                       unavailable/denied/failed ◄─┤
                                                                  ▼
                                                  correlated navigation command
                                             ┌────────┼───────────┐
                                             ▼        ▼           ▼
                                      focus/reuse  new tab    iframe stack
                                             └────────┼───────────┘
                                                      ▼
                                         correlated shell acknowledgement
                                                      ▼
                                     intent.invoke.result to caller iframe
```

### Recommended Project Structure

```text
runtime/
├── intent.ts              # codecs, projection, selection, generations, outcomes
├── catalog.ts             # enrich verified artifacts with canonical declarations
├── transport.ts           # strict shell navigation command/ack codecs
└── portal_runtime.ts      # production IntentService wiring
components/
└── NappletFrame.tsx       # reusable per-frame identity/source-bound bridge
islands/
└── NappletShell.tsx       # surface registry, popup/stack/history execution
tests/
├── intent_contract_test.ts
├── intent_registry_test.ts
├── intent_runtime_test.ts
└── intent_navigation_test.tsx
```

### Pattern 1: Generation-bound derived registry

Snapshot the current account pubkey, catalog event ID, ready artifact identities, and declarations into one immutable registry generation. On every catalog notification, rebuild only from the current projection; preserve the previous projected availability during `stale`/transient `error`, but never preserve authority for an entry absent from the current accepted catalog. [VERIFIED: existing CatalogService last-good pattern; recommendation]

Use canonical internal key `(accountPubkey, manifestEventId, dTag, aggregateHash, archetype)`. Expose only contract fields (`dTag`, actions, conventions, title) to napplets. [VERIFIED: locked decisions + pinned candidate type]

### Pattern 2: Deterministic candidate selection

Sort candidates lexicographically by `dTag`, then accepted `manifestEventId`; choose the first as `isDefault`. An explicit handler string is interpreted as the candidate `dTag`, accepted only when exactly one current candidate matches and policy permits it. `choose` returns `denied` until a shell chooser exists; it must not silently become default. [VERIFIED: pinned handler preference/candidate shapes; recommendation]

### Pattern 3: Validate, reserve surface, verify, commit

Validation order should be: exact envelope and size → live caller owner/source → normalized archetype/action/convention → current handler generation → mode policy → reserve target surface/correlation → call `CatalogService.launch()` with exact current IDs → recheck generation/account → commit navigation → settle once. [VERIFIED: codebase ownership and launch patterns; recommendation]

For `new-tab`, synchronously reserve `window.open(constrainedPortalUrl, generatedName, "noopener")` during the trusted message event; treat `null` as blocked, close the reserved blank tab on later denial/failure, and navigate it only to the same-origin backend-issued URL after verification. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Window/open]

### Pattern 4: Shell surface registry and history

Model surfaces as shell-owned records with `surfaceId`, account, exact handler identity, mode, frame/window reference, and lifecycle state. Keep an array for the iframe stack plus active index; mounting a stack entry pushes one history state containing opaque shell IDs, while popstate changes visibility/removes the top entry without rewriting `srcdoc` of unrelated frames. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/History/pushState]

Every stacked frame must use the same reusable `NappletFrame` path and `sandbox="allow-scripts"`; without `allow-same-origin`, embedded content receives a special origin that fails same-origin checks. [CITED: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe]

### Anti-Patterns to Avoid

- **Inferring handlers from `requires: intent`:** that declares a consumed capability, not an archetype served. Use signed `archetype` tags. [VERIFIED: pinned/canonical manifest sources]
- **Keying handlers by dTag alone:** dTags can repeat across publishers/accounts and versions. Bind account plus exact accepted/verified identity. [VERIFIED: catalog model]
- **Awaiting verification before `window.open`:** loses transient user activation and invites popup blocking. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Window/open]
- **One global iframe bridge/ref:** the current shell assumes one frame; stacking requires per-surface source, bridge state, and identity registration. [VERIFIED: codebase grep]
- **Caller-provided sender/window/URL:** derive caller and destinations from authenticated shell/runtime state. [VERIFIED: pinned conformance source + CONTEXT.md]
- **Completing invoke before browser acknowledgement:** popup/closed-tab failures would be reported as handled. Settle only after an ack or bounded timeout. [VERIFIED: contract semantics; recommendation]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| INTENT public types | Parallel DTOs with drift | Types from pinned `@napplet/core` and `@napplet/nap/intent` | Exact required/optional fields already exist. [VERIFIED: pinned declarations] |
| Artifact trust | A second resolver | `CatalogService.launch()` / current production resolver | Already verifies exact accepted event and bytes. [VERIFIED: codebase grep] |
| Popup/history/sandbox primitives | Custom URL router or iframe security model | Web platform APIs behind shell policy | Browser owns these lifecycle rules. [CITED: MDN pages in Sources] |
| Correlation cleanup | Ad hoc promises | Existing bounded registry/pending-correlation pattern | Existing code caps, times out, disconnects, and settles once. [VERIFIED: codebase tests] |

**Key insight:** The only first-party codec needed is the missing three-field manifest tag decoder; all public INTENT shapes and artifact verification must reuse pinned/current facilities. [VERIFIED: pinned package and codebase audit]

## Common Pitfalls

### Pitfall 1: Last-good display accidentally remains authority
**What goes wrong:** A stale candidate remains invokable after uninstall/replacement. [VERIFIED: threat analysis]
**How to avoid:** Separate displayed availability from authoritative current-generation selection; current catalog absence revokes immediately even if UI retains stale copy. [VERIFIED: locked decision; recommendation]

### Pitfall 2: Convention/action mismatch
**What goes wrong:** `action: edit` is routed through `napplet:note/open`. [VERIFIED: pinned conformance test]
**How to avoid:** Default action to `open`; when convention is supplied, require an exact candidate convention and require its parsed action to equal request action. [VERIFIED: canonical tag grammar; recommendation]

### Pitfall 3: New-tab acknowledgment race
**What goes wrong:** The tab is blocked, closed, or navigated after its authority generation changed. [VERIFIED: browser/runtime lifecycle analysis]
**How to avoid:** Reserve synchronously, use backend correlation and timeout, recheck generation before navigation, and make every terminal event idempotent. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Window/open]

### Pitfall 4: Stack corrupts source binding
**What goes wrong:** Messages from a hidden/old frame are attributed to the active frame. [VERIFIED: current single-ref bridge design]
**How to avoid:** Allocate bridge, verified identity registry entry, runtime window owner, and frame ref per surface; route by exact `event.source`. [VERIFIED: existing iframe security pattern; recommendation]

### Pitfall 5: Reconnect duplicates or loses intent settlement
**What goes wrong:** A resumed socket replays a navigation or abandons a pending caller. [VERIFIED: existing reconnect model]
**How to avoid:** Keep invocation state under stable connection/window generation, never replay committed navigation, and settle unresolved work once on grace expiry/account change. [VERIFIED: `ConnectionRegistry` tests; recommendation]

## Code Examples

### Exact public message typing

```typescript
import type {
  IntentAvailableMessage,
  IntentHandlersMessage,
  IntentInvokeMessage,
} from "@napplet/nap/intent";
import type { IntentResult } from "@napplet/core";

type IntentCommand =
  | IntentInvokeMessage
  | IntentAvailableMessage
  | IntentHandlersMessage;

function unavailable(archetype: string, action = "open"): IntentResult {
  return { ok: false, archetype, action, handled: false, error: "unavailable" };
}
```

Source: pinned package declarations. [VERIFIED: pinned npm packages]

### Strict canonical archetype tag decode

```typescript
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const CONVENTION = /^napplet:([^/?#\s]+)\/([^/?#\s]+)$/;

function decodeArchetypeTag(tag: readonly string[]) {
  if (tag.length !== 3 || tag[0] !== "archetype" || !SLUG.test(tag[1])) return null;
  const match = CONVENTION.exec(tag[2]);
  if (!match || match[1] !== tag[1]) return null;
  return { archetype: tag[1], action: match[2], convention: tag[2] };
}
```

Source: exact canonical 0.31.0 producer rules; implementation should add length bounds and immutable return values. [VERIFIED: sibling reference source]

## State of the Art

| Old Approach | Current Pinned Approach | When Changed | Impact |
|--------------|-------------------------|--------------|--------|
| URI-only invocation / `intent.deliver` / acceptance-only result | `invoke(request)`, `open(...)`, `behavior.newWindow`, structured `IntentResult` | 0.31.0 lineage | Implement only the six request/result/change envelope types above. [VERIFIED: pinned changelog/source] |
| Draft archetype tags with event-kind fields | Exact `['archetype', slug, convention]` | 0.31.0 lineage | Reject extra fields and derive action from convention. [VERIFIED: pinned release source] |

**Deprecated/outdated:** Do not implement `intent.deliver`, `onDelivery`, URI invocation, candidate `contracts`, archetype `eventKinds`, or trailing `kind:<number>` tag fields. [VERIFIED: 0.31.0 package/changelog source]

## Project Constraints (from AGENTS.md)

- Use Deno/Fresh; Fresh routes render server-side and islands contain only browser interaction. [VERIFIED: AGENTS.md]
- Keep complex Nostr, persistent state, and policy in the backend runtime. [VERIFIED: AGENTS.md]
- Use pinned npm packages, specifically `@napplet/core@0.31.0` and `@napplet/nap@0.31.0`; sibling repos are reference-only and must never become production imports. [VERIFIED: AGENTS.md]
- Preserve sandboxed iframes and the explicit proxy/message boundary. [VERIFIED: AGENTS.md]
- Treat data as streams with partial/stale/updating state and prefer reactive derivation over duplicate state machines. [VERIFIED: AGENTS.md]
- Follow relative imports with explicit extensions, two-space Deno formatting, Fresh `class`, named exports for reusable modules, and `deno task check`. [VERIFIED: AGENTS.md]
- Run through GSD, verify, inspect the diff, and commit only intentional files. [VERIFIED: AGENTS.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|

All claims were verified from pinned packages, current code, project decisions, or cited browser documentation; no user confirmation is required. [VERIFIED: research audit]

## Open Questions

1. **Where do handler declarations live? — RESOLVED**
   - Exact signed manifest `archetype` tags; pinned runtime packages provide no decoder, so add a strict first-party codec at verified artifact enrichment. [VERIFIED: pinned/source audit]
2. **How is the canonical result status represented? — RESOLVED**
   - Through required `IntentResult.ok/handled` plus sanitized `error`; use `unavailable`, `denied`, and `failed` as stable portal reasons. [VERIFIED: pinned type; recommendation]
3. **How is a handler string interpreted? — RESOLVED**
   - As installed candidate dTag, disambiguated within current account/archetype/generation; ambiguity denies. [VERIFIED: candidate/preference types; recommendation]
4. **What payload bound applies? — RESOLVED**
   - Cap the serialized `request.payload` at 64 KiB and the full WebSocket frame at the existing 256 KiB. Reject cyclic/non-JSON/non-finite values and prototype-bearing objects via strict JSON round-trip/shape validation before navigation. [VERIFIED: existing transport bound; recommendation]
5. **Which default ordering applies? — RESOLVED**
   - Lexicographic dTag, then accepted manifest event ID; mark only the first current candidate default. [VERIFIED: recommendation]
6. **How does new-tab coexist with popup blockers? — RESOLVED**
   - Synchronously reserve from the trusted incoming message event, then asynchronously authorize and navigate only to a same-origin portal ticket URL; null/closed/timeout settles failed exactly once. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Window/open]
7. **How is payload delivered to the target? — RESOLVED**
   - Do not invent `intent.deliver`. Store a single-use backend launch ticket bound to account, caller, exact handler, convention, payload, expiry, and correlation; the target surface claims it after its exact artifact/runtime session is ready, through an internal portal message, not a public NAP envelope. [VERIFIED: absence in pinned contract + recommendation]
8. **Does `deno task dev` exercise production WebSocket navigation? — RESOLVED**
   - No; use `deno task build && deno task start` for the production runtime transport, as documented in project constraints. [VERIFIED: AGENTS.md/codebase stack]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Deno | source/tests/build | ✓ | 2.9.4 | — |
| Node/npm | package audit only | ✓ | Node 22.23.1 / npm 10.9.8 | No runtime dependency |
| Browser popup/history/sandbox APIs | manual UAT | Not probeable headlessly in this research | standards APIs | Pure controller fakes + Phase 9 real-device UAT |

**Missing dependencies with no fallback:** none. [VERIFIED: environment probe]

**Missing dependencies with fallback:** real mobile browser behavior is deferred to mandated real-device UAT; deterministic unit tests inject fake window/history/frame adapters. [VERIFIED: ROADMAP + recommendation]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing signed-in identity plus connection/window ownership. [VERIFIED: codebase] |
| V3 Session Management | yes | Reconnect-token/grace generation and per-window cleanup. [VERIFIED: codebase] |
| V4 Access Control | yes | Account + exact caller/handler identity + current catalog generation checks. [VERIFIED: locked decisions] |
| V5 Input Validation | yes | Strict exact-key INTENT/ack/tag codecs and byte bounds; no new validation package. [VERIFIED: project pattern] |
| V6 Cryptography | yes | Reuse Nostr signature verification and artifact hashing; never hand-roll. [VERIFIED: existing resolver] |

### Known Threat Patterns for Deno/Fresh + sandboxed frames

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged iframe sender/owner | Spoofing | Exact `event.source`, connectionId, windowId, account, and verified identity binding. [VERIFIED: existing bridge] |
| Stale catalog handler | Elevation of privilege | Generation recheck before commit; uninstall revokes immediately. [VERIFIED: locked decision] |
| Arbitrary URL/popup injection | Tampering | Generated same-origin ticket URL only; reject caller URL/window name. [VERIFIED: locked decision] |
| Payload exhaustion/prototype abuse | Denial of service / Tampering | 64 KiB JSON payload, depth/key limits, own plain data only. [VERIFIED: recommendation] |
| Cross-frame payload disclosure | Information disclosure | Single-use account/caller/target-bound ticket; deliver only after exact artifact verification. [VERIFIED: recommendation] |
| Duplicate settlement/replay | Repudiation / Tampering | Opaque backend correlation, generation, idempotent terminal state, expiry. [VERIFIED: existing correlation pattern] |

## Sources

### Primary (HIGH confidence)

- Installed `@napplet/core@0.31.0/dist/index.d.ts` — exact public INTENT request/result/availability types.
- Installed `@napplet/nap@0.31.0/dist/intent/*` and source maps — exact envelope types and shim behavior.
- `deno.json`, `runtime/catalog.ts`, `runtime/artifacts.ts`, `runtime/portal_runtime.ts`, `runtime/transport.ts`, `routes/api/runtime.ts`, `components/NappletFrame.tsx`, `islands/NappletShell.tsx`, and current tests — live project seams.
- Sibling `../napplet` 0.31.0 source — reference-only canonical archetype producer and conformance behavior; no production import recommended.
- npm registry and GSD package-legitimacy seam — versions, dates, repositories, scripts, and audit signals.

### Secondary (MEDIUM confidence)

- https://developer.mozilla.org/en-US/docs/Web/API/Window/open — popup, new browsing context, `noopener`, focus, and activation behavior.
- https://developer.mozilla.org/en-US/docs/Web/API/History/pushState — same-document history state.
- https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event — traversal notification.
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe — sandbox token and special-origin behavior.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing locked pins and installed declarations were inspected.
- Architecture: HIGH — derived from current ownership/verification seams and locked decisions.
- Browser lifecycle: MEDIUM — official MDN documentation; real-device behavior still needs UAT.
- Pitfalls: HIGH — tied to current code, pinned contracts, and explicit lifecycle tests.

**Research date:** 2026-07-31
**Valid until:** 2026-08-07 (contract/browser-sensitive phase)
