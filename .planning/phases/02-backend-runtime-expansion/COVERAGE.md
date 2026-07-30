# API Coverage — Applesauce and Napplet/Kehto SDKs

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

| capability | decision | reason |
|---|---|---|
| Applesauce EventStore dedupe, provenance, replacement, addressable, and deletion semantics | INTEGRATE | |
| Applesauce RelayPool connection, subscription, request timeout, publish, and teardown | INTEGRATE | |
| Applesauce event/address loaders and observable model derivation | INTEGRATE | |
| Applesauce accounts and signer authority | INTEGRATE | |
| NIP-65 indexer/lookup routing inputs | INTEGRATE | |
| NIP-42 connection-scoped relay AUTH | INTEGRATE | |
| Pinned `@kehto/runtime` dispatch and lifecycle contracts | INTEGRATE | |
| Pinned `@napplet/core` and `@napplet/nap` wire contracts | INTEGRATE | |
| Sibling `../kehto` and `../napplet` executable imports | OPT-OUT | Reference-only drift inputs; production behavior is pinned to npm packages per D-22. |
| Broader NAP domains beyond the Phase 1 SHELL, IDENTITY, RELAY, and OUTBOX seam | OPT-OUT | Explicitly scoped to Phase 3. |

