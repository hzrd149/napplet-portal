# Phase 2: Backend Runtime Expansion - Research

**Researched:** 2026-07-30
**Domain:** Deno/Fresh backend-owned Nostr runtime, Applesauce streams, local relay/Blossom caching, NIP-65/42/78, and Napplet contract verification
**Confidence:** MEDIUM-HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Event persistence and synchronization
- **D-01:** Use an optional local Nostr relay as the durable event store/cache; do not add a separate embedded event database. Without the local relay, the portal continues with its shared in-memory Applesauce event store.
- **D-02:** Implement read-through event caching: query the local relay first through EOSE, then open upstream subscriptions and asynchronously publish every valid upstream event observed by portal subscriptions back to the local relay.
- **D-03:** Cache acknowledgement never delays napplet delivery. Local relay unavailability or write failure is non-fatal and becomes a cache-health warning while upstream streams continue.
- **D-04:** Use the customizable timeout exposed by Applesauce Relay/RelayPool so a local relay that never reaches EOSE cannot block upstream access. Validate the exact sequential composition against official Applesauce examples during research.
- **D-05:** Applesauce's in-memory event store owns live dedupe and replaceable/addressable/deletion semantics; the local relay owns durable indexing and deletion behavior.

### Local relay and Blossom cache behavior
- **D-06:** Treat the standard local Blossom server as a read-through proxy. Send BUD-10 `xs`/`as` hints so it can retrieve and cache misses itself.
- **D-07:** If the local Blossom server is unavailable or its proxy attempt fails, the portal runtime fetches directly from upstream rather than failing the request.
- **D-08:** Automatically discover the local Blossom cache with `HEAD http://127.0.0.1:24242/`; explicit configuration is not required.
- **D-09:** Trust a healthy loopback Blossom cache for ordinary media, but preserve the Phase 1 integrity boundary: manifests and executable napplet artifacts must always be hash/signature verified before execution.

### Operator configuration
- **D-10:** Provide a backend-persisted settings page for relay and Blossom settings. Saved changes take effect without a server restart. — **Reversibility:** costly — replacing account/operator-owned persistent settings with startup-only configuration would require migrating stored settings and reactive consumers.
- **D-11:** Operators configure fallback/extra relays and default indexer/lookup relays. Ordinary read/write routing remains derived from NIP-65.
- **D-12:** Prefer Applesauce's reactive indexer/lookup relay state when available; configured runtime values are defaults, not a duplicated state machine.
- **D-13:** Applesauce-composed streams react naturally to relay-list changes where supported. Non-reactive operations use the new settings when next started; do not force teardown solely to apply a change.
- **D-14:** NIP-42 relay AUTH is per-relay opt-in and separate from portal login and signer authority.
- **D-15:** A user's blocked-relay state overrides NIP-65 routing, lookup defaults, fallback/extra lists, and AUTH permission. The runtime must neither connect nor authenticate to a blocked relay.

### Napplet catalog and identity
- **D-16:** Store the authoritative installed-napplet catalog as one public, signed, replaceable NIP-78 application-data event owned by the active account. The backend derives its local projection from synchronized Nostr state. — **Reversibility:** costly — changing the event representation later requires migrating published account state and all readers.
- **D-17:** Each catalog entry contains only its NIP-5A coordinate and accepted manifest event ID. Resolve display metadata from the accepted integrity-verified manifest.
- **D-18:** Normal Nostr replacement semantics apply to concurrent edits: the latest valid NIP-78 catalog event wins. Phase 2 does not merge divergent catalog edits.
- **D-19:** A newer valid manifest requires operator approval. Continue launching the last accepted manifest until approval; runtime identity comes from that accepted verified manifest, never iframe claims.
- **D-20:** Update approval shows publisher/coordinate, old and new manifest event IDs, display/version changes, aggregate hash, and changed capability declarations.
- **D-21:** Uninstall publishes a replacement catalog without the entry. Content-addressed artifacts remain available until normal cache eviction.

### Contract verification
- **D-22:** Pinned npm packages, including `@napplet/core@0.31.0` and `@napplet/nap@0.31.0`, are authoritative for executable production behavior. Sibling `../kehto` and `../napplet` sources remain reference-only fixtures and drift inputs.
- **D-23:** Sibling-reference drift is non-blocking: it must not fail checks, releases, or runtime startup.
- **D-24:** Contract coverage includes compile-time types, serialized wire fixtures, and lifecycle behavior for handshake, streams, EOSE, close, correlation, and typed errors. Retain the supplied-napplet flow as an end-to-end smoke test.
- **D-25:** Emit a structured drift report naming affected contracts, pinned package versions, sibling revisions, and adapter coverage.

