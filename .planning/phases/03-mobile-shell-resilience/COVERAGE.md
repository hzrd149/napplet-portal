# Phase 3 External API Coverage — Kehto/NAP Shell Boundary

> Phase 3 adds no NAP domain. It changes one existing pinned identity transition and explicitly keeps theme outside the napplet boundary, so those external contract decisions remain auditable.

| capability | decision | Phase 3 behavior |
|---|---|---|
| Pinned `@kehto/shell@0.19.1` identity change publisher/shape | INTEGRATE | Sign-out forwards exactly one canonical `identity.changed` transition with empty `pubkey` to the eligible verified frame. |
| Pinned Kehto/NAP capability denial after sign-out | INTEGRATE | Backend authority is revoked and later protected operations receive the existing contract-defined denial without shell-authored replacement errors. |
| Existing public/read-only capability behavior after sign-out | INTEGRATE | Permitted public activity continues while signing and account-scoped capabilities fail. |
| Existing reconnect token/grace contract | INTEGRATE | Client recovery resubmits only the opaque token; `ConnectionRegistry` remains the owner of namespace resumption and expiry. |
| NAP-THEME or other theme message | OPT-OUT | Explicitly deferred by D-37; Phase 3 theme preference is browser-local shell state and never crosses the iframe boundary. |
| New NAP domains or catalog behavior | OPT-OUT | Outside the Phase 3 boundary; later roadmap phases own those capabilities. |
| Sibling `../kehto` and `../napplet` production imports | OPT-OUT | Reference-only sources; pinned npm packages remain executable authority. |

## Required evidence

- `tests/identity_service_test.ts` and `tests/end_to_end_test.ts` assert the exact pinned sign-out envelope, one eligible-frame delivery, foreign/stale rejection, protected denial, and permitted public continuity.
- `tests/connection_controller_test.ts`, `tests/websocket_session_test.ts`, and the built-server `tests/runtime_reconnect_smoke_test.ts` assert opaque-token preservation, same-namespace resumption, and single-socket behavior through the existing grace boundary without browser-generated authority.
- `tests/theme_test.ts` asserts that theme preference produces no runtime or napplet-facing message.
