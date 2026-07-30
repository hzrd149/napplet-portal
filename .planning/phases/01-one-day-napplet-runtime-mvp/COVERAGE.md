# Kehto / NAP Capability Coverage

Phase 1 injects only mandatory shell plus supported/granted domains. Sibling packages are canonical read-only references.

| Capability | Decision | Phase 1 behavior |
|---|---|---|
| SHELL | INTEGRATE | Source-bound `shell.ready`; exactly one `shell.init`; verified napplet identity and only supported domains injected. |
| IDENTITY | INTEGRATE | Read current public active-account state and receive active/offline/unavailable changes; signer authority stays backend-only. |
| RELAY | INTEGRATE | Napplet supplies the relay URL. Query/subscribe delivers exact observed provenance, emits exactly one `relay.eose` after initial relay state, then keeps the live tail open. Close emits canonical `relay.closed`. Publish forwards an already-signed event unchanged; encrypted publish encrypts/signs on the backend. |
| OUTBOX | INTEGRATE | Runtime combines preset relays with user NIP-65 routing. Query/subscribe has **no caller-visible EOSE envelope** and remains live until close. Publish accepts an unsigned template, signs with the global account, fans out canonically, and settles required per-relay outcomes before success. |
| STORAGE | OPT-OUT | Deferred by locked Phase 1 scope: no per-napplet durable storage or quotas. |
| RESOURCE | OPT-OUT | Deferred by locked Phase 1 scope: no mediated resource proxy. |
| INTENT | OPT-OUT | Deferred by locked Phase 1 scope: no intent routing. |
| THEME | OPT-OUT | Deferred by locked Phase 1 scope: no theme service. |
| NOTIFY | OPT-OUT | Deferred by locked Phase 1 scope: no notification service. |
| UPLOAD | OPT-OUT | Deferred by locked Phase 1 scope: no upload surface. |
| LINK | OPT-OUT | Deferred by locked Phase 1 scope: no link service. |
| INC | OPT-OUT | Deferred by locked Phase 1 scope: no incremental-data domain beyond relay/outbox streams. |
| CONFIG | OPT-OUT | Deferred by locked Phase 1 scope: server environment configuration is not exposed as a NAP domain. |
| MEDIA | OPT-OUT | Deferred by locked Phase 1 scope: no media service. |
| KEYS | OPT-OUT | Deferred by locked Phase 1 scope and backend key-custody boundary. |
| VALUE | OPT-OUT | Deferred by locked Phase 1 scope: no value-transfer API. |
| POW | OPT-OUT | Deferred by locked Phase 1 scope: no proof-of-work service. |

Unknown domain/message types are silently ignored. Recognized unsupported operations return canonical typed errors; no opt-out domain is injected.
