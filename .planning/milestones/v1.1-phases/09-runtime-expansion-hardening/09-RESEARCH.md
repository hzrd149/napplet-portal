# Phase 9: Runtime Expansion Hardening - Research

**Researched:** 2026-07-31
**Domain:** Contract conformance, adversarial security, deterministic integration verification, and mobile acceptance
**Confidence:** HIGH for repository/contract inventory; MEDIUM for browser automation and physical-device behavior

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Contract parity and traceability
- Inventory every v1.1 NAP domain and pinned 0.31.0 request/result/event codec, then map each to dispatcher, capability, and test evidence.
- Fix the known REQUIREMENTS/ROADMAP traceability bookkeeping debt so all 33 requirements map exactly once with honest completion status.
- Add codec-derived fixtures or conformance tables rather than duplicating hand-written contract shapes.
- Treat missing, invented, or silently ignored actions as release-blocking gaps.

### Adversarial boundaries
- Exercise capabilities, exact catalog authority, signer separation, storage namespace isolation, URL/redirect policy, sandbox attributes, and generation ownership with hostile inputs.
- Prefer deny-by-default property/table tests around closed validators and reducers, plus end-to-end boundary tests for integration seams.
- Verify errors are sanitized and no secret, local path, private destination, or cross-account data reaches napplets.
- Re-audit CSP, Permissions-Policy, iframe sandbox, origin/source checks, and production WebSocket token/grace handling.

### Failure and lifecycle coverage
- Cover normal, empty, partial, stale, denied, timeout, reconnect, replacement, shutdown, and mixed-settlement paths for every expanded domain.
- Run formatting, lint, type-check, full tests, production build/start smoke, and deterministic multi-client transport checks.
- Eliminate flaky timing with injected clocks/transports and bounded eventual assertions.
- Preserve stream-oriented partial truth; tests must not force reactive services into wait-for-complete semantics.

### Mobile and unattended acceptance
- Automate viewport, accessibility, reduced-motion, theme, history, reconnect, intent, and cross-tab ownership evidence wherever browser tooling permits.
- Carry unresolved real-device/live-relay/Blossom checks from earlier verifiers into one explicit Phase 9 UAT matrix.
- In this unattended run, accept perceptual/live-service checks only when all automated must-haves pass, documenting them as residual release risks rather than claiming they ran.
- Provide concise reproducible manual scripts for any physical-device or external-service checks that cannot be automated locally.

### Explicit autonomous-run authorization
- D-17: The user's original autonomous overnight instruction expressly authorizes non-interactive, evidence-based safe dependency decisions and says never to pause. This is a direct user authorization artifact, not an inference from `workflow.auto_advance` or any other setting.
- D-18: The user accepts `@playwright/test@1.62.1` as `USER-AUTHORIZED residual SUS risk` based on the official package identity, exact registry version/tarball evidence, high adoption, and no lifecycle install scripts. Pin exactly and proceed without a legitimacy checkpoint; this exception applies to no other package or version.
- D-19: The user requires typed goal-backward verifier output for Phases 6-8 even though `.planning/config.json` sets `workflow.verifier=false`; the autonomous orchestrator must create the canonical verification artifacts before Plan 09-01 executes.

### the agent's Discretion
Choose testing tools and remediation order, prioritizing security/contract correctness first, deterministic integration evidence second, and cosmetic polish last.

### Deferred Ideas (OUT OF SCOPE)
Physical-device and public-service observations that cannot run in this environment remain explicit post-milestone release checks; they are never represented as automated passes.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QLT-01 | Every added NAP domain is checked against the pinned production packages with contract and dispatcher tests; sibling repositories remain reference-only. | Generate an exhaustive codec/action matrix directly from pinned `@napplet/core@0.31.0` and `@napplet/nap@0.31.0` exports, with one explicit implementation/capability/test disposition per row. [VERIFIED: `deno.json`, pinned package declarations, `09-CONTEXT.md`] |
| QLT-02 | Napplet-controlled input cannot bypass sandboxing, capability checks, URL/resource policy, storage isolation, signer boundaries, or catalog launch authority. | Use closed hostile-input tables at each validator/reducer plus integrated tests at iframe, WebSocket, dispatcher, persistence, URL, and account/generation seams. [VERIFIED: `09-CONTEXT.md`, current repository boundary inventory] |
| QLT-03 | Automated tests cover normal, empty, partial, denied, stale, reconnect, and failure behavior for each new runtime seam, and `deno task check` passes. | Require a domain-by-lifecycle matrix, deterministic fake clocks/transports, full suite, coverage report, production build/start, and two-client smoke. [VERIFIED: `09-CONTEXT.md`, official Deno testing docs] |
| QLT-04 | Mobile-browser UAT verifies navigation, themes, connection recovery, stacked/new-tab intent behavior, and cross-tab media ownership on supported real devices. | Automate browser-observable must-haves and record physical-device/live-service rows as `NOT RUN — accepted residual risk` with reproducible scripts; never convert deferral into an executed pass. [VERIFIED: `09-CONTEXT.md`, prior Phase 3/4 verification deferrals] |
</phase_requirements>

## Summary

Phase 9 should be planned as an evidence-producing hardening phase with remediation discovered from the evidence, not as a broad feature phase. The canonical artifact should be one generated contract/action parity matrix joined to an adversarial/lifecycle evidence matrix and the 33-requirement ledger. A row is releasable only when its pinned codec, direction, capability exposure, decoder/dispatcher path, terminal behavior, and test are explicit; unsupported rows must be explicitly non-advertised and rejected rather than silently ignored. [VERIFIED: `09-CONTEXT.md`, pinned 0.31.0 declarations]

The current baseline is healthy but incomplete: `deno task check` and the complete test suite pass with 168 tests, including a production Fresh WebSocket reconnect smoke. The checked-in code currently contains Phase 3-5 implementation only; Phase 6-8 have research/plans but no corresponding common, storage, intent, or media modules/tests yet. `createIframeBridge()` advertises only `shell`, `identity`, `relay`, and `outbox`, and forwards only identity/relay/outbox; Phase 5 RESOURCE/UPLOAD uses a separate dispatcher path. These facts make parity generation and exact routing ownership the first Phase 9 planning task after Phase 6-8 execution, because today's inventory is expected to change. [VERIFIED: 2026-07-31 `deno task check && deno task test`; `components/NappletFrame.tsx`; `runtime/nap_dispatcher.ts`; repository file inventory]

