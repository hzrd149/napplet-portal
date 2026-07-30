# Kehto / NAP Capability Coverage

Timeline: D-47 keeps this exact coverage in Phase 1 without a one-day completion deadline. The first delivery checkpoint, targeted for one day, proves sign-in → supplied verified napplet → Kehto handshake → initial-plus-updating backend RELAY stream; no integrated capability below moves to a later phase.

Phase 1 injects only mandatory shell plus supported/granted domains. Sibling packages are canonical read-only references.

| Capability | Decision | Phase 1 behavior |
|---|---|---|
| SHELL | INTEGRATE | Source-bound `shell.ready`; exactly one `shell.init`; verified napplet identity and only supported domains injected. |
| IDENTITY | INTEGRATE | Read current public active-account state and receive active/offline/unavailable changes; signer authority stays backend-only. |
| RELAY | INTEGRATE | Caller selects relay. Streams preserve provenance, emit one `relay.eose`, stay live, and close with `relay.closed`. Publish preserves signed events; backend encrypts/signs encrypted events. |
| OUTBOX | INTEGRATE | Preset and NIP-65 relays form live streams without caller-visible EOSE. Backend signs templates and requires every routed relay to accept before publish succeeds. |
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