### the agent's Discretion
- Exact backend persistence mechanism for operator settings, provided state remains backend-owned and reactive.
- Exact cache-health presentation and timeout value, provided failures stay non-blocking and Applesauce's timeout facility is used.
- Exact NIP-78 `d` tag/application identifier and public content encoding.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within the Phase 2 boundary.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| V2-01 | Use Applesauce for event storage, pools, loaders, accounts, signers, and models. | Singleton composition, EventStore/model/loader APIs, and teardown guidance. |
| V2-02 | Persist events with dedupe, provenance, replacement/deletion semantics, bounded sync. | EventStore owns live semantics; optional local relay owns durability; local request is bounded. |
| V2-03 | Configure relay and Blossom endpoints from settings. | Atomic backend settings store plus reactive snapshot and server-rendered route. |
| V2-04 | Use local Nostr relay as read-through event cache. | Sequential local request then upstream subscription with non-blocking write-through. |
| V2-05 | Use local Blossom as blob/artifact cache. | Loopback discovery and BUD-10 proxy-hint flow. |
| V2-06 | Support NIP-65 and opt-in NIP-42 separately from login/signing. | Protocol-specific routing/auth policy and blocked-relay gate. |
| V2-07 | Integrate Kehto backend dispatch/runtime contract. | Adapter boundary references pinned packages; sibling is fixture only. |
| V2-08 | Detect Kehto/Napplet/API drift. | Compile, wire-fixture, lifecycle, smoke, and non-blocking JSON report layers. |
| V2-09 | Manage installed napplet catalog. | Signed addressable NIP-78 catalog plus verified local projection and approval flow. |
| V2-10 | Attest identity from verified/catalog-controlled data. | Accepted manifest ID is authoritative; iframe claims are ignored. |
</phase_requirements>

## Summary

