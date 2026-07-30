---
phase: 01
slug: one-day-napplet-runtime-mvp
status: verified
threats_open: 0
asvs_level: 1
block_on: high
created: 2026-07-30
---

# Phase 01 - Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Environment to runtime | Operator configuration enters authority-bearing server code. | Bind addresses, relay URLs, Blossom URLs, napplet coordinate |
| Network artifact to iframe | Untrusted NIP-5D and Blossom data becomes executable only after verification. | Signed manifest and HTML/blob bytes |
| Browser to runtime | Untrusted iframe and WebSocket messages request backend operations. | NAP envelopes, ownership IDs, filters, events, templates |
| Signer store to browser | Persistent signer authority is reduced to public identity state. | Account snapshots and public identity projections |
| Runtime to logs and SSR | Diagnostics and rendered state must exclude sensitive authority. | Configuration summaries, identity state, errors |

## Threat Register

The planning register reused `T-01-04` for two controls. They are normalized below as `T-01-04A` and `T-01-04B`. Repeated `T-01-SC` entries are represented once.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Spoofing | transport codec | high | mitigate | Server-issued connection/window IDs and ownership checks; `runtime_contract_test.ts` | closed |
| T-01-02 | Information disclosure | config/logging | high | mitigate | Loopback default and allowlisted startup summary; `end_to_end_test.ts` | closed |
| T-01-03 | Tampering | endpoint parsing | medium | mitigate | Scheme validation, normalization, dedupe, sanitized warnings; `config_test.ts` | closed |
| T-01-04A | Tampering | supplied artifact/fixture | high | mitigate | Signature, aggregate, blob, and fixture identity checks before launch; `artifact_resolver_test.ts` | closed |
| T-01-04B | Information disclosure | account snapshot | high | mitigate | Server-only signer state and secret-free browser projection; `account_store_test.ts` | closed |
| T-01-05 | Elevation of privilege | sign operations | high | mitigate | Active backend account is sole signer; unavailable/sign-out rejects signing; `accounts_test.ts` | closed |
| T-01-06 | Tampering | snapshot write | medium | mitigate | Serialized writes and atomic temporary-file rename; `account_store_test.ts` | closed |
| T-01-07 | Tampering | artifact resolver | high | mitigate | Manifest signature, aggregate, and every blob verified before srcdoc; `artifact_resolver_test.ts` | closed |
| T-01-08 | Spoofing | connection registry | high | mitigate | Server-issued namespaces and connection/window ownership checks; `websocket_session_test.ts` | closed |
| T-01-09 | Information disclosure | server exposure | high | mitigate | `127.0.0.1` default with explicit validated override; `env_test.ts` | closed |
| T-01-10 | Denial of service | session lifecycle | medium | mitigate | Bounded messages, correlation timeout, and idempotent grace cleanup; `websocket_session_test.ts` | closed |
| T-01-11 | Spoofing | iframe bridge | high | mitigate | Exact `MessageEvent.source` binding to persistent `contentWindow`; `iframe_bridge_test.ts` | closed |
| T-01-12 | Elevation of privilege | injected domains | high | mitigate | Only supported SHELL/IDENTITY/RELAY/OUTBOX domains injected after verification; `artifact_resolver_test.ts` | closed |
| T-01-13 | Information disclosure | SSR/island props | high | mitigate | Public projections only and forbidden-authority import tests; `shell_architecture_test.ts` | closed |
| T-01-14 | Tampering | iframe sandbox | high | mitigate | Literal `sandbox="allow-scripts"` with opaque origin; `shell_architecture_test.ts` | closed |
| T-01-15 | Elevation of privilege | publish services | high | mitigate | Signed/template validation and backend-only OUTBOX/encrypted signing; `relay_stream_test.ts` | closed |
| T-01-16 | Repudiation | publish settlement | high | mitigate | Required relay acknowledgements and canonical per-relay outcomes; `identity_service_test.ts` | closed |
| T-01-17 | Information disclosure | relay logging | high | mitigate | Logs use allowlisted short IDs and omit content, signatures, and secrets; runtime debug calls | closed |
| T-01-18 | Denial of service | subscriptions | medium | mitigate | Ownership registry, immediate close, finalization, and grace expiry; `relay_stream_test.ts` | closed |
| T-01-19 | Spoofing | Fresh exposure | high | mitigate | Loopback default, explicit broad bind, documented trusted-operator boundary; `README.md` and `end_to_end_test.ts` | closed |
| T-01-20 | Information disclosure | startup/docs | high | mitigate | Sanitized startup summary and placeholder-only examples; `docs_test.ts` | closed |
| T-01-21 | Tampering | end-to-end artifact | high | mitigate | Supplied artifact must pass NIP-5D verification before execution; `tracer_end_to_end_test.ts` | closed |
| T-01-SC | Tampering | npm installs | high | mitigate | Pinned package legitimacy approved in Phase 01 UAT Test 1 | closed |

## Accepted Risks Log

No accepted risks.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-30 | 23 | 23 | 0 | Codex (`gsd-secure-phase`, ASVS L1) |

## Verification Evidence

- `deno task check`: passed (format, lint, type checking)
- `deno task test`: 55 passed, 0 failed
- Phase 01 UAT: 4 passed, 0 issues

## Sign-Off

- [x] All threats have a disposition
- [x] Accepted risks documented
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-30
