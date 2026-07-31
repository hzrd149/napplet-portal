# Phase 9: Runtime Expansion Hardening - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Close v1.1 contract, security, automated coverage, traceability, and integrated mobile-flow gaps across Phases 3-8. This phase hardens existing behavior and supplies evidence; it does not add unrelated product domains.

</domain>

<decisions>
## Implementation Decisions

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

### the agent's Discretion
Choose testing tools and remediation order, prioritizing security/contract correctness first, deterministic integration evidence second, and cosmetic polish last.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Prior phase VERIFICATION, SUMMARY, test helpers, production smoke harnesses, and runtime diagnostics provide an evidence base.
- Pinned contract packages and sibling reference sources can be mechanically compared without using sibling production imports.
- Existing UI tests and shell semantic tokens support viewport/accessibility assertions.

### Established Patterns
- `deno task check` and `deno task test` are mandatory gates; production WebSocket checks use build/start because Fresh 2.3 Vite dev cannot upgrade.
- Verification is goal-backward and must distinguish automated proof from human/live-service validation.
- Security authority remains process-owned and exact-identity/generation bound.

### Integration Points
- Audit every dispatcher/service/UI boundary introduced in Phases 3-8.
- Repair REQUIREMENTS.md, ROADMAP.md, coverage artifacts, and missing tests alongside discovered implementation gaps.
- Produce final VERIFICATION and milestone audit evidence suitable for archival.

</code_context>

<specifics>
## Specific Ideas

Create a single machine-readable or markdown contract matrix that links domain/action to codec, implementation, tests, and requirement IDs, making audit gaps obvious.

</specifics>

<deferred>
## Deferred Ideas

Physical-device and public-service observations that cannot run in this environment remain explicit post-milestone release checks; they are never represented as automated passes.

</deferred>