Phase 2 should extend the existing process-owned `RelayPool`, account runtime, relay adapter, and artifact verifier rather than introduce a second runtime. The central stream is: read the optional local relay with `Relay.request(..., { timeout })` until EOSE, then `concat` an upstream persistent subscription; validate and add events to the shared `EventStore`, deliver immediately, and initiate local cache publishing as a detached, observed side effect. Applesauce 6.2.1 exposes request/subscription separation, request timeouts, observable pool/group inputs, relay AUTH state, and terminal pool/relay teardown. [VERIFIED: installed applesauce-relay@6.2.1 declarations] [CITED: https://applesauce.build/introduction/getting-started.html]

Use the existing atomic JSON-file persistence pattern for operator settings, with a `BehaviorSubject` snapshot as the backend source consumed by routing and Fresh pages. This fits current Deno code and avoids a new database dependency. The authoritative catalog is different: it is one signed public kind `30078` event, projected through EventStore and published through the active signer/outbox. [VERIFIED: codebase grep] [CITED: https://github.com/nostr-protocol/nips/blob/master/78.md]

The largest planning risk is assuming APIs provide more than they do. EventStore handles live duplicate/replacement/deletion behavior, but the locked local relay remains the durable database. RelayPool subscriptions emit events, whereas a single `Relay.subscription()` can preserve explicit EOSE; design the local-first boundary around `Relay.request()` completion rather than trying to extract EOSE from `RelayPool.subscription()`. [VERIFIED: installed applesauce-core@6.2.0 and applesauce-relay@6.2.1 declarations]

**Primary recommendation:** Build four backend modules in dependency order—reactive settings/policy, shared event/relay runtime with local-first cache, Blossom fetch routing, then signed catalog/contract reporting—and integrate them into the existing singleton only after focused tests pass.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Event semantics and relay routing | API / Backend | Local relay | Backend owns validation/live semantics; relay owns durable indexing. |
| Operator settings | API / Backend | Database / Storage | Backend validates/persists; Fresh page is only presentation/input. |
| Blossom read-through | API / Backend | Local Blossom service | Backend selects sources and preserves integrity boundary. |
| Installed catalog | API / Backend | Nostr relays | Backend signs/projects; relays synchronize the public event. |
| Update approval UI | Frontend Server (SSR) | Browser / Client | Server supplies attested comparison; island only submits a decision if needed. |
| Contract drift report | API / Backend | Filesystem/CI artifact | Tests compare pinned executable contracts to reference-only siblings. |

## Project Constraints (from AGENTS.md)

- Use Deno/Fresh; routes render server-side and islands contain browser interaction only. [VERIFIED: AGENTS.md]
- Keep persistent state, Nostr processing, relay/Blossom operations, accounts, and NAP execution in the backend. [VERIFIED: AGENTS.md]
- Prefer Applesauce and RxJS functional streams; avoid nested subscriptions and unnecessary wait-for-completeness `async` flows. [VERIFIED: AGENTS.md]
- Treat Nostr as partial, empty, stale, and updating data. [VERIFIED: AGENTS.md]
- Sibling `../kehto` and `../napplet` are reference-only; production uses pinned npm imports, especially `@napplet/core@0.31.0` and `@napplet/nap@0.31.0`. [VERIFIED: AGENTS.md]
- Preserve sandboxed iframe and explicit proxy/message boundaries. [VERIFIED: AGENTS.md]
- Use Deno formatting, two-space indentation, double quotes, explicit local extensions, typed Fresh helpers, direct module imports, and `deno task check`. [VERIFIED: AGENTS.md]
- Start changes through the applicable GSD workflow, verify, inspect the diff, and commit intentional files. [VERIFIED: AGENTS.md]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `applesauce-core` | 6.2.0 (published/modified 2026-07-14) | EventStore, models, helpers, NIP-65 factory | Already pinned; official foundation. [VERIFIED: npm registry + official Applesauce docs] |
| `applesauce-relay` | 6.2.1 (2026-07-14) | Relay/Pool, request/subscription, AUTH, sync | Already pinned and exposes required timeout/reactive APIs. [VERIFIED: npm registry + installed declarations] |
| `applesauce-accounts` | 6.2.0 (2026-07-14) | AccountManager and reactive account state | Already integrated. [VERIFIED: npm registry + codebase grep] |
| `applesauce-signers` | 6.2.2 (2026-07-14) | Nostr Connect and signing | Already integrated with process-owned pool. [VERIFIED: npm registry + codebase grep] |
| `applesauce-loaders` | 6.2.0 (2026-07-14) | Unified EventStore loader | Official docs recommend `createEventLoaderForStore`. [VERIFIED: npm registry + official Applesauce docs] |
| `rxjs` | 7.8.2 | Stream composition and lifecycle | Existing direct imports and Applesauce peer API. [VERIFIED: codebase/lockfile grep] |
| `@napplet/core`, `@napplet/nap` | 0.31.0 (2026-07-28) | Authoritative production types/wire contracts | Locked exact versions. [VERIFIED: npm registry + official package repository metadata] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@kehto/runtime` | 0.20.1 | Pinned runtime contract/dispatch helpers | Use where it matches the existing adapter; never import sibling source. [VERIFIED: npm registry] |
| `@kehto/shell` | 0.19.1 | Shell namespace prelude | Existing verified iframe initialization. [VERIFIED: npm registry + codebase grep] |
| Deno filesystem APIs | Deno 2.9.4 | Atomic operator-settings JSON | Reuse `AccountStore` queue/temp/rename pattern; no package needed. [VERIFIED: environment + codebase grep] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Atomic versioned JSON settings | Deno KV/SQLite | Adds a second persistence technology with no Phase 2 need; locked event durability remains the local relay. |
| Local relay durability | Embedded event database | Explicitly prohibited by D-01. |
| Pinned npm contracts | Sibling workspace imports | Explicitly prohibited and would make drift alter production behavior. |

**Installation:** add only the missing official loader pin after human verification because the legitimacy seam flags it suspicious:

```json
"applesauce-loaders": "npm:applesauce-loaders@6.2.0"
```

## Package Legitimacy Audit

| Package | Registry | Age / Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----------------|-------------|---------|-------------|
| `applesauce-core` | npm | first observed 2026-06 / 1.7k weekly | registry omits repo | SUS | Existing locked dependency; verify publisher before any upgrade |
| `applesauce-relay` | npm | first observed 2026-06 / 1.3k weekly | registry omits repo | SUS | Existing locked dependency; verify publisher before any upgrade |
| `applesauce-accounts` | npm | first observed 2026-06 / 688 weekly | registry omits repo | SUS | Existing locked dependency; no new install |
| `applesauce-signers` | npm | first observed 2026-07 / 1.1k weekly | registry omits repo | SUS | Existing locked dependency; no new install |
| `applesauce-loaders` | npm | first observed 2026-06 / 1.1k weekly | registry omits repo | SUS | Planner must add `checkpoint:human-verify` before install |
| `@napplet/core`, `@napplet/nap` | npm | published 2026-07-28 / 1.3–1.5k weekly | `sandwichfarm/napplet` | SUS (too new) | Locked/existing; keep exact 0.31.0 |
| `@kehto/runtime`, `@kehto/shell` | npm | published 2026-07-29 / <700 weekly | `kehto/web` | SUS (too new/low downloads) | Existing; keep exact pins |

No checked package declares a `postinstall` script. [VERIFIED: npm registry]

**Packages removed due to SLOP verdict:** none  
**Packages flagged as suspicious [SUS]:** all audited packages; only `applesauce-loaders` is a new install and therefore requires a planner checkpoint.

## Architecture Patterns

### System Architecture Diagram

```text
Fresh settings POST ──validate/blocklist──> SettingsStore ──> settings$ ─────┐
                                                                           │
Napplet NAP request ──> Backend adapter ──> Routing policy (NIP-65/defaults)│
                                   │                 │                      │
                                   │          blocked relay? ─yes─> reject │
                                   │                 │ no                   │
                                   v                 v                      │
                         local Relay.request(timeout) ──EOSE/error──────────┤
                                   │ concat                                 │
                                   v                                        │
                         upstream subscription ──valid event──> EventStore  │
                                   │                         │               │
                                   ├──deliver immediately──> napplet        │
                                   └──async publish──> local relay          │
                                                                           │
Artifact hash ──> local Blossom GET ?xs=&as= ─miss/error─> upstream fetch   │
                    │ hit                                      │            │
                    └────────bytes──> existing signature/hash verification─┘

Active account ──> kind 30078 catalog load/project/sign/publish ──> SSR shell
Pinned package contracts ──tests──> adapters <──non-blocking diff── siblings
```

### Recommended Project Structure

```text
runtime/
├── settings_store.ts       # versioned atomic persistence
├── settings.ts             # BehaviorSubject facade and validation
├── relay_policy.ts         # NIP-65/default/block/AUTH resolution
├── event_runtime.ts        # shared EventStore, loaders, pool lifecycle
├── relay_cache.ts          # local-first read/write-through composition
├── blossom_cache.ts        # loopback discovery and hinted fetch fallback
├── catalog.ts              # NIP-78 codec, projection, commands
└── contract_report.ts      # structured non-blocking drift output
routes/settings.tsx         # server-rendered settings and POST handler
tests/
├── settings_test.ts
├── relay_cache_test.ts
├── blossom_cache_test.ts
├── relay_policy_test.ts
├── catalog_test.ts
└── contract_drift_test.ts
```

### Pattern 1: Bounded Local-First, Live-Upstream Stream

Use `concat(localRequest$, upstream$)`, not `merge`: D-02 requires local EOSE/timeout before upstream opens. Convert local timeout/connect failure to an empty completion plus health update; do not catch upstream failures as cache failures. Use `tap` to synchronously add valid events to EventStore and invoke an owned cache-write queue whose rejection is observed. [VERIFIED: installed Applesauce declarations] [CITED: https://applesauce.build/introduction/getting-started.html]

```ts
// Source: installed applesauce-relay@6.2.1 API + RxJS 7.8 composition
const local$ = localUrl
  ? pool.relay(localUrl).request(filters, { timeout: localTimeoutMs }).pipe(
    catchError((error) => {
      cacheHealth.warn(error);
      return EMPTY;
    }),
  )
  : EMPTY;

const upstream$ = pool.subscription(relays$, filters).pipe(
  tap((event) => {
    eventStore.add(event, observedRelay(event));
    cacheWriter.enqueue(event); // queue observes and reports rejection
  }),
);

return concat(local$, upstream$).pipe(takeUntil(closed$));
```

### Pattern 2: One Reactive Settings Source

Read a validated versioned snapshot at startup, seed `BehaviorSubject<RuntimeSettings>`, and serialize writes through the existing atomic temp-file/rename pattern. Derive relay maps with `map`/`distinctUntilChanged`; consumers use `settings$` or a synchronous snapshot, not copied mutable arrays. [VERIFIED: codebase AccountStore pattern]

### Pattern 3: Policy Before Connection Creation

Normalize URLs and remove blocked relays before passing any input to `pool.relay`, `group`, `subscriptionMap`, publishing, or `authenticate`. This is essential because `pool.relay(url)` creates/returns a connection object; a post-connection block check is too late for D-15. [VERIFIED: installed RelayPool declarations]

### Pattern 4: NIP-78 Command/Projection Boundary

Use a fixed application identifier such as `org.napplet.portal:installed` and versioned JSON content `{ "version": 1, "entries": [...] }`. [ASSUMED] Parse defensively; require kind 30078, active-account pubkey, exact `d`, valid signature/EventStore acceptance, and per-entry coordinate plus 64-hex accepted manifest ID. Publish mutations from the latest projected catalog, then let EventStore replacement semantics update the projection. [CITED: https://github.com/nostr-protocol/nips/blob/master/78.md]

### Anti-Patterns to Avoid

- **Merging cache and upstream immediately:** violates local-first EOSE sequencing and can duplicate connections.
- **Awaiting local cache publish before delivery:** makes an optional cache part of correctness.
- **Detached promises with no rejection observer:** causes invisible cache failure; enqueue and expose health.
- **Portal-owned copy of NIP-65 state:** creates conflicting routing truth.
- **AUTH on challenge automatically:** violates per-relay opt-in and blocked-relay policy; authenticate only after policy approval.
- **Catalog metadata copied from iframe:** violates attested identity; derive only from accepted verified manifest.
- **Sibling imports or generated types in production:** converts a drift sensor into runtime authority.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Event dedupe/replacement/deletion | Custom maps/timestamps | Applesauce `EventStore` | It already coordinates duplicate identity, replacements, deletes, models, and disposal. |
| Relay lifecycle/retry/AUTH protocol | Raw WebSocket manager | Applesauce `Relay`/`RelayPool` | Existing challenge/auth/retry/timeout/close machinery. |
| Pointer loading | Bespoke fetch registry | `createEventLoaderForStore` | Official unified event/address loader seam. |
| Blob cache server | Portal disk cache/proxy protocol | Standard local Blossom cache | Standard discovery, retrieval, proxy hints, and cache behavior. |
| Wire contract source | Copied sibling interfaces | Pinned `@napplet/*`/`@kehto/*` imports | Compile-time authority stays reproducible. |
| Event database | SQLite/IndexedDB adapter | Optional local relay + in-memory EventStore | Locked architecture explicitly assigns durability to local relay. |

## Common Pitfalls

### Pitfall 1: Losing EOSE at the Pool Abstraction
**What goes wrong:** `RelayPool.subscription()` yields events only, so code cannot sequence on explicit EOSE.  
**Avoid:** use the local relay's one-shot `request()` (completion means EOSE or bounded completion), then concat the upstream subscription. [VERIFIED: installed declarations]

### Pitfall 2: Provenance Is Added After Deduplication
**What goes wrong:** duplicate IDs arrive from another relay but their relay metadata is lost.  
**Avoid:** always call `eventStore.add(event, relayUrl)` even for duplicates; EventStore copies important metadata between identical instances. [VERIFIED: installed EventStore declarations]

### Pitfall 3: Settings Change Reconnect Storm
**What goes wrong:** every edit destroys active subscriptions/windows.  
**Avoid:** observable relay maps update operations that support them; one-shot/non-reactive work reads the next snapshot. Do not teardown solely for settings edits. [VERIFIED: locked D-13 + installed RelayPool declarations]

### Pitfall 4: Localhost SSRF Expansion
**What goes wrong:** user-configured URLs or BUD hints cause connections to unsafe schemes/hosts or a block is bypassed after normalization.  
**Avoid:** canonicalize once, allow only expected `ws/wss` or `http/https` schemes per role, compare the canonical URL to the block set, and never forward arbitrary browser-controlled hints. [ASSUMED]

### Pitfall 5: Catalog Lost Update
**What goes wrong:** two commands publish from stale projections, and latest timestamp wins unexpectedly.  
**Avoid:** serialize catalog commands per active account, re-read the current projection before signing, and document Phase 2's no-merge last-valid-event behavior. [VERIFIED: locked D-18]

### Pitfall 6: Drift Test Becomes a Build Blocker
**What goes wrong:** sibling revisions move and make normal checks fail.  
**Avoid:** authoritative pinned-contract tests remain blocking; sibling comparison always writes a report and exits successfully, including parse/read errors as report entries. [VERIFIED: locked D-22 through D-25]

## Code Examples

### Local Blossom Hinted URL

```ts
// Source: https://github.com/hzrd149/blossom/blob/master/implementations/local-blossom-cache.md
const url = new URL(`/${hash}`, "http://127.0.0.1:24242/");
for (const server of upstreamServers) url.searchParams.append("xs", server);
if (authorPubkey) url.searchParams.append("as", authorPubkey);
```

Probe `HEAD /` with an abort timeout. A 2xx means available; otherwise fetch upstream directly. A local 404 or fetch failure must also fall through upstream. All executable bytes still pass existing `resolveNapplet` signature/aggregate/blob checks. [CITED: https://github.com/hzrd149/blossom/blob/master/implementations/local-blossom-cache.md] [VERIFIED: runtime/artifacts.ts]

### Reactive Relay Inputs

```ts
// Source: installed applesauce-relay@6.2.1 RelayPool declarations
const allowedRelays$ = settings$.pipe(
  map((settings) => resolveAllowedRelays(settings, nip65State)),
  distinctUntilChanged(equalRelayMaps),
);
const events$ = pool.subscriptionMap(allowedRelays$);
```

### Catalog Event Shape

```ts
// Source: https://github.com/nostr-protocol/nips/blob/master/78.md
const template = {
  kind: 30078,
  tags: [["d", "org.napplet.portal:installed"]],
  content: JSON.stringify({
    version: 1,
    entries: [{ coordinate, acceptedManifestEventId }],
  }),
  created_at: Math.floor(Date.now() / 1000),
};
```

The chosen identifier and JSON schema are recommendations under agent discretion, not protocol requirements. [ASSUMED]

## State of the Art

| Old/Phase 1 Approach | Phase 2 Approach | Evidence | Impact |
|----------------------|------------------|----------|--------|
| In-memory query merged with live request | Bounded local-relay request then live upstream | Applesauce request/subscription APIs | Correct read-through order and offline cache use. |
| Startup-only endpoint arrays | Atomic persisted `settings$` | Existing store pattern + locked D-10 | Changes apply without restart. |
| One configured napplet | Signed NIP-78 installed catalog | NIP-78 + locked D-16 | Account-owned synchronized installations. |
| Fixed relay selection | NIP-65 plus defaults/block policy | NIP-65 + locked D-11/D-15 | Correct author/recipient routing. |
| Fixture-only contract proof | Layered pinned/sibling drift suite | Locked D-24/D-25 | Detects drift without destabilizing builds. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Use `org.napplet.portal:installed` and versioned public JSON for NIP-78. | Architecture / Code Examples | Identifier/schema change before release; costly only after publication. |
| A2 | URL allowlisting should reject unexpected schemes/private hosts except explicit loopback cache endpoints. | Pitfalls / Security | Overly strict policy could reject legitimate operator endpoints; overly weak policy enables SSRF. |
| A3 | A lightweight cache-health snapshot is sufficient (available/degraded, last success/error timestamp, sanitized reason). | Architecture | UI may need richer history, but no runtime redesign. |

## Open Questions

1. **Exact local relay request timeout**
   - Known: Applesauce accepts per-request milliseconds and Relay's documented default is 30 seconds for a request; local cache must not delay upstream materially. [VERIFIED: installed declarations]
   - Recommendation: start at 1,500 ms, make it a validated backend setting or constant, and test timeout/EOSE/error paths. [ASSUMED]
2. **Which Applesauce reactive NIP-65 helper to standardize on**
   - Known: core exposes mailbox helpers/factory and RelayPool accepts observable `FilterMap`/`OutboxMap`; Phase 1 already has an outbox adapter. [VERIFIED: installed declarations/codebase]
   - Recommendation: planner should schedule an API spike/test first, choosing official mailbox models over a portal-owned duplicate state machine.
3. **Drift report destination**
   - Recommendation: `.planning/phases/02-backend-runtime-expansion/02-CONTRACT-DRIFT.json` for phase evidence, plus a temp/runtime path for repeated local runs; never import it into production. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Deno | runtime/tests | ✓ | 2.9.4 | — |
| Node/npm | registry verification only | ✓ | Node 22.23.1 / npm 10.9.8 | Deno npm resolver for execution |
| Local Nostr relay | optional event cache | ✗ not detected | — | shared in-memory EventStore + upstream relays |
| Local Blossom cache | optional blob cache | runtime probe required | spec endpoint | direct upstream Blossom fetch |
| Sibling `../kehto` | drift fixtures | ✓ | git `3a4d71a…` | report unavailable reference, do not fail |
| Sibling `../napplet` | drift fixtures | ✓ | git `03ad65b…` | report unavailable reference, do not fail |

**Missing dependencies with no fallback:** none.  
**Missing dependencies with fallback:** local relay, local Blossom, and sibling sources are optional/degraded paths by locked design.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing backend account/signer; NIP-42 per-relay opt-in is separate |
| V3 Session Management | yes | Existing connection/window ownership and reconnect lifecycle |
| V4 Access Control | yes | Blocked-relay precedence, active-account catalog signing, backend-only settings mutation |
| V5 Input Validation | yes | Typed parsers for settings, URLs, NIP-78 content, wire messages |
| V6 Cryptography | yes | Applesauce/nostr-tools sign/verify and existing manifest/hash verification; never hand-roll |

### Known Threat Patterns for Deno/Nostr Runtime

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF through relay/Blossom URL | Spoofing / Information Disclosure | Scheme/URL normalization, block policy before connection, fixed loopback discovery endpoint |
| Iframe claims a different identity | Spoofing | Runtime-attested identity from accepted verified manifest only |
| Relay sends invalid/replayed/deleted event | Tampering | Signature verification and EventStore semantics before delivery |
| AUTH leaks signer authority to arbitrary relay | Elevation of Privilege | Per-relay opt-in, exact challenge/relay binding, block override |
| Public NIP-78 content exposes secrets | Information Disclosure | Catalog contains coordinate and accepted manifest ID only; no secrets/capability approvals |
| Cache outage stalls streams | Denial of Service | Short bounded timeout, `catchError` to upstream, non-blocking writes |
| Sensitive settings/account logging | Information Disclosure | Sanitized health reasons; never log payloads, secrets, or sensitive paths |

NIP-42 authentication is connection-scoped and does not imply authorization: a relay may still return `restricted`. AUTH events are ephemeral kind 22242 with exact relay and challenge tags. [CITED: https://github.com/nostr-protocol/nips/blob/master/42.md]

## Sources

### Primary (HIGH confidence)
- Installed `applesauce-core@6.2.0` and `applesauce-relay@6.2.1` type declarations — exact pinned runtime API.
- Project source/tests and pinned `deno.json` — existing seams and versions.
- `https://applesauce.build/introduction/getting-started.html` and `https://applesauce.build/typedoc/modules/applesauce-loaders.html` — EventStore, RelayPool, models, unified loader.
- `https://github.com/hzrd149/blossom/blob/master/implementations/local-blossom-cache.md` — loopback health and proxy flow.
- `https://github.com/nostr-protocol/nips/blob/master/42.md` — relay AUTH.
- `https://github.com/nostr-protocol/nips/blob/master/65.md` — relay-list routing.
- `https://github.com/nostr-protocol/nips/blob/master/78.md` — application data catalog event.
- Sibling Kehto/Napplet source at recorded revisions — reference-only contract comparison.

### Secondary (MEDIUM confidence)
- npm registry metadata and GSD legitimacy seam — current versions/dates/signals; legitimacy seam flags all audited packages SUS.

### Tertiary (LOW confidence)
- Assumptions A1–A3, explicitly requiring confirmation during planning/implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — exact pins, registry versions, installed declarations, and official docs checked.
- Architecture: HIGH — mostly locked decisions plus verified existing seams and exact APIs.
- Pitfalls: MEDIUM-HIGH — derived from API shapes and project behavior; timeout/URL policy values remain discretionary.
- Contract drift: HIGH — locked behavior and inspected sibling/pinned contract shapes.

**Research date:** 2026-07-30  
**Valid until:** 2026-08-06 (fast-moving packages and sibling repositories)