Traceability is factually stale even though its arithmetic is correct: REQUIREMENTS maps all 33 IDs exactly once, but CAT-01..04 remain `Pending` in the traceability table while their requirement checkboxes and Phase 4 verification are complete; ROADMAP marks Phase 5 neither complete nor planned despite four completed summaries; STATE still stops at Phase 5 while Phase 7/8 planning commits exist. Phase 9 must reconcile status from implementation plus verification evidence, not from checkboxes alone. [VERIFIED: `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, Phase 4/5 artifacts, git log]

**Primary recommendation:** Build one mechanically complete release ledger first, remediate all red rows in security-first order, then run deterministic unit/integration/browser/production gates and publish an honest UAT matrix whose unexecuted physical/live rows remain residual risks. [VERIFIED: locked remediation priority in `09-CONTEXT.md`]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pinned codec/action inventory | API / Backend | Build/Test tooling | Backend owns dispatch semantics; a generator/test owns exhaustive comparison to pinned package exports. [VERIFIED: project architecture and QLT-01] |
| Capability authorization | API / Backend | Browser / Client | Backend derives exact verified napplet authority; client only source-binds the iframe and exposes granted capabilities. [VERIFIED: `runtime/artifacts.ts`, `components/NappletFrame.tsx`] |
| URL, upload, signer, storage, catalog, intent, media policy | API / Backend | Database / Storage | Security decisions and durable/generation state are process-owned; browser messages are untrusted requests. [VERIFIED: AGENTS.md and Phases 4-8 decisions] |
| Iframe sandbox and message source binding | Browser / Client | Frontend Server (SSR) | The iframe element/WindowProxy live in the browser; SSR headers constrain the containing document. [VERIFIED: `components/NappletFrame.tsx`, MDN iframe/postMessage docs] |
| CSP and Permissions-Policy | Frontend Server (SSR) | Browser / Client | Response headers establish policy; the iframe `allow` attribute may only narrow inherited permissions. [CITED: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Permissions_Policy] |
| Durable isolated napplet storage | Database / Storage | API / Backend | Persistence owns bytes/quotas while backend authorization derives account, verified identity, and scope out of band. [VERIFIED: Phase 6 context/research] |
| Multi-client lifecycle authority | API / Backend | Browser / Client | Backend orders generations/ownership; clients enact current projections and stop stale local behavior. [VERIFIED: Phase 8 context/research] |
| Mobile/browser acceptance | Build/Test tooling | Browser / Client | Browser automation supplies repeatable evidence; real devices remain a separate observational gate. [VERIFIED: `09-CONTEXT.md`; official Playwright docs] |

## Project Constraints (from AGENTS.md)

- Use Deno and Fresh; routes own SSR and islands own only browser interactivity. [VERIFIED: AGENTS.md]
- Keep complex Nostr, persistent state, relay/Blossom operations, accounts, storage, and NAP dispatch in the backend runtime. [VERIFIED: AGENTS.md]
- Prefer Applesauce and RxJS stream composition, derived reactive state, partial/updating truth, and no nested subscriptions or wait-for-complete UI semantics. [VERIFIED: AGENTS.md]
- Production imports must use pinned npm packages, including `@napplet/core@0.31.0` and `@napplet/nap@0.31.0`; `../kehto` and `../napplet` are reference-only. [VERIFIED: AGENTS.md]
- Napplets remain in sandboxed iframes and NAP crosses an explicit proxy/message boundary. [VERIFIED: AGENTS.md]
- Local Nostr relay and Blossom cache connections remain supported, while untrusted napplets never gain direct backend authority. [VERIFIED: AGENTS.md]
- Use explicit `.ts`/`.tsx` local imports, Deno formatting/lint/check, existing naming/export conventions, and direct Web `Response` handling. [VERIFIED: AGENTS.md]
- `deno task check` is mandatory; production WebSocket verification must use `deno task build && deno task start`, not Vite dev. [VERIFIED: AGENTS.md]
- Preserve concurrent untracked `.planning/research/.cache/*.json` files; they are research cache state outside this artifact's commit. [VERIFIED: 2026-07-31 git status]

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| Deno | 2.9.4 | Test runner, fake/injected collaborators, coverage, subprocess/WebSocket harnesses | Existing runtime and quality gate; official docs support test doubles, fake time, and V8 coverage. [VERIFIED: `deno --version`; CITED: https://docs.deno.com/runtime/test/] |
| Fresh | 2.3.3 | Production SSR/runtime and WebSocket endpoint under build/start | Existing foundation; real upgrade path is already proven by `runtime_reconnect_smoke_test.ts`. [VERIFIED: `deno.json`, passing baseline smoke] |
| `@napplet/core` | 0.31.0 | Canonical shared request/result/value types | Project-locked executable contract authority. [VERIFIED: `deno.json`, installed declarations] |
| `@napplet/nap` | 0.31.0 | Canonical domain message unions/subpath exports | Project-locked executable contract authority. [VERIFIED: `deno.json`, installed declarations] |
| Existing Deno tests | 168 passing | Unit, component-string, integration, and production reconnect baseline | No framework migration is needed for core correctness evidence. [VERIFIED: 2026-07-31 full run] |

### Supporting

| Library / Tool | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| `@playwright/test` | 1.62.1 | Real Chromium viewport, media preference, focus/history, popup/tab, accessibility-tree/semantic, and cross-tab automation | Add in the browser acceptance wave with the exact pin and reuse installed `/snap/bin/chromium`; D-17/D-18 explicitly accept the evidence-backed residual `SUS (too-new)` risk without pausing. [VERIFIED: official Playwright docs; npm registry; direct user authorization] |
| Chromium | locally installed | Browser automation target | Use for deterministic local browser checks; do not call Chromium coverage equivalent to iOS Safari/Android vendor-device UAT. [VERIFIED: `/snap/bin/chromium`; `09-CONTEXT.md`] |
| Deno `--coverage` / `deno coverage` | 2.9.4 | Gap discovery and archived coverage report | Use after all domain/lifecycle tests; coverage percentage is supporting evidence, not parity evidence. [CITED: https://docs.deno.com/runtime/test/] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Codec-derived matrix | Hand-written fixture inventory | Hand-written lists can omit new/renamed union members and reproduce the contract instead of checking it. [VERIFIED: QLT-01 and locked decision] |
| Playwright browser wave | More TSX string tests only | Existing string tests are fast but cannot prove computed layout, focus movement, history, popup, media-query, or multi-page browser behavior. [VERIFIED: current tests; official Playwright pages/emulation docs] |
| Injected clocks/transports | Wall-clock sleeps | Sleeps introduce race-dependent flakiness and slow failure diagnosis; retain bounded eventual polling only at the real process/network boundary. [VERIFIED: `09-CONTEXT.md`; official Deno testing docs] |
| One release ledger | Separate prose coverage files | Separate ledgers already drift; generation plus a single join key exposes omissions and status contradictions. [VERIFIED: current REQUIREMENTS/ROADMAP/STATE debt] |

**Installation (authorized non-interactively by D-17/D-18):**

```bash
deno add --dev npm:@playwright/test@1.62.1
```

No production dependency should be added or upgraded. [VERIFIED: phase scope and existing stack]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@playwright/test` | npm | exact 1.62.1 published 2026-07-30; exact registry tarball/version documented | 50,166,893/week | github.com/microsoft/playwright | SUS (`too-new`); official identity and no lifecycle install scripts verified | `USER-AUTHORIZED residual SUS risk` per D-17/D-18; pin exactly, preserve lock evidence, and do not pause or add a checkpoint. [VERIFIED: npm registry/package metadata and direct user authorization] |

**Packages removed due to [SLOP] verdict:** none recommended. [VERIFIED: audit]
**Packages flagged as suspicious [SUS]:** `@playwright/test@1.62.1`; the residual too-new signal is explicitly accepted by the user under D-17/D-18, so the exact pin requires no checkpoint. [VERIFIED: package-legitimacy evidence and direct user authorization]

## Contract and Action Parity Matrix

The final matrix must be generated from pinned declarations and committed as machine-readable data (recommended `tests/fixtures/v1_1_contract_matrix.json`) plus a readable report. Each row needs: domain, exact message type, direction, codec/type source, advertised capability, decoder, dispatcher/service, terminal/stream semantics, requirement IDs, test name, and disposition `SUPPORTED | EXPLICIT_DENY | OUT_OF_SCOPE_NOT_ADVERTISED`. Any absent field or `SILENT_IGNORE` is a release blocker. [VERIFIED: `09-CONTEXT.md`; pinned declarations]

| Domain | Pinned 0.31.0 action families to inventory | v1.1 expected ownership | Current baseline / likely gap |
|--------|-------------------------------------------|-------------------------|-------------------------------|
| SHELL | `shell.ready`, `shell.init` | Browser handshake + backend-projected grants | Existing source-bound init exists; ensure grants are derived from exact verified capabilities rather than a global constant. [VERIFIED: `components/NappletFrame.tsx`, runtime tracer] |
| IDENTITY | getPublicKey, getRelays, getProfile, getFollows, getList, getZaps, getMutes, getBlocked, getBadges; results; `identity.changed` | Existing backend identity seam | The domain contains more pinned actions than the visible runtime evidence; every advertised action needs support or explicit non-advertisement/denial. [VERIFIED: pinned `identity/types.d.ts`, current tests] |
| RELAY | subscribe/close/publish/query/publishEncrypted; event/eose/closed/results | Existing relay adapter/outbox signer seam | Current stream tests are strong; inventory exact codecs, encrypted signing, duplicates, closure, errors, and correlation. [VERIFIED: pinned `relay/types.d.ts`, `tests/relay_stream_test.ts`] |
| OUTBOX | getEvent/query/subscribe/close/publish/resolveRelays; results/events/closed | Existing outbox service | Ensure every domain-advertised action is dispatched; current code/tests do not visibly prove every pinned family. [VERIFIED: pinned `outbox/types.d.ts`, current test inventory] |
| RESOURCE | info/bytes/bytesMany/cancel; info/result/error frames | `NapDispatcher` + binary transport + resource service | Implemented through a separate dispatcher, but the iframe bridge's static allowlist does not advertise/forward RESOURCE; unify or explicitly route this seam and prove it end to end. [VERIFIED: `runtime/nap_dispatcher.ts`, `components/NappletFrame.tsx`] |
| UPLOAD | info/upload/status; results and `status.changed` | `NapDispatcher` + binary transport + Blossom transfer | Implemented backend seam; exact bridge/capability path and late/foreign binary ownership require full end-to-end evidence. [VERIFIED: Phase 5 code/tests] |
| COMMON | encodeNip19/decodeNip19/getProfile/follows/follow/unfollow/react/report; results | Phase 6 backend common service | Planned, not present in current code; distinguish read streams/helpers from signer-required writes and cover all pinned actions. [VERIFIED: pinned `common/types.d.ts`, repository inventory, Phase 6 plans] |
| STORAGE | get/set/remove/keys; results | Phase 6 durable store + dispatcher | Planned, not present in current code; matrix must bind account, verified identity, shared/per-instance scope, serialization, quotas, replacement, restart, and denial. [VERIFIED: pinned `storage/types.d.ts`, Phase 6 artifacts] |
| INTENT | invoke/available/handlers; results and `changed` | Phase 7 catalog-derived registry + shell navigation | Planned, not present in current code; canonical contract lacks portal generation/navigation internals, so keep those in a separate exact portal protocol. [VERIFIED: pinned `intent/types.d.ts`, Phase 7 research/plans] |
| MEDIA | capabilities/command/controls/session.create/update/destroy/state; create result | Phase 8 coordinator + shell actuator | Planned, not present in current code; inventory owner/peer direction and keep generation/snapshot coordination out of canonical media envelopes. [VERIFIED: pinned `media/types.d.ts`, Phase 8 research/plans] |

The matrix should compare extracted literal discriminants rather than type names alone, because direction unions and result/event variants can share payload types while requiring different routing. Compile-time type assertions are necessary but insufficient; round-trip exact-key runtime fixtures must reject extra keys, wrong directions, invented messages, and malformed values. [VERIFIED: pinned declaration structure and existing `binary_transport_test.ts` pattern]

## Traceability Debt and Canonical Status Rules

| Debt | Evidence | Required Phase 9 resolution |
|------|----------|-----------------------------|
| CAT-01..04 checked complete but traceability says Pending | REQUIREMENTS checkboxes and Phase 4 verification conflict with its traceability row. [VERIFIED: planning artifacts] | Change traceability to Complete, with Phase 4 verification link/evidence. |
| Phase 5 completed but ROADMAP phase/plans remain incomplete/absent | Four Phase 5 summaries and passing tests exist while roadmap checkbox is open. [VERIFIED: phase artifacts, ROADMAP] | Add 4/4 plan ledger and mark complete only because implementation and verification evidence exist. |
| Phases 6-8 planning status is mixed with implementation status | Phase 6-8 PLAN files exist; current implementation modules/tests do not yet exist. [VERIFIED: repository inventory] | Keep requirements Pending until execution plus verification; plan existence is not completion. Recalculate at Phase 9 execution time. |
| STATE is stale | It records Phase 5 stop despite Phase 7/8 planning commits. [VERIFIED: STATE, git log] | Regenerate state from actual phase artifacts without rewriting historical metrics speculatively. |
| “Mapped exactly once: 33” is not independently checked | Counts are prose. [VERIFIED: ROADMAP/REQUIREMENTS] | Add a deterministic test/parser that extracts each requirement ID, asserts 33 unique IDs, one phase mapping each, legal status, and status/evidence consistency. |

Canonical completion rule: `Complete` requires implemented behavior plus passing verification evidence; `Pending` means no accepted evidence; `Accepted — UAT deferred` is allowed only for explicitly locked physical/live rows and must never be rendered as “tested” or “passed.” [VERIFIED: `09-CONTEXT.md`; recommendation]

## Architecture Patterns

### System Architecture Diagram

```text
pinned @napplet/core/@napplet/nap 0.31.0 exports
                         |
                         v
             discriminant/codec extractor
                         |
                         v
 manifest grants -> parity matrix <- dispatcher/service registry <- requirement ledger
       |                 |                    |                         |
       |          missing/invented/silent     |                         |
       |                 +----> RELEASE BLOCKER <----------------------+
       v
sandboxed iframe -- exact WindowProxy/source --> shell bridge
       |                                             |
       | canonical NAP request                       | authenticated outer context
       v                                             v
 closed decoder -> capability gate -> domain dispatcher -> process-owned service/store
       |                 |                 |                    |
       +------ hostile/denied/error tests --+                    |
                              |                                  v
                              +---------- sanitized projection/result

deterministic unit/table tests -> integrated fake transport -> built Fresh server
                                                            -> 2+ WebSocket clients
                                                            -> Chromium browser wave
                                                            -> honest UAT matrix
```

### Recommended Project Structure

```text
runtime/
├── nap_contract_registry.ts       # canonical domain/action dispatch metadata
├── security_headers.ts            # closed CSP/Permissions-Policy policy
└── ... existing and Phase 6-8 services
tests/
├── fixtures/v1_1_contract_matrix.json
├── contract_parity_test.ts
├── adversarial_boundaries_test.ts
├── lifecycle_matrix_test.ts
├── requirement_traceability_test.ts
├── production_multiclient_smoke_test.ts
└── browser/portal_acceptance_test.ts
playwright.config.ts               # exact 1.62.1 pin authorized by D-17/D-18
.planning/phases/09-runtime-expansion-hardening/
├── 09-RESEARCH.md
├── CONTRACT-PARITY.md             # generated readable evidence
├── UAT-MATRIX.md                  # automated + explicitly not-run manual rows
└── 09-VERIFICATION.md
```

### Pattern 1: Generated exhaustive parity, explicit dispatch registry

**What:** Extract canonical message discriminants from pinned package exports/declarations into a fixture, then join them against one first-party registry that declares direction, capability, handler, result/event family, and disposition. [VERIFIED: locked codec-derived decision; recommendation]

**When to use:** Every canonical message entering or leaving the napplet boundary.

```typescript
// Source: pinned @napplet/nap@0.31.0 declarations + project registry pattern
type Disposition = "SUPPORTED" | "EXPLICIT_DENY" |
  "OUT_OF_SCOPE_NOT_ADVERTISED";

interface ContractRow {
  readonly type: string;
  readonly direction: "napplet-to-shell" | "shell-to-napplet";
  readonly domain: string;
  readonly capability: string;
  readonly disposition: Disposition;
  readonly handler?: string;
  readonly test: string;
}
```

The test should fail for `canonical - registry`, `registry - canonical`, an advertised unsupported row, missing evidence, or a row that falls through silently. [VERIFIED: QLT-01 and locked decisions]

### Pattern 2: Deny-by-default boundary tables

**What:** For each closed decoder/policy, generate hostile cases by changing one dimension: missing/extra key, wrong type, oversized value, forbidden scheme/address/redirect, foreign source/account/identity, stale catalog ID/generation, invalid scope, duplicate correlation, or post-shutdown arrival. Assert no effect first, then sanitized stable denial. [VERIFIED: `09-CONTEXT.md`; OWASP authorization/WebSocket guidance]

**When to use:** Iframe messages, WebSocket frames, catalog commands, binary transfers, storage operations, intent tickets, and media controls.

### Pattern 3: Deterministic lifecycle model plus thin real transport smoke

**What:** Put clocks, ID generation, timers, fetches, relay/Blossom transports, persistence, browser surfaces, and sends behind injected ports. Exhaustively test reducers/services without sleeps; reserve bounded eventual polling for subprocess readiness and network frames in the built-server smoke. [VERIFIED: locked decisions; official Deno testing docs; existing smoke pattern]

**When to use:** timeout, retry, reconnect grace, replacement, teardown, mixed settlement, concurrent transfers, and late completion.

### Pattern 4: Layered browser acceptance

**What:** Run static/SSR semantic checks first, Chromium automation second, and physical-device/live-service scripts last. Browser automation must use phone-size viewports, light/dark and reduced-motion emulation, keyboard-only navigation, focus assertions, history traversal, popup/new-tab capture, two pages in one context, and accessibility state assertions. [CITED: https://playwright.dev/docs/pages] [CITED: https://playwright.dev/docs/api/class-page]

**When to use:** Theme, safe-area/responsive layout, reconnect UI, dialogs/focus, intent navigation modes, and media ownership controls.

### Anti-Patterns to Avoid

- **Broad domain grant with partial silent dispatch:** A manifest sees a domain it cannot reliably use; make action support complete or do not advertise it. [VERIFIED: current bridge/static-domain gap]
- **Hand-copying canonical unions:** Drift and omissions become likely; derive literal discriminants and exact fixtures from the pinned package. [VERIFIED: locked decision]
- **Coverage percentage as contract proof:** Executed lines do not prove every canonical action/direction is represented. [VERIFIED: QLT-01 distinction]
- **`Promise.all` as stream acceptance:** It erases partial/stale/updating truth and violates the reactive loading model. [VERIFIED: AGENTS.md]
- **Sleeping through races:** Wall time makes reconnect/transfer/storage tests flaky; drive injected time and settle effects explicitly. [VERIFIED: locked decision]
- **Calling Chromium “real-device UAT”:** Desktop emulation cannot establish iOS Safari backgrounding, mobile viewport chrome, autoplay, or vendor networking behavior. [VERIFIED: `09-CONTEXT.md` distinction]
- **Marking deferred UAT passed:** Use `NOT RUN — accepted residual risk`, owner, script, and release consequence. [VERIFIED: locked unattended acceptance]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NAP shapes | Parallel first-party interfaces/codecs | Pinned 0.31.0 exports plus derived fixtures | The pinned packages are executable authority. [VERIFIED: AGENTS.md] |
| NIP-19 primitives | Custom bech32/NIP-19 implementation | Existing pinned Nostr helpers used by Phase 6 | Encoding variants and validation are contract-sensitive. [VERIFIED: Phase 6 research] |
| Browser engine simulation | Fake DOM claiming layout/history/popup proof | Playwright + installed Chromium after checkpoint | A real engine is required for these behaviors. [VERIFIED: official Playwright docs] |
| Accessibility score | One home-grown numeric score | Semantic assertions, keyboard/focus flows, contrast checks, and browser accessibility evidence | No single score proves usable behavior. [VERIFIED: existing project accessibility patterns; recommendation] |
| SSRF parsing/resolution | New URL heuristics | Existing `resource_policy.ts` and hostile regression table | Current policy already handles ambiguous URLs, DNS classes, and redirects. [VERIFIED: passing resource policy tests] |
| Authorization state | Client-supplied account/identity/generation | Existing process-owned connection/catalog/account authority | Client fields are attacker-controlled. [VERIFIED: project architecture]
| Reactive completion | Aggregate wait-for-all loader | Applesauce/RxJS partial projections and injected streams | Nostr truth remains partial and updating. [VERIFIED: AGENTS.md] |

**Key insight:** Phase 9 should compose and audit the existing authorities; creating alternative codecs, stores, security parsers, or browser simulators would increase the very drift it is meant to remove. [VERIFIED: phase goal and project constraints]

## Common Pitfalls

### Pitfall 1: Matrix covers domains but misses actions or direction
**What goes wrong:** A domain is marked supported while a result/event or less-common request falls through. [VERIFIED: pinned domains contain multiple asymmetric unions]
**Why it happens:** Review stops at package subpath names or compile-time imports. [VERIFIED: current `runtime_contract_test.ts` scope]
**How to avoid:** Extract every literal `type`, direction, and terminal family; require a registry/evidence join. [VERIFIED: recommendation]
**Warning signs:** Global domain arrays, regex forwarding, switch defaults with no denial, or matrix rows without exact discriminants. [VERIFIED: current bridge pattern]

### Pitfall 2: Security headers break runtime or remain absent
**What goes wrong:** Over-broad CSP leaves a bypass, while over-tight `connect-src`/script rules break Fresh, WebSocket, blob, or verified `srcdoc` behavior. [CITED: https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/CSP]
**Why it happens:** Policies are copied without enumerating actual shell and napplet resource flows. [ASSUMED]
**How to avoid:** Derive a closed header table from observed flows, assert exact production response headers, and run the built browser smoke under enforcement. [VERIFIED: recommendation]
**Warning signs:** `*`, `unsafe-eval`, missing `frame-ancestors`, permissions enabled without a requirement, or tests that inspect source constants but not HTTP responses. [CITED: MDN CSP and Permissions Policy docs]

### Pitfall 3: Opaque `srcdoc` origin is misunderstood
**What goes wrong:** Code expects a normal exact origin even though sandbox without `allow-same-origin` yields an opaque/null origin, or trusts origin without exact `event.source`. [CITED: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/sandbox]
**How to avoid:** Preserve exact `sandbox="allow-scripts"`, bind the registered `contentWindow`, validate message syntax/capability, and minimize wildcard-target payloads. [VERIFIED: current frame architecture; CITED: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage]
**Warning signs:** adding `allow-same-origin`, accepting messages by type alone, or forwarding portal generation/account data into the napplet. [VERIFIED: project boundary]

### Pitfall 4: Cross-account/generation leaks appear only on lifecycle edges
**What goes wrong:** Late async completion, reconnect, replacement, detach, sign-out, or shutdown sends old-account/storage/media/catalog truth to a new owner. [VERIFIED: Phase 4-8 lifecycle decisions]
**How to avoid:** Re-check authority immediately before every effect/send and assert zero deliveries for foreign/stale actors in each lifecycle row. [VERIFIED: established generation pattern]
**Warning signs:** authority captured once before `await`, mutable module-global browser state, or cleanup that only runs on unload. [VERIFIED: prior phase research]

### Pitfall 5: Mixed settlement is collapsed
**What goes wrong:** RESOURCE batch, multi-server upload, relay publish, or stream outcomes become all-success/all-failure and lose partial truth. [VERIFIED: Phase 5 requirements/tests]
**How to avoid:** Preserve ordered per-item/per-server outcomes and independently terminalize correlations. [VERIFIED: existing tests]
**Warning signs:** `Promise.all` rejection, one generic error, or missing optional-local outcome. [VERIFIED: `blossom_transfer_test.ts`]

### Pitfall 6: Traceability is repaired cosmetically
**What goes wrong:** Checkboxes align but do not link to executable evidence, or planned phases are marked complete. [VERIFIED: current ledger debt]
**How to avoid:** Parse IDs and status mechanically; require verification artifact/test references for Complete. [VERIFIED: recommendation]
**Warning signs:** total remains 33 but row status conflicts with requirement checkbox or phase verification. [VERIFIED: current CAT conflict]

### Pitfall 7: Automated emulation overclaims device evidence
**What goes wrong:** Chromium viewport tests are reported as iOS/Android physical-device validation. [VERIFIED: locked UAT boundary]
**How to avoid:** Separate `AUTOMATED PASS`, `MANUAL PASS`, and `NOT RUN — ACCEPTED RESIDUAL RISK`; retain exact device/service scripts. [VERIFIED: recommendation]
**Warning signs:** no device/browser/version/date/operator fields or an unattended run claiming touch/background/autoplay observation. [VERIFIED: `09-CONTEXT.md`]

## Code Examples

### Exhaustive registry join

```typescript
// Source: recommendation derived from pinned @napplet/nap@0.31.0 unions
const canonical = new Set(extractedRows.map((row) => row.type));
const registered = new Set(registry.map((row) => row.type));

assertEquals([...canonical].filter((type) => !registered.has(type)), []);
assertEquals([...registered].filter((type) => !canonical.has(type)), []);
assertEquals(
  registry.filter((row) => row.disposition === "SUPPORTED" && !row.test),
  [],
);
```

### Bounded eventual assertion only at real transport boundary

```typescript
// Source: existing production smoke pattern + deterministic-test recommendation
async function eventually<T>(
  read: () => T | undefined,
  deadlineMs = 2_000,
): Promise<T> {
  const deadline = performance.now() + deadlineMs;
  while (performance.now() < deadline) {
    const value = read();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("bounded eventual assertion timed out");
}
```

Use injected clocks for all unit/service tests; this helper belongs only in subprocess/WebSocket/browser smoke code. [VERIFIED: locked deterministic policy]

### Honest UAT row

```typescript
// Source: 09-CONTEXT.md locked unattended acceptance
type UatStatus =
  | "AUTOMATED_PASS"
  | "MANUAL_PASS"
  | "NOT_RUN_ACCEPTED_RESIDUAL_RISK";
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-written sample contract fixtures | Codec-derived exhaustive action/direction matrix joined to dispatch and tests | Phase 9 locked decision | Missing/invented/silent actions become mechanical blockers. [VERIFIED: `09-CONTEXT.md`] |
| String-render UI checks only | Layered Deno semantics + real Chromium viewport/media/history/multi-page automation | Phase 9 recommendation | Browser behavior is exercised without mislabeling emulation as physical-device UAT. [VERIFIED: current tests; official Playwright docs] |
| Wall-clock race tests | Injected time/transports plus bounded eventual assertions only at real boundaries | Phase 9 locked decision | Faster, reproducible lifecycle evidence. [VERIFIED: `09-CONTEXT.md`] |
| Checkbox traceability | Evidence-backed unique-ID ledger | Phase 9 recommendation | Completion status becomes auditable and internally consistent. [VERIFIED: current bookkeeping debt] |

**Deprecated/outdated:** The existing static `DOMAINS` constant and regex forwarding in `components/NappletFrame.tsx` cannot be the final v1.1 contract authority; replace or derive them from exact verified grants and the central registry. [VERIFIED: current code and QLT-01]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CSP breakage commonly results from copying policies without enumerating actual flows. | Common Pitfalls 2 | Low; the plan still must derive and test exact policies from this application. |

## Open Questions (RESOLVED)

1. **Does Phase 9 implement every action in every package domain?**
   - What we know: the locked scope is every v1.1 domain/action that is advertised or used, not the entire package's unrelated domains. [VERIFIED: `09-CONTEXT.md`, REQUIREMENTS Out of Scope]
   - Resolution: enumerate all codecs within the ten in-scope domains, then mark each `SUPPORTED` or `OUT_OF_SCOPE_NOT_ADVERTISED`; an advertised action may not be out of scope or silent. Unrelated LINK/INC/CONFIG/KEYS/VALUE/POW/etc. remain out of scope. [VERIFIED: REQUIREMENTS]

2. **Should RESOURCE/UPLOAD remain a separate dispatcher?**
   - What we know: binary transport requires specialized framing, but capability/identity must be shared. [VERIFIED: Phase 5 architecture]
   - Resolution: it may remain a specialized dispatcher, but the central registry/bridge must route it explicitly under the same exact grants and owner context; parallel authorization is not acceptable. [VERIFIED: recommendation]

3. **What browser tool should be used?**
   - What we know: Chromium is installed; Playwright officially supports viewport, reduced-motion, and multi-page contexts; `@playwright/test` is current but the legitimacy seam flags its fresh release SUS. [VERIFIED: environment audit, official docs, npm/seam]
   - Resolution: pin `@playwright/test@1.62.1` exactly and record `USER-AUTHORIZED residual SUS risk`; D-17/D-18 explicitly authorize proceeding non-interactively on the documented evidence, so no checkpoint is added. [VERIFIED: package gate evidence and direct user authorization]

4. **Can QLT-04 be marked complete unattended?**
   - What we know: the requirement says real devices, while CONTEXT explicitly accepts unexecutable perceptual/live checks as residual risks after all automated must-haves pass. [VERIFIED: REQUIREMENTS, `09-CONTEXT.md`]
   - Resolution: the phase may record the locked acceptance decision, but the device/live rows remain `NOT RUN — accepted residual risk`, not `PASS`. REQUIREMENTS should preserve that honest qualifier rather than claim empirical verification. [VERIFIED: locked decision]

5. **When should traceability be reconciled given Phases 6-8 are not currently implemented?**
   - What we know: plans exist but code does not yet. [VERIFIED: repository inventory]
   - Resolution: Phase 9 must inventory at its execution start, then update statuses only after each requirement has implementation and passing evidence. Never infer completion from plan presence. [VERIFIED: recommendation]

6. **Is a coverage percentage target required?**
   - What we know: no locked numeric target exists; behavior/lifecycle and contract parity are the actual requirements. [VERIFIED: CONTEXT/REQUIREMENTS]
   - Resolution: produce coverage output to reveal unexecuted code, but gate on zero uncovered contract/lifecycle rows and all critical boundaries, not an invented percentage. [VERIFIED: recommendation]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Deno | all gates | ✓ | 2.9.4 | — [VERIFIED: environment] |
| npm | package verification | ✓ | 10.9.8 | Deno npm resolution after explicit pin [VERIFIED: environment] |
| Chromium | browser automation | ✓ | snap executable present; version not probed | Playwright-managed browser only after approved install [VERIFIED: environment] |
| Playwright test runner | browser automation | ✗ not installed | proposed 1.62.1 | Human checkpoint then exact Deno dev import; otherwise record browser automation gap [VERIFIED: repository/npm audit] |
| Fresh production build/start | WebSocket/browser smoke | ✓ | Fresh 2.3.3 | No Vite-dev fallback for upgrades [VERIFIED: existing passing smoke and AGENTS.md] |
| Public Nostr relays | live UAT | Not asserted | external | Deterministic fake relay tests; retain manual live row [VERIFIED: locked UAT boundary] |
| Public/local Blossom service | live UAT | local discovery is environment-dependent; public not asserted | external | Deterministic adapter/cache tests; retain manual live row [VERIFIED: current config/services and locked UAT boundary] |
| Physical iOS/Android devices | QLT-04 observation | ✗ unavailable in unattended environment | — | Chromium automation plus explicit residual-risk manual scripts [VERIFIED: `09-CONTEXT.md`] |

**Missing dependencies with no fallback:** physical-device/live-service observations cannot be truthfully executed locally; they remain accepted residual risks only under the locked unattended rule. [VERIFIED: `09-CONTEXT.md`]

**Missing dependencies with fallback:** Playwright is not installed; after human verification it can use local Chromium. Deterministic service doubles cover correctness but not public-service interoperability. [VERIFIED: environment and package audit]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Explicit trust-boundary/threat matrix and process-owned authority. [CITED: https://devguide.owasp.org/en/06-verification/01-guides/03-asvs/] |
| V2 Authentication | yes | Backend signer/account restore and exact active-account binding; signer material never crosses browser boundary. [VERIFIED: current account tests] |
| V3 Session Management | yes | Opaque reconnect token, bounded grace, rotation/removal, origin validation, and no token logging. [VERIFIED: current connection/route tests; OWASP WebSocket guidance] |
| V4 Access Control | yes | Per-message exact capability, account, verified napplet, window/source, catalog identity, scope, and generation checks. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html] |
| V5 Input Validation | yes | Closed exact-key codecs, size/count limits, canonical URLs/IDs, and deny by default. [CITED: https://devguide.owasp.org/en/06-verification/01-guides/03-asvs/] |
| V6 Cryptography | yes | Use pinned Nostr/signature/hash implementations; never hand-roll. [VERIFIED: project constraints and artifact pipeline] |
| V7 Error/Logging | yes | Stable sanitized error codes, no secrets/paths/private destinations/cross-account content. [CITED: OWASP Authorization and WebSocket cheat sheets] |
| V8 Data Protection | yes | Account/napplet/scope isolation and browser-safe projections only. [VERIFIED: QLT-02]
| V9 Communications | yes | Production origin/upgrade checks and deployment TLS expectation; test WebSocket closure/reconnect. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html] |
| V11 Business Logic | yes | Exact catalog authority, single-use intent tickets, storage quotas, mixed settlement, single media owner. [VERIFIED: Phase 4-8 decisions] |
| V12 Files/Resources | yes | Existing streamed size/MIME/hash/redirect/SSRF checks and upload authorization. [VERIFIED: Phase 5 tests] |
| V13 API/Web Service | yes | Per-message authentication/authorization, strict JSON/binary parsing, bounded correlation/rate/size. [CITED: OWASP WebSocket Security Cheat Sheet] |
| V14 Configuration | yes | Exact security headers, loopback-safe defaults, placeholder-only env template, no secret logging. [VERIFIED: current env tests and QLT-02] |

### Known Threat Patterns for Deno/Fresh + Sandboxed Napplet Runtime

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Foreign window/message injection | Spoofing | Exact registered `event.source`, opaque-origin-aware handling, strict codec and grant checks. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage] |
| Advertised-but-unhandled action | Tampering / DoS | Exhaustive registry and explicit denial; no silent default. [VERIFIED: locked parity decision] |
| Private-network/redirect pivot | Information disclosure / SSRF | Re-resolve every hop, reject forbidden/mixed destinations, exact local-cache class, streamed bounds. [VERIFIED: existing resource tests] |
| Signer confusion | Elevation of privilege | Process-owned active signer; signed writes deny when unavailable; browser receives no private key/token. [VERIFIED: signer/account tests] |
| Storage namespace escape | Information disclosure / Tampering | Derive account+verified identity+scope server-side; canonical keys, quotas, atomic persistence, replacement/restart tests. [VERIFIED: Phase 6 decisions] |
| Catalog TOCTOU | Elevation of privilege | Revalidate accepted catalog event/manifest/artifact triple immediately at launch/invocation. [VERIFIED: Phase 4 implementation] |
| Stale intent/media generation | Spoofing / Tampering | Current-generation comparison before effects, single-use tickets/correlation, revoke-before-grant. [VERIFIED: Phase 7/8 decisions] |
| Reconnect token disclosure/replay | Spoofing | Length/format bounds, origin checks, grace expiry, sanitized logs, old-generation rejection. [VERIFIED: current runtime route/tests; OWASP WebSocket guidance] |
| Over-powered iframe | Elevation of privilege | Preserve exact `sandbox="allow-scripts"`; closed Permissions-Policy; CSP; no same-origin/top-nav/forms/popups unless shell policy owns a separate surface. [CITED: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe] |

### Mandatory Adversarial Matrix

| Boundary | Minimum hostile cases | Required invariant |
|----------|-----------------------|--------------------|
| Capability/codec | unknown domain/action, invented result, extra/missing keys, wrong direction, oversized IDs/payloads | No handler/effect; explicit sanitized denial where protocol permits. [VERIFIED: QLT-01/02] |
| Iframe | sibling/top/old frame source, malformed data, repeated ready, stale registration, navigation attempt | Only exact current WindowProxy can initialize/forward; sandbox remains exact. [VERIFIED: current bridge pattern] |
| Catalog/artifact | stale catalog ID, superseded manifest, changed aggregate, uninstalled/unresolved entry, late enrichment | No bytes/ticket/launch; accepted exact identity remains authority. [VERIFIED: Phase 4 tests] |
| Resource/upload | encoded/ambiguous URL, redirects to private/mixed DNS, MIME/hash/size mismatch, duplicate/foreign binary frame, partial settlement, cancel/timeout | No private fetch/data leak; ordered sanitized outcome; abort exact owner only. [VERIFIED: Phase 5 tests] |
| Signer/common writes | no signer, signer replacement during await, foreign account, malformed event target | No signature/effect; reads may retain allowed partial truth. [VERIFIED: project signer model and Phase 6 plans] |
| Storage | path-like/control/unicode key, quota edge, malformed serialization, shared-vs-instance confusion, account/identity replacement, concurrent writes, corrupt/restart state | No namespace escape/cross-account read; atomic deterministic persistence; bounded denial. [VERIFIED: Phase 6 decisions] |
| Intent | forged handler, stale generation, duplicate/expired ticket, popup blocked/closed, foreign source/account, history back/forward | One terminal sanitized outcome; no unauthorized surface/bytes. [VERIFIED: Phase 7 plans] |
| Media | stale/foreign owner, duplicate correlation, concurrent transfers both orders, detach/reconnect/expiry, delayed report, autoplay rejection, shutdown | At most one owner; revoke-before-grant; stale client stops and cannot reclaim. [VERIFIED: Phase 8 plans] |
| Errors/logs | thrown Error with token/path/private URL/secret bytes/account data | Public response/log assertion contains stable code only; forbidden markers absent. [VERIFIED: QLT-02] |

## Full Verification and Acceptance Architecture

Nyquist validation is disabled in `.planning/config.json`, so no planner test-map section is required; Phase 9 itself nevertheless has explicit quality requirements and must plan the following release gates. [VERIFIED: config and QLT-03]

### Deterministic automated gates

1. `deno fmt --check`, `deno lint`, and `deno check` via `deno task check`. [VERIFIED: `deno.json`]
2. Contract/action parity generation and exact fixture/dispatcher tests. [VERIFIED: QLT-01]
3. All closed adversarial tables and lifecycle matrices with injected clocks/transports/stores. [VERIFIED: `09-CONTEXT.md`]
4. `deno test -A --coverage=.coverage` followed by `deno coverage .coverage`; inspect uncovered security/dispatch branches, with no invented percentage gate. [CITED: https://docs.deno.com/runtime/test/]
5. Full `deno task test`; baseline on 2026-07-31 is 168 passed, 0 failed in 28 seconds. [VERIFIED: local execution]
6. `deno task build`, then isolated `deno task start` on validated loopback `PORTAL_PORT`, readiness polling, smoke, and cleanup in `finally`. [VERIFIED: AGENTS.md and existing smoke]
7. Deterministic two-or-more-client production WebSocket scenario covering snapshot/order, partial/stream updates, reconnect token/grace, replacement, stale frames, mixed settlement, intent surface correlation, media revoke-before-grant, detach/expiry, and shutdown. [VERIFIED: Phase 7/8 plans and locked decision]
8. Chromium browser wave after package checkpoint: phone portrait/landscape viewports, light/dark/system, reduced motion, keyboard focus, accessible status/dialogs, history, stacked iframe, popup/new-tab, reconnect, two-tab media, and no console/CSP violations. [VERIFIED: locked acceptance; official Playwright docs]

### Required UAT matrix

| Flow | Automated must-have | Physical/live observation | Unattended disposition |
|------|---------------------|---------------------------|------------------------|
| Theme/branding/safe areas | Chromium portrait/landscape, light/dark/system, reduced motion, focus/contrast/overflow | iOS Safari + Android Chrome browser chrome, notch/home indicator, text scaling | `NOT RUN — accepted residual risk` only after automation passes. [VERIFIED: Phase 3 deferral and CONTEXT] |
| Reconnect recovery | Built server + browser offline/online/visibility + token/grace assertions | Background/suspend/resume on both device families | Same; never label emulator result physical. [VERIFIED: Phase 3 deferral] |
| Catalog/install/launch | Deterministic relay/Blossom doubles + browser partial/stale/dialog/focus flow | Public relay + Blossom interoperability on mobile network | Same; script records endpoints and accepted manifest ID without secrets. [VERIFIED: Phase 4 deferral] |
| RESOURCE/UPLOAD | Hostile fake network + local cache + mixed upload settlement | Public Blossom upload/read and optional local cache | Same; use non-sensitive disposable blob/hash. [VERIFIED: Phase 5 scope and CONTEXT] |
| COMMON/STORAGE | Partial stream/replacement/restart/isolation browser+backend tests | Live other-user profile evolution and restart on target deployment | Same; never use personal production account data. [VERIFIED: Phase 6 requirements] |
| Intent navigation | Browser focus/reuse, popup, stack, Back/Forward, blocked/closed popup | Touch behavior and popup policy on iOS/Android | Same; record mode and observed terminal result. [VERIFIED: Phase 7 plans] |
| Media ownership | Two-page Chromium create/play/transfer/stop/stale-owner/autoplay rejection | Two real tabs, backgrounding, autoplay, audio stop on iOS/Android | Same; record exact ordering and whether prior tab audibly stopped. [VERIFIED: Phase 8 plans] |

### Concise manual scripts

**Device shell/reconnect:** Build/start on a TLS-capable reachable test host; record device/browser/OS/version. Open Home, switch System/light/dark, enable OS reduced motion and text scaling, launch a verified napplet, background for longer and shorter than grace, toggle network, resume, and confirm one truthful connection sequence, no duplicated socket-visible behavior, usable safe areas, focus, and Back navigation. Record observations/screenshots; never record reconnect tokens. [VERIFIED: QLT-04 flows and security boundary]

**Live catalog/resource/Blossom:** Use a disposable test account and known signed test manifest/blob. Install by `naddr`, record accepted manifest event ID, observe partial sync, launch exact artifact, read a hash-addressed blob, upload a non-sensitive small blob to configured required servers, and record per-server outcomes/hash. Do not expose server auth headers, local paths, or account secrets. [VERIFIED: Phase 4/5 requirements]

**Intent/media across real tabs:** From a verified caller, invoke each allowed navigation mode; test browser Back, blocked popup, and closed target. Open two tabs under one disposable account, create/play, transfer A→B, verify A stops before B owns playback, background/close/reconnect, then stop from the non-owner shell. Record device/browser and ordered outcomes, not tokens or private payloads. [VERIFIED: Phase 7/8 success criteria]

## Sources

### Primary (HIGH confidence)

- Project `AGENTS.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/config.json`, Phase 3-8 context/research/plans/verifications, current runtime/UI/tests, and git history — scope, constraints, debt, architecture, and baseline. [VERIFIED: codebase]
- Installed `@napplet/core@0.31.0` and `@napplet/nap@0.31.0` declarations — exact in-scope domain/message discriminants. [VERIFIED: pinned package declarations]
- [Deno testing documentation](https://docs.deno.com/runtime/test/) — test doubles, fake time, and coverage workflow. [CITED: https://docs.deno.com/runtime/test/]
- [Playwright Pages documentation](https://playwright.dev/docs/pages) and [Page API](https://playwright.dev/docs/api/class-page) — multiple pages, viewport, and reduced-motion emulation. [CITED: official Playwright docs]
- [MDN iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe), [postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage), [CSP](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/CSP), [CSP sandbox](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/sandbox), and [Permissions Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Permissions_Policy) — browser security boundary behavior. [CITED: MDN]
- [OWASP WebSocket Security](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html), [Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), and [ASVS guide](https://devguide.owasp.org/en/06-verification/01-guides/03-asvs/) — per-message authorization, validation, sanitized failures, and ASVS categories. [CITED: OWASP]

### Secondary (MEDIUM confidence)

- npm registry and package-legitimacy seam for `@playwright/test@1.62.1`; official project identity is confirmed, but the seam returns SUS because the current release is too new. [VERIFIED: npm registry; package gate]

### Tertiary (LOW confidence)

- A1 only, recorded in the Assumptions Log. [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH for existing Deno/Fresh/pinned contracts; MEDIUM for proposed Playwright pending legitimacy checkpoint. [VERIFIED: environment, official docs, package gate]
- Contract architecture: HIGH — exact pinned declarations, locked decisions, and current code paths were inspected. [VERIFIED: codebase]
- Security/adversarial plan: HIGH — grounded in current boundaries, prior phase threat models, MDN, and OWASP. [VERIFIED: cited sources]
- Browser automation: MEDIUM — official APIs and local Chromium are available, but the runner is not installed and physical devices remain unavailable. [VERIFIED: environment]
- Pitfalls: HIGH except A1, which is explicitly assumed. [VERIFIED: source mapping]

**Research date:** 2026-07-31
**Valid until:** 2026-08-07 (fast-moving pinned contracts/browser tooling and concurrent Phase 6-8 execution)
