# Phase 4: Installed Napplet Discovery - Context

**Gathered:** 2026-07-31 **Status:** Ready for planning

<domain>
## Phase Boundary

Complete the user-facing installed-napplet catalog on the portal home page:
accept an `naddr`, resolve and review its verified manifest, approve installation,
synchronize the active account's catalog without hiding useful partial state,
search the current projection while synchronization continues, and launch only
through the accepted manifest event identity. This phase uses the Phase 2 NIP-78
catalog and artifact-integrity seams; it does not add general marketplace
discovery, recommendations, new NAP domains, artifact update automation, or a
second catalog authority.

</domain>

<decisions>
## Implementation Decisions

### Installation and approval

- **D-01:** Installation begins from one prominent home-catalog action that
  accepts a NIP-19 `naddr`. Decode and normalize it into the existing NIP-5A
  coordinate form on the backend; malformed values fail inline without changing
  catalog state.
- **D-02:** Resolving an `naddr` produces a review step before any signed catalog
  mutation. The review shows publisher, coordinate, resolved manifest event ID,
  display name, version, aggregate hash, and declared capabilities using the same
  trust language and comparison fields as manifest-update review.
- **D-03:** Approving the reviewed manifest uses the existing serialized catalog
  replacement mutation. Installation succeeds only after the manifest passes the
  established signature, aggregate, blob, and capability boundary and every
  required catalog publish relay accepts the signed replacement event.
- **D-04:** A resolution or publish failure leaves the review/input recoverable
  for retry and never creates an optimistic installed entry. A catalog update
  arriving while review is open invalidates that review and requires the user to
  review current state again.

### Synchronization and partial catalog state

- **D-05:** The active account's latest valid signed NIP-78 catalog remains the
  sole authoritative installed set. Synchronization streams replacements into
  the existing Applesauce event store and pushes updated projections over the
  existing runtime WebSocket; the browser does not persist or merge a second
  catalog.
- **D-06:** Preserve the last usable projection while refresh continues or
  fails. Distinguish empty, initial loading, populated/partial, stale, and error
  states in place; synchronization never blocks the home page or replaces known
  cards with a global spinner.
- **D-07:** Every structurally valid accepted catalog entry remains visible even
  when its manifest metadata or artifact is still resolving or has failed.
  Render a coordinate-derived placeholder and an entry-level unavailable state,
  then enrich that card in place when verification succeeds. Never silently
  drop an accepted entry merely because its artifact is temporarily unresolved.

### Search behavior

- **D-08:** Search is a local, case-insensitive filter over the current verified
  or partial projection. Match display title, coordinate identifier, version,
  and declared capabilities; do not wait for relay EOSE and do not perform a
  network search.
- **D-09:** Keep the query active as catalog cards stream in or change, and
  recompute results without resetting the input. Distinguish “no napplets
  installed” from “no installed napplets match this search,” and keep stale/error
  synchronization context visible alongside filtered results.
- **D-10:** Partial cards participate using the metadata currently known. Raw
  event IDs and aggregate hashes remain review/trust details rather than primary
  search fields.

### Launch authority and stale actions

- **D-11:** Opening a card sends the coordinate, accepted manifest event ID, and
  catalog event ID to the backend. The backend revalidates them against the
  latest authoritative catalog projection and returns executable bytes only
  after the accepted manifest passes the existing integrity boundary.
- **D-12:** Reject launch when the entry is unresolved, removed, replaced by a
  newer catalog event, or no longer names the same accepted manifest. Refresh the
  catalog and leave the user on Home with a concise retryable explanation; do not
  launch from browser-cached `srcdoc` as authority.
- **D-13:** A newer unapproved manifest does not supersede the accepted version.
  Continue to offer the last accepted verified manifest until the explicit
  update-review flow approves a replacement. Once a launch is accepted, retain
  the existing single mounted iframe and Home/Back lifecycle.

### the agent's Discretion

