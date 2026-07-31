# Phase 4: Installed Napplet Discovery - Research

**Researched:** 2026-07-31
**Domain:** Nostr NIP-19/NIP-78 catalog synchronization, verified napplet installation and launch, streaming partial projections, and mobile catalog search
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)

- Public marketplace browsing, relay-wide napplet discovery, recommendations,
  categories, ratings, and remote search.
- Automatic acceptance of newer manifests or background capability approval.
- Catalog conflict merging beyond normal latest-valid Nostr replacement
  semantics.
- New NAP domains, intent-handler discovery, persistent napplet storage, and
  cross-tab media behavior assigned to later roadmap phases.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAT-01 | User can install a napplet by submitting a valid `naddr` and approving the resolved verified manifest. | Backend NIP-19 normalization, immutable preview, stale-preview invalidation, existing artifact verification, and serialized replacement publication. [VERIFIED: codebase and pinned nostr-tools source] |
| CAT-02 | User can see installed napplets on the home page with partial, stale, empty, loading, and error states preserved during synchronization. | Raw accepted-entry projection separated from asynchronous enrichment, last-good retention, per-entry resolution state, and incremental WebSocket pushes. [VERIFIED: codebase gap analysis] |
| CAT-03 | User can launch an installed napplet only from its accepted manifest event identity. | Correlated backend launch command revalidates catalog event ID, coordinate, and accepted manifest ID before resolving exact executable bytes. [VERIFIED: CONTEXT.md; CITED: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/] |
| CAT-04 | User can search installed napplets on the home page by meaningful manifest metadata without waiting for relay synchronization to finish. | Pure local normalized filter over each current projection, with preserved query and accessible result-status messaging. [VERIFIED: CONTEXT.md; CITED: https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html] |
</phase_requirements>

## Summary

Phase 4 should complete and harden the catalog seam already introduced before Phase 3. `CatalogService` already validates the signed active-account NIP-78 replacement, serializes approve/uninstall operations, refuses local advancement unless all required publishes accept, and projects verified artifact metadata. `HomeView` already presents partial cards, synchronization notices, native review/uninstall dialogs, focus restoration, and stale-dialog invalidation. [VERIFIED: codebase] The principal correctness gap is that `CatalogService.project()` currently awaits every artifact sequentially and silently drops any entry whose artifact fails; the route then replaces failures with an empty catalog. This contradicts the locked requirement to preserve accepted entries and last usable state. [VERIFIED: `runtime/catalog.ts`, `routes/api/runtime.ts`, CONTEXT.md]

Installation and launch need two distinct correlated commands. Preview decodes only an `naddr` on the backend, requires named-manifest kind `35129`, normalizes `${kind}:${pubkey}:${identifier}`, resolves the exact signed manifest, crosses the existing aggregate/blob/capability boundary, and returns review facts plus the catalog event ID against which the preview was made. [VERIFIED: pinned `nostr-tools@2.24.1`, sibling reference-only `../napplet/apps/conformance/src/target.ts`, existing artifact resolver] Approval must re-check that catalog ID before using the existing serialized mutation. Launch must never consume `entry.launch.srcdoc` from browser projection; it sends `(catalogEventId, coordinate, acceptedManifestEventId)` and the backend atomically compares those selectors with current active-account catalog truth before resolving the exact accepted artifact. [VERIFIED: CONTEXT.md; CITED: https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html]

