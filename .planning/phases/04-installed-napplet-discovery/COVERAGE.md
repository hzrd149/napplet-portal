# Phase 4 External API Coverage — Installed Catalog Boundary

> Phase 4 adds no NAP domain. It composes the portal's pinned artifact-integrity and sandbox boundaries with portal-internal installed-catalog commands; CAT-01 through CAT-04 do not expand the napplet-facing API surface.

| capability | decision | Phase 4 behavior |
|---|---|---|
| Pinned `@kehto/nip` NIP-5D artifact resolution | INTEGRATE | Install preview and accepted-manifest launch cross the existing signature, aggregate, blob-hash, index, and capability boundary before review facts or executable bytes are released. |
| Pinned `@kehto/runtime` / `@napplet/core@0.31.0` / `@napplet/nap@0.31.0` sandbox initialization | INTEGRATE | A successful backend-revalidated installed launch supplies the existing verified identity and bytes to the one mounted sandboxed iframe; NAP access remains on the explicit proxy/message boundary. |
| Portal `catalog.preview`, approval, synchronization, search, and launch messages | INTERNAL | These are same-origin portal runtime controls, not napplet-facing NAP messages. Search stays browser-local over the pushed catalog projection (CAT-04). |
| Executable `srcdoc` in ordinary catalog projections | OPT-OUT | Cards receive membership and public verified metadata only; executable bytes are returned solely by an exact accepted-manifest backend launch result (CAT-03). |
| New NAP domains, intent discovery, napplet storage, marketplace search, or update automation | OPT-OUT | Explicitly outside the Phase 4 boundary and assigned to later roadmap work. |
| Sibling `../kehto` and `../napplet` production imports | OPT-OUT | Sibling sources remain reference-only; pinned npm packages are the sole executable contract authority. |

## Required evidence

- `tests/catalog_test.ts` proves strict naddr normalization, immutable review facts, serialized all-relay approval, partial catalog truth, and exact accepted-manifest launch.
- `tests/artifact_resolver_test.ts` proves every install/launch artifact crosses the pinned integrity boundary.
- `tests/catalog_ui_test.tsx` proves CAT-04 remains local and query-preserving, partial entries stay visible, and review/launch actions do not create browser authority.
- `tests/end_to_end_test.ts` proves correlated portal-internal commands assign verified bytes only after backend success while preserving the single sandboxed iframe lifecycle.