- Exact install control placement, responsive layout, input labeling, search
  iconography, card ordering, and debounce strategy, provided mobile touch and
  accessibility behavior remain consistent with the established shell.
- Exact names of new correlated runtime messages and internal projection types,
  provided backend validation, correlation, size limits, and stale-result
  rejection follow the existing WebSocket boundary.
- Exact entry-level loading/error copy and whether verified capabilities are
  displayed directly on cards or only used for search and review.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `runtime/catalog.ts` already defines the signed replaceable NIP-78 catalog,
  strict decoding, serialized approve/uninstall mutations, required-relay publish
  semantics, and verified projection types.
- `runtime/artifacts.ts` already owns manifest signature, artifact aggregate/blob
  verification, capability checks, and executable `srcdoc` production.
- `components/HomeView.tsx` already supplies responsive catalog cards, empty and
  synchronization notices, native review/uninstall dialogs, focus restoration,
  stale-dialog invalidation, and partial-card presentation.
- `islands/NappletShell.tsx` already keeps one iframe mounted, consumes pushed
  catalog projections, preserves Home/Back navigation, and correlates catalog
  commands over the tab's runtime connection.

### Established Patterns

- Backend state is authoritative and browser islands own only transport and UI
  behavior (`main.ts`, `runtime/portal_runtime.ts`, `islands/NappletShell.tsx`).
- Nostr state is projected incrementally through Applesauce/EventStore streams;
  partial availability is normal and should not become wait-for-completeness
  control flow (`runtime/event_runtime.ts`, `main.ts`, `runtime/catalog.ts`).
- Executable napplet content fails closed before iframe assignment, while
  catalog cards can remain visible without launch material
  (`runtime/artifacts.ts`, `components/NappletFrame.tsx`).
- Native dialogs restore focus and close when their source catalog event changes;
  correlated commands return explicit success without granting browser authority
  (`components/HomeView.tsx`, `routes/api/runtime.ts`).
- Shell surfaces consume the shared ink/bone/electric-amber theme and preserve
  non-color state meaning (`assets/styles.css`,
  `.planning/phases/03-mobile-shell-resilience/03-CONTEXT.md`).

### Integration Points

- Extend `runtime/catalog.ts` for install resolution/projection retention and a
  backend-validated launch operation without changing its NIP-78 representation.
- Extend `runtime/transport.ts`, `runtime/portal_runtime.ts`, and
  `routes/api/runtime.ts` with correlated install-preview, install-approval, and
  launch commands/results under the existing same-origin WebSocket session.
- Extend `components/HomeView.tsx` with the install review and live search UI;
  keep `islands/NappletShell.tsx` responsible for query-local interactivity and
  transport, not manifest verification or catalog persistence.
- Reuse `tests/catalog_test.ts`, `tests/catalog_ui_test.tsx`,
  `tests/artifact_resolver_test.ts`, and `tests/end_to_end_test.ts` as the main
  contract, state-matrix, integrity, and runtime-boundary test seams.

</code_context>

<specifics>
## Specific Ideas

- The home view should feel like an installed-app launcher, not a relay query
  console or public marketplace.
- Installation and manifest-update approval should read as one coherent trust
  ceremony: public identity and executable-integrity facts are reviewable before
  the signed catalog changes.
- Search must remain immediately useful on mobile even when synchronization is
  incomplete, stale, or recovering.
- Unresolved accepted entries are catalog facts, not disposable errors: retain
  their place, explain why launch is unavailable, and enrich them when data
  arrives.

</specifics>

<deferred>
## Deferred Ideas

- Public marketplace browsing, relay-wide napplet discovery, recommendations,
  categories, ratings, and remote search.
- Automatic acceptance of newer manifests or background capability approval.
- Catalog conflict merging beyond normal latest-valid Nostr replacement
  semantics.
- New NAP domains, intent-handler discovery, persistent napplet storage, and
  cross-tab media behavior assigned to later roadmap phases.

</deferred>