No new external dependency is needed. Use the pinned `nostr-tools`, Applesauce, RxJS, Kehto, Napplet, Fresh, Preact, and browser platform already in `deno.json`. [VERIFIED: `deno.json`] Search is a pure browser projection concern because it changes no authority: keep one query state in `NappletShell` or `HomeView`, normalize once with `trim().toLocaleLowerCase()`, filter current entries on every render/update, and announce concise result changes without stealing focus. [VERIFIED: CONTEXT.md; CITED: https://www.w3.org/WAI/WCAG22/working-examples/aria-role-status-searchresults/]

**Primary recommendation:** Split catalog truth from artifact enrichment, implement immutable stale-checked install preview/approval and backend-only launch commands, then layer a query-preserving local filter over the streamed partial projection.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `naddr` decode and coordinate normalization | API / Backend | Browser / Client | Input is untrusted and becomes an authority selector; browser only submits the bounded string and renders inline errors. [VERIFIED: AGENTS.md; CONTEXT.md] |
| Manifest resolution and install review facts | API / Backend | Browser / Client | Signature, aggregate, blob, and capability checks already belong to `PortalArtifactResolver`; UI presents returned facts. [VERIFIED: codebase] |
| Signed catalog replacement | API / Backend | Database / Storage | `CatalogService` and Applesauce `EventStore` own active-account replacement truth; browser never merges or persists it. [VERIFIED: codebase] |
| Catalog synchronization | API / Backend | Browser / Client | Relay observable streams into EventStore and backend pushes projections; browser retains only last displayed projection. [VERIFIED: codebase and official Applesauce MCP example] |
| Partial-entry enrichment | API / Backend | Browser / Client | Backend derives verified metadata and unavailable states; browser renders stable coordinate-keyed cards. [VERIFIED: codebase] |
| Local installed search | Browser / Client | — | Filtering existing projected metadata is interactive and non-authoritative; no relay query is allowed. [VERIFIED: CONTEXT.md] |
| Launch authorization and executable resolution | API / Backend | Browser / Client | Backend re-derives current catalog membership and exact manifest identity; browser receives bytes only after acceptance. [CITED: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/] |
| Sandboxed iframe lifecycle | Browser / Client | API / Backend | Existing island owns one mounted frame, while backend owns the executable and NAP authority. [VERIFIED: codebase; AGENTS.md] |

## Project Constraints (from AGENTS.md)

- Use Deno and Fresh; use Fresh routes for SSR pages and islands only for browser interactivity. [VERIFIED: AGENTS.md]
- Keep persistent state, complex Nostr processing, relay/Blossom operations, account handling, storage, and NAP execution in the backend. [VERIFIED: AGENTS.md]
- Prefer Applesauce packages and RxJS functional streams; avoid nested subscriptions, duplicated state machines, and wait-for-all `async` flows. [VERIFIED: AGENTS.md]
- Treat Nostr as partial, empty, stale, and updating streams, not completed requests. [VERIFIED: AGENTS.md]
- Sibling `../napplet` and `../kehto` are reference-only; production imports use pinned npm packages, especially `@napplet/core@0.31.0` and `@napplet/nap@0.31.0`. [VERIFIED: AGENTS.md]
- Napplets remain in sandboxed iframes and NAP access crosses the explicit proxy/message boundary. [VERIFIED: AGENTS.md]
- Preserve acceptable mobile-browser and fullscreen behavior. [VERIFIED: AGENTS.md]
- Follow Deno fmt/lint/check, two-space indentation, double quotes, explicit local extensions, Fresh JSX `class`, direct imports, and typed route helpers. [VERIFIED: AGENTS.md]
- Validate external/user input and return explicit errors without logging secrets or request bodies. [VERIFIED: AGENTS.md]
- Exercise runtime WebSockets through `deno task build && deno task start`, because the pinned Fresh/Vite development seam cannot receive upgrades. [VERIFIED: AGENTS.md]
- Work must remain in the GSD workflow, be verified, diff-inspected, and committed. [VERIFIED: AGENTS.md]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Deno | 2.9.4 installed | Runtime, tests, formatting, lint, type checking | Project runtime and verified available locally. [VERIFIED: `deno --version`, AGENTS.md] |
| Fresh | 2.3.3 pinned | Same-origin runtime WebSocket route and shell composition | Existing server framework; no new HTTP architecture is needed. [VERIFIED: `deno.json`] |
| Preact | 10.29.7 pinned | Catalog form/dialog/search interactivity | Existing island/component framework. [VERIFIED: `deno.json`] |
| `nostr-tools` | 2.24.1 pinned/current; registry modified 2026-07-21 | `nip19.decodeNostrURI`, event signature verification, Nostr filters | Existing dependency and canonical parser used by the sibling conformance implementation. [VERIFIED: registry, pinned source, sibling reference] |
| `applesauce-core` | 6.2.0 pinned/current; registry modified 2026-07-14 | EventStore and latest replaceable-event projection | Existing authoritative event store. [VERIFIED: registry and codebase] |
| `applesauce-relay` | 6.2.1 pinned | Streaming relay requests and publication | Existing relay observable and required-relay publication seam. [VERIFIED: `deno.json`, codebase] |
| RxJS | 7.8.2 pinned/current; registry modified 2025-02-22 | Functional relay/event streams | Already used by the event runtime; maintain observable subscriptions rather than await EOSE. [VERIFIED: registry and codebase] |
| `@kehto/nip` | 0.5.1 pinned | NIP-5D artifact resolution and integrity cache contract | Existing `resolveNapplet` boundary verifies manifest-derived executable content. [VERIFIED: `deno.json`, pinned declarations] |
| `@napplet/core` / `@napplet/nap` | 0.31.0 pinned/current; registry modified 2026-07-28 | Pinned Nostr/NAP contracts and injected runtime | Explicit project constraint; sibling source is reference-only. [VERIFIED: registry, `deno.json`, AGENTS.md] |

### Supporting

| Library/API | Version | Purpose | When to Use |
|-------------|---------|---------|-------------|
| WebSocket + JSON | Platform | Existing correlated command/result and pushed projection channel | Add preview, approval, and launch variants with exact-key/size validation. [VERIFIED: `runtime/transport.ts`, `routes/api/runtime.ts`] |
| Native `<dialog>` | Platform | Install review and recovery-preserving approval UI | Reuse current focus restoration and catalog-change invalidation. [VERIFIED: `components/HomeView.tsx`] |
| HTML search input | Platform | Mobile-friendly installed-catalog filter | Use an explicit label, `type="search"`, clear affordance, and live result status. [CITED: https://www.w3.org/WAI/WCAG22/working-examples/aria-role-status-searchresults/] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Local in-memory filtering | Relay-side search | Explicitly out of scope and would make results depend on synchronization/network behavior. [VERIFIED: CONTEXT.md] |
| Backend stale-checked launch | Browser-projected `srcdoc` launch | Current code is fast but treats stale browser material as authority and violates CAT-03/D-11/D-12. [VERIFIED: codebase and CONTEXT.md] |
| Partial projection with entry state | `Promise.all` full resolution | Waits for the slowest artifact and cannot preserve catalog facts independently from artifact availability. [VERIFIED: codebase gap analysis] |
| Existing native dialog | New dialog library | Adds dependency and focus complexity without a missing capability. [VERIFIED: codebase] |

**Installation:** No new packages. Keep the existing pinned import map and lockfile. [VERIFIED: codebase]

## Package Legitimacy Audit

No package installation is planned. The existing packages were nevertheless checked on the correct npm registry. [VERIFIED: npm registry]

| Package | Registry | Age/Publish Signal | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|--------------------|-----------|-------------|---------|-------------|
| `nostr-tools` | npm | current release flagged too new | 1,005,283/wk | github.com/nbd-wtf/nostr-tools | SUS | Existing pinned dependency; do not add/upgrade in Phase 4. |
| `applesauce-core` | npm | established package, registry lacks repo metadata | 1,765/wk | none in registry metadata | SUS | Existing pinned dependency; do not add/upgrade in Phase 4. |
| `rxjs` | npm | established | 99,459,410/wk | github.com/ReactiveX/rxjs | OK | Existing approved dependency. |
| `@napplet/core` | npm | current release flagged too new | 1,352/wk | github.com/sandwichfarm/napplet | SUS | Existing explicitly pinned project contract; do not add/upgrade. |
| `@napplet/nap` | npm | current release flagged too new | 1,503/wk | github.com/sandwichfarm/napplet | SUS | Existing explicitly pinned project contract; do not add/upgrade. |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** no new installs; all SUS results are already pinned project dependencies, and their package source/contracts are available locally for verification. [VERIFIED: package-legitimacy seam and codebase]

## Architecture Patterns

### System Architecture Diagram

```text
Home install input / card click / search keystroke
        |
        +-- search --> local normalized filter --> current partial cards + result status
        |
        +-- naddr preview --> same-origin WebSocket --> strict command decoder
        |                                           |
        |                                           v
        |                              NIP-19 decode + kind 35129 check
        |                                           |
        |                                           v
        |                              exact manifest + artifact verification
        |                                           |
        |                                           v
        |                              immutable review + source catalog ID
        |                                           |
        +-- approve --------------------------------+
        |                                           v
        |                              stale-check current catalog ID
        |                                           |
        |                                  [same?] -- no --> retryable stale result
        |                                           |
        |                                          yes
        |                                           v
        |                              serialized sign + all-relay publish
        |
Relay replacement stream --> Applesauce EventStore --> raw accepted-entry projection
                                                        |
                                                        +--> immediate placeholder push
                                                        |
                                                        +--> bounded async enrichment
                                                                  |
                                                                  +--> verified card update
                                                                  +--> unavailable card state

Card launch --> WebSocket `(catalogId, coordinate, manifestId)` --> current-catalog comparison
                                                                  |
                                                      [exact match?] -- no --> Home + refresh/error
                                                                  |
                                                                 yes
                                                                  v
                                                     exact artifact integrity boundary
                                                                  |
                                                                  v
                                                     executable bytes --> one sandboxed iframe
```

### Recommended Project Structure

```text
runtime/
├── catalog.ts          # raw catalog truth, preview/approve/launch authority, entry enrichment state
├── artifacts.ts        # exact accepted-manifest integrity resolution
├── transport.ts        # strict bounded correlated catalog command codecs
└── portal_runtime.ts   # bridge methods composing catalog and artifact services
routes/api/runtime.ts   # same-origin WebSocket dispatch and pushed projection sequencing
components/
└── HomeView.tsx        # install/review presentation, cards, state copy, search presentation
islands/
└── NappletShell.tsx    # transport correlation, local query, one mounted iframe lifecycle
tests/
├── catalog_test.ts
├── catalog_ui_test.tsx
├── artifact_resolver_test.ts
└── end_to_end_test.ts
```

### Pattern 1: Raw Truth Before Enrichment

**What:** Decode the latest valid catalog synchronously into stable entries first; emit each entry with `resolution: "pending" | "ready" | "unavailable"` and optional verified metadata/launch availability. Enrich independently, keyed by `(catalogEventId, coordinate, acceptedManifestEventId)`, and discard late results if that key is no longer current. [VERIFIED: CONTEXT.md and codebase gap analysis]

**When to use:** Every catalog load, relay replacement, reconnect, account switch, and artifact retry.

**Example:**

```typescript
// Source: project CatalogService pattern + locked D-05 through D-07
interface CatalogProjectionEntry extends InstalledNappletEntry {
  readonly resolution: "pending" | "ready" | "unavailable";
  readonly title?: string;
  readonly version?: string;
  readonly capabilities?: readonly string[];
}

const key = `${catalogEvent.id}:${entry.coordinate}:${entry.acceptedManifestEventId}`;
void resolveEntry(entry).then((verified) => {
  if (key !== currentEntryKey(entry.coordinate)) return;
  publishEnrichedProjection(verified);
});
```

### Pattern 2: Immutable Preview Bound to Catalog Generation

**What:** Preview returns all trust facts plus `sourceCatalogEventId`. Approval submits the preview's coordinate/manifest ID/source catalog ID; backend rejects it if current catalog truth changed. Do not hold a mutable server-side preview as authority or accept review facts back from the browser. [VERIFIED: CONTEXT.md; CITED: https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html]

**When to use:** New install and update review.

### Pattern 3: Triple-Key Backend Launch Check

**What:** Treat all browser fields as selectors. Re-read active account's current replaceable catalog, require matching `catalogEventId`, find coordinate, require exact `acceptedManifestEventId`, then resolve the artifact with that exact event ID. Return a correlated error plus fresh projection on any mismatch. [VERIFIED: CONTEXT.md; CITED: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/]

**When to use:** Every installed-card launch, including clicks on stale UI after a pushed update.

### Pattern 4: Pure Query Projection

**What:** Preserve raw query state independently of catalog pushes; normalize query and fields without mutating entries. Match title, coordinate identifier (the final coordinate component), version, and capabilities. Partial entries match only fields currently present. [VERIFIED: CONTEXT.md]

**When to use:** Every input event and every projection update. Debouncing is unnecessary for typical installed lists; if used, debounce only rendering computation, never state updates or network work because there is no network search. [ASSUMED]

### Anti-Patterns to Avoid

- **Sequential all-entry `await` before projection:** It delays all cards and drops failed accepted entries; emit raw truth immediately and enrich independently. [VERIFIED: current code gap]
- **Empty fallback on projection error:** It destroys last-good state; send status/error separately and omit replacement projection or resend last-good. [VERIFIED: current `sendCatalog()` gap]
- **Browser `srcdoc` as launch authority:** The current direct `openCatalogEntry()` path is stale/substitutable; always request launch from backend. [VERIFIED: current code gap]
- **Optimistic install card:** Do not insert until all required relays accepted the signed replacement and EventStore advanced. [VERIFIED: existing mutation semantics and CONTEXT.md]
- **Preview surviving catalog replacement:** Close/invalidate just as current update dialogs do. [VERIFIED: existing UI pattern]
- **Network-backed search or query reset:** Both violate locked local, stream-preserving behavior. [VERIFIED: CONTEXT.md]
- **Duplicate catalog state machine in the island:** Backend status/projection is authoritative; browser keeps display/query/command correlation only. [VERIFIED: AGENTS.md]
- **Unbounded command correlation:** Ensure timeout/socket-close cleanup resolves pending preview/approval/launch promises; current catalog command map otherwise risks hanging promises. [VERIFIED: codebase gap analysis]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NIP-19 Bech32/TLV parsing | Custom `naddr` parser | Pinned `nostr-tools/nip19.decodeNostrURI` | Correctly decodes identifier, pubkey, kind, relay hints, and optional `nostr:` URI form. [VERIFIED: pinned declarations/source] |
| Signature verification | Custom crypto | Existing `verifyEvent` / artifact resolver | Cryptographic validation is already centralized. [VERIFIED: codebase] |
| Manifest/blob aggregate validation | Portal-specific hashing/fetch validation | `@kehto/nip/5d` through `PortalArtifactResolver` | Existing boundary covers signature, paths, aggregate, blob hashes, index, and capabilities. [VERIFIED: codebase and pinned declarations] |
| Replaceable-event conflict logic | Browser merge/reconciliation | Applesauce `EventStore.getReplaceable()` plus strict decoder | Maintains one latest valid active-account authority. [VERIFIED: codebase] |
| Dialog focus management | Custom modal overlay | Native `<dialog>` plus current focus restoration | Existing tested accessible seam handles modality and stale close. [VERIFIED: codebase] |
| Search index | New package/server index | Pure normalized array filter | Installed list is already local and streaming; extra index adds state without authority. [VERIFIED: CONTEXT.md] |

**Key insight:** Phase 4 is primarily an authority-and-projection problem. Existing libraries already solve encoding, Nostr replacement, cryptography, artifact integrity, transport, and modal primitives; custom work should only compose them into stale-safe state transitions. [VERIFIED: codebase]

## Common Pitfalls

### Pitfall 1: Accepted Entries Disappear During Resolution
**What goes wrong:** A relay-valid entry vanishes because manifest or Blossom retrieval failed. [VERIFIED: current `project()` behavior]
**Why it happens:** Catalog membership and executability are represented by one successful-resolution type. [VERIFIED: codebase]
**How to avoid:** Project raw entries first and attach explicit entry resolution state; keep coordinate-derived title fallback. [VERIFIED: CONTEXT.md]
**Warning signs:** Entry count shrinks after transient artifact errors; global status becomes empty/error.

### Pitfall 2: Out-of-Order Enrichment Reanimates Stale Catalog Data
**What goes wrong:** A slow old manifest resolution updates a card after a newer catalog replacement or account switch. [ASSUMED]
**Why it happens:** Promise completion is not generation guarded.
**How to avoid:** Compare catalog event ID, coordinate, manifest ID, and active pubkey before applying every async result. [VERIFIED: analogous generation-guarded Phase 3 transport pattern]
**Warning signs:** Card metadata does not match accepted manifest ID or returns after uninstall.

### Pitfall 3: Install Approval Becomes a TOCTOU Mutation
**What goes wrong:** User reviews against catalog A but approval overwrites changes from catalog B. [VERIFIED: CONTEXT.md threat]
**Why it happens:** Existing serialized mutation re-reads latest entries but does not know which generation the review saw. [VERIFIED: codebase]
**How to avoid:** Include `sourceCatalogEventId` in approval and reject mismatch before resolving/signing; force a new review. [VERIFIED: CONTEXT.md]
**Warning signs:** Approval succeeds after review dialog should have invalidated.

### Pitfall 4: Launch Uses Previously Projected Executable HTML
**What goes wrong:** Removed/replaced/unresolved entry launches from browser memory. [VERIFIED: current `openCatalogEntry()` path]
**Why it happens:** Projection includes `launch.srcdoc` and click assigns it directly.
**How to avoid:** Remove executable HTML from ordinary catalog projection; use correlated backend launch and only assign returned verified bytes. [VERIFIED: CONTEXT.md]
**Warning signs:** No catalog ID in launch request or iframe changes before backend result.

### Pitfall 5: Status and Data Are Coupled
**What goes wrong:** Refresh error overwrites useful cards with empty projection. [VERIFIED: current route fallback]
**Why it happens:** One `sendCatalog` catch fabricates `{entries: []}`.
**How to avoid:** Track last-good projection in catalog service/runtime route, and send status independently. [VERIFIED: CONTEXT.md]
**Warning signs:** `status: "error"` always carries an empty catalog.

### Pitfall 6: Search Becomes Chatty or Misleading
**What goes wrong:** Input resets on pushes, filtered empty state says nothing is installed, or every keystroke floods a live region. [VERIFIED: CONTEXT.md; CITED: https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html]
**Why it happens:** Query and projection lifecycle are coupled or assertive announcements are overused.
**How to avoid:** Preserve query independently, separate total-empty from no-match, and use one concise polite/atomic result status. [CITED: https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html]
**Warning signs:** Focus moves during filtering, query clears, or `role="alert"` announces ordinary result changes.

## Code Examples

### Strict `naddr` Normalization

```typescript
// Source: pinned nostr-tools@2.24.1 declarations/source and sibling reference-only conformance target
import { decodeNostrURI } from "nostr-tools/nip19";

export function decodeInstallNaddr(input: string): {
  coordinate: string;
  relays: readonly string[];
} {
  const decoded = decodeNostrURI(input.trim());
  if (decoded.type !== "naddr" || decoded.data.kind !== 35129) {
    throw new Error("Enter a named napplet naddr");
  }
  return {
    coordinate:
      `${decoded.data.kind}:${decoded.data.pubkey}:${decoded.data.identifier}`,
    relays: Object.freeze([...new Set(decoded.data.relays ?? [])]),
  };
}
```

### Local Search Projection

```typescript
// Source: locked D-08 through D-10
export function matchesInstalledSearch(
  entry: CatalogViewEntry,
  rawQuery: string,
): boolean {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) return true;
  const identifier = entry.coordinate.split(":").at(-1) ?? "";
  return [
    entry.title,
    identifier,
    entry.version,
    ...(entry.capabilities ?? []),
  ].some((value) => value?.toLocaleLowerCase().includes(query));
}
```

### Server-Revalidated Launch

```typescript
// Source: locked D-11/D-12 and OWASP server-side re-derivation guidance
async function launch(request: LaunchRequest): Promise<LaunchResult> {
  const current = currentDecodedCatalog();
  if (!current.event || current.event.id !== request.catalogEventId) {
    return { id: request.id, ok: false, code: "catalog-stale" };
  }
  const entry = current.catalog.entries.find((candidate) =>
    candidate.coordinate === request.coordinate
  );
  if (!entry ||
    entry.acceptedManifestEventId !== request.acceptedManifestEventId) {
    return { id: request.id, ok: false, code: "entry-stale" };
  }
  const artifact = await resolveVerifiedArtifact(
    entry.coordinate,
    entry.acceptedManifestEventId,
  );
  return { id: request.id, ok: true, artifact };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full catalog projection waits for artifact resolutions | Emit accepted catalog truth, then stream keyed enrichment | Required by Phase 4 locked decisions | Partial cards remain useful and failures do not erase catalog facts. [VERIFIED: CONTEXT.md] |
| Project `srcdoc` to browser and launch locally | Backend command revalidates catalog generation and accepted manifest before returning bytes | Required by CAT-03 | Closes stale-object and substituted-identity launch path. [VERIFIED: CONTEXT.md] |
| Install/update approval identified only by coordinate and manifest ID | Bind review to source catalog event ID | Required by D-04 | Prevents review/approval races with relay replacements. [VERIFIED: CONTEXT.md] |
| Completion-oriented relay loading | RxJS/Applesauce emission-driven projection | Existing project constraint | Search and cards update before EOSE/completion. [VERIFIED: AGENTS.md and official Applesauce example] |

**Deprecated/outdated:**
- Direct `openCatalogEntry()` assignment from `entry.launch.srcdoc` must be retired for installed-card launch. [VERIFIED: CONTEXT.md]
- `CatalogService.project()` silently continuing past failed artifacts must be replaced by explicit entry states. [VERIFIED: CONTEXT.md]
- Route error fallback to an empty projection must be replaced by last-good preservation. [VERIFIED: CONTEXT.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Debouncing is unnecessary for typical installed-list sizes; if desired it should affect computation only. | Architecture Pattern 4 | Low; planner can choose immediate or lightly debounced local filtering without affecting authority. |
| A2 | Late artifact promise completion is a realistic source of stale enrichment races. | Pitfall 2 | Medium; even if current fixture resolves quickly, production relay/Blossom latency makes generation guards prudent. |

## Open Questions

1. **Which relay set should install preview use?**
   - What we know: `naddr` can contain relay hints, while the runtime has configured read relays and an existing relay policy. [VERIFIED: pinned nostr-tools and codebase]
   - What's unclear: CONTEXT.md locks backend decode/resolve but does not explicitly choose hint-only versus policy-combined reads.
   - Recommendation: Normalize valid `ws:`/`wss:` hints, pass them through existing `RelayPolicy.read`, and combine with configured relays without bypassing policy; test no-hint behavior explicitly. [ASSUMED]

2. **Where should enrichment concurrency be bounded?**
   - What we know: current sequential awaits block the projection; unbounded parallel fetches could overload mobile/server/relays. [VERIFIED: codebase gap]
   - What's unclear: no performance target or concurrency limit is locked.
   - Recommendation: expose raw projection immediately and use a small backend queue or shared in-flight promise map keyed by exact artifact identity; planner should choose/test a deterministic bound. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Deno | build, unit/integration tests, server | ✓ | 2.9.4 | — |
| Node/npm | registry/legitimacy verification only | ✓ | Node 22.23.1 / npm 10.9.8 | Deno pinned lockfile for execution |
| Project `node_modules` | pinned npm declarations/source | ✓ | lockfile-resolved | `deno install`/cache resolution from `deno.lock` if regenerated |
| Nostr relays | live catalog sync/preview/publish | Environment-configured, not probed | — | Deterministic injected relay observables in unit tests |
| Blossom servers | artifact verification | Environment-configured, not probed | — | Existing in-memory/fake fetch fixtures in tests |

**Missing dependencies with no fallback:** none for planning and deterministic implementation tests. [VERIFIED: environment audit]

**Missing dependencies with fallback:** live relays and Blossom availability are external runtime conditions; tests already inject stores, publishes, manifests, and fetchers. [VERIFIED: codebase]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Deno test 2.9.4 |
| Config file | `deno.json` |
| Quick run command | `deno test -A tests/catalog_test.ts tests/catalog_ui_test.tsx` |
| Full suite command | `deno task test && deno task check` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAT-01 | strict naddr preview, review fields, stale invalidation, serialized all-relay approval, retry preservation | unit + component + integration | `deno test -A tests/catalog_test.ts tests/catalog_ui_test.tsx` | ✅ extend existing |
| CAT-02 | initial/empty/populated/partial/stale/error matrix, last-good retention, per-entry enrichment/failure, account switch | unit + component | `deno test -A tests/catalog_test.ts tests/catalog_ui_test.tsx` | ✅ extend existing |
| CAT-03 | triple-key launch validation, stale/removed/replaced/unresolved rejection, exact accepted artifact, one frame | unit + integration | `deno test -A tests/catalog_test.ts tests/artifact_resolver_test.ts tests/end_to_end_test.ts` | ✅ extend existing |
| CAT-04 | case-insensitive metadata matching, partial fields, query retention across pushes, distinct empty/no-match, live status | unit + component | `deno test -A tests/catalog_ui_test.tsx` | ✅ extend existing |

### Sampling Rate

- **Per task commit:** `deno test -A tests/catalog_test.ts tests/catalog_ui_test.tsx`
- **Per wave merge:** `deno test -A tests/catalog_test.ts tests/catalog_ui_test.tsx tests/artifact_resolver_test.ts tests/end_to_end_test.ts`
- **Phase gate:** `deno task test && deno task check`; production WebSocket launch/install smoke should use `deno task build && deno task start`. [VERIFIED: AGENTS.md]

### Wave 0 Gaps

- [ ] Extend `tests/catalog_test.ts` with preview decode, source-generation invalidation, raw-before-enriched projection, late-result rejection, last-good preservation, and launch matrix.
- [ ] Extend `tests/catalog_ui_test.tsx` with install form/review/retry, search matching/query persistence, and all partial/no-match accessibility states.
- [ ] Extend `tests/end_to_end_test.ts` or add a focused production runtime test for correlated preview/approve/launch and stale launch rejection.
- [ ] Add deterministic deferred artifact fixtures for out-of-order enrichment and failure/recovery.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Active backend signer/account projection authorizes catalog mutation; browser identity fields are ignored. [VERIFIED: codebase] |
| V3 Session Management | yes | Existing same-origin WebSocket connection/window ownership and reconnect-token controls. [VERIFIED: Phase 3 and codebase] |
| V4 Access Control | yes | Revalidate active account, current catalog event, coordinate, and accepted manifest on every approval/launch. [CITED: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/] |
| V5 Input Validation | yes | Strict exact-shape bounded JSON commands, `nip19.decodeNostrURI`, kind `35129`, 64-hex IDs, coordinate normalization, URL policy. [VERIFIED: codebase and pinned source] |
| V6 Cryptography | yes | `nostr-tools.verifyEvent`, signer service, and `@kehto/nip/5d`; never hand-roll signatures/hashes. [VERIFIED: codebase] |

### Known Threat Patterns for Deno/Fresh + Nostr Catalog

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Manipulated/stale catalog object identifiers | Spoofing / Elevation of Privilege | Server-side triple-key comparison against active-account latest replaceable catalog. [CITED: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/] |
| Review-to-approval catalog race | Tampering | Bind preview to source catalog event ID; reject on replacement. [VERIFIED: CONTEXT.md] |
| Manifest substitution/newer unapproved version | Tampering | Resolve exact accepted event ID; never resolve “latest” at launch. [VERIFIED: CONTEXT.md] |
| Malformed/oversized WebSocket command | Denial of Service | Existing 256 KB outer bound plus exact command keys, bounded string fields, correlation cleanup/timeouts. [VERIFIED: codebase] |
| Unbounded artifact fan-out | Denial of Service | Deduplicate exact artifact identities and bound concurrent enrichment; cancel/discard obsolete generation results. [ASSUMED] |
| Executable leakage in ordinary projection | Information Disclosure / Tampering | Do not push `srcdoc` with catalog cards; return only after authorized launch. [VERIFIED: CONTEXT.md] |
| Cross-account catalog bleed after identity change | Information Disclosure | Include active pubkey/generation in projection/enrichment guards and push cleared/new account truth immediately. [VERIFIED: codebase architecture] |

## Sources

### Primary (HIGH confidence)

- Project `AGENTS.md`, `04-CONTEXT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md` — locked scope, architecture, workflow, and CAT-01 through CAT-04. [VERIFIED: codebase]
- `runtime/catalog.ts`, `runtime/artifacts.ts`, `runtime/transport.ts`, `runtime/portal_runtime.ts`, `routes/api/runtime.ts`, `islands/NappletShell.tsx`, `components/HomeView.tsx`, and catalog/artifact/end-to-end tests — current seams and gaps. [VERIFIED: codebase]
- Pinned `nostr-tools@2.24.1` declarations/source — NIP-19 decoder contract. [VERIFIED: pinned package source]
- Sibling `../napplet/apps/conformance/src/target.ts` — reference-only naddr/kind/filter normalization pattern aligned with pinned contracts. [VERIFIED: codebase reference]
- Official Applesauce MCP `loader/sync-loader` example — simultaneous status/event observables and per-event streaming. [VERIFIED: official Applesauce MCP]

### Secondary (MEDIUM confidence)

- [W3C WCAG status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html) — search/status announcements without focus theft. [CITED: https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html]
- [W3C role=status search results example](https://www.w3.org/WAI/WCAG22/working-examples/aria-role-status-searchresults/) — concise search result feedback. [CITED: https://www.w3.org/WAI/WCAG22/working-examples/aria-role-status-searchresults/]
- [OWASP API1:2023 BOLA](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/) — validate object authorization for every client-supplied ID. [CITED: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/]
- [OWASP Business Logic Security](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html) — re-derive security-relevant values server-side. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html]

### Tertiary (LOW confidence)

- None used as authoritative support; assumptions are isolated in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies are existing pinned codebase packages and registry versions were checked.
- Architecture: HIGH — driven by locked decisions and traced through live catalog/artifact/WebSocket/UI seams.
- Pitfalls: HIGH — most are direct contradictions between current code and locked Phase 4 behavior; two forward-looking concurrency claims are marked assumed.

**Research date:** 2026-07-31
**Valid until:** 2026-08-30 (stack is pinned; re-check only if dependencies or Phase 4 context changes)
