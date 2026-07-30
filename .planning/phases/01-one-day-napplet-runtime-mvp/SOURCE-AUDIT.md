# Phase 01 Multi-Source Coverage Audit

All required source items are covered; deferred/out-of-scope items are excluded by rule.

| SOURCE | ID | Feature / requirement | Plan | Status | Notes |
|---|---|---|---|---|---|
| GOAL | — | Trusted operator signs in and runs one verified napplet backed by server-owned streams | 01–06 | COVERED | Compatibility through final supplied-napplet acceptance |
| REQ | MVP-01..MVP-05 | Shell, verified iframe, compatible adapter, backend boundary, correlated results | 01,03,04,06 | COVERED | Exact requirements fields enumerate each ID |
| REQ | AUTH-01..AUTH-06 | Three sign-in modes, isolation, active account, documented read-only deferral | 02,04,06 | COVERED | Complete signer persistence is delivered |
| REQ | STREAM-01..STREAM-07 | Stream-first Applesauce/RxJS, partial states, local endpoint seams | 01,03,04,05,06 | COVERED | RELAY EOSE remains nonterminal |
| REQ | NAP-01..NAP-04 | Handshake, identity, proxied stream, typed errors | 01,02,03,04,05,06 | COVERED | Exact package contracts precede implementation |
| REQ | QUAL-01..QUAL-04 | Authority placement, checks, and documentation | 01,02,03,04,05,06 | COVERED | Structural and docs tests included |
| CONTEXT | D-01..D-08 | Sign-in/account lifecycle | 02,04 | COVERED | Each decision cited in truths/actions |
| CONTEXT | D-09..D-15 | Shell/navigation/error behavior | 04,06 | COVERED | UI-SPEC states and backstops included |
| CONTEXT | D-16..D-23 | Verified loading and Kehto boundary | 01,03,04,06 | COVERED | No example napplet |
| CONTEXT | D-24..D-30 | Relay/event semantics | 05 | COVERED | Exact provenance and RELAY-vs-OUTBOX EOSE distinction |
| CONTEXT | D-31..D-35 | Transport/shared runtime | 01,03,04,05,06 | COVERED | Assumption delta recorded as no-change |
| CONTEXT | D-36..D-40 | Signing/publishing | 05 | COVERED | Signed RELAY vs unsigned OUTBOX explicit |
| CONTEXT | D-41..D-46 | Configuration/cache/startup | 01,03,06 | COVERED | Loopback and sanitized summary included |
| RESEARCH | — | Coherent pinned package line and legitimacy gate | 01 | COVERED | Blocking human checkpoint |
| RESEARCH | — | Sensitive snapshot, verified artifact, singleton runtime, ownership registry | 02,03,05 | COVERED | No ORM/schema task |
| RESEARCH | — | Contract-first tests and supplied srcdoc compatibility seam | 01,03,06 | COVERED | Supplied artifact is a final precondition |
| RESEARCH | — | ASVS L1 primary-boundary mitigations | 01–06 | COVERED | Every plan includes STRIDE and block-on-high mitigations |
| CONTEXT | Deferred | Catalog, durable caches, multi-user auth, approvals, broad NAP, example napplet, production hardening | NONE | EXCLUDED | Explicitly deferred by user |
