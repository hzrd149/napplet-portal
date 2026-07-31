# Phase 6: Common Data and Durable Storage - Research

**Researched:** 2026-07-31
**Domain:** NAP-COMMON projections and isolated Deno-native NAP-STORAGE persistence
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Common helper semantics
- Use the pinned 0.31.0 contract codecs and canonical NIP-19 representations; reject ambiguous or unsupported forms at the boundary.
- Keep stateless encode/decode helpers synchronous internally while preserving correlated runtime envelopes.
- Serve profile/common lookups as partial, stale-capable, updating projections rather than finished requests.
- Reuse the process-owned EventStore and relay loader lifecycle instead of adding napplet-specific subscriptions.

### Storage identity and scopes
- Namespace every key by active account pubkey, exact accepted napplet manifest identity, and canonical scope.
- Support shared napplet scope and per-instance scope only where the pinned contract defines them; reject invented scopes.
- Bind instance identifiers to backend-issued launch/session identity so iframe input cannot escape its namespace.
- Sign-out/replacement revokes access without deleting durable values.

### Persistence and quotas
- Use one versioned, atomically replaced local snapshot or similarly simple Deno-native durable store consistent with existing settings/catalog persistence.
- Validate keys and structured-clone/JSON-compatible values before mutation, with byte-count, key-count, and per-value limits.
- Serialize mutations per namespace, re-read current state when needed, and make list ordering deterministic.
- Failed writes leave the prior durable snapshot intact and return stable quota/storage errors.

### Lifecycle and privacy
- Storage survives WebSocket reconnects and process restarts but never crosses account or verified napplet boundaries.
- Expose no filesystem paths, other namespaces, relay internals, or signer material through errors or list results.
- Cancel common-data streams and correlated work on connection expiry while retaining process-owned cached truth.
- Test restart recovery, concurrent mutation, malformed snapshots, quota edges, account switching, and manifest replacement.

### the agent's Discretion
Choose conservative default quotas, snapshot compaction details, and projection update cadence where contracts are silent, following existing immutable service and injected-dependency patterns.

### Deferred Ideas (OUT OF SCOPE)
Cross-device storage synchronization, arbitrary binary values, migrations across napplet identities, and user-facing storage management remain outside this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COM-01 | Napplet can use the pinned NAP-COMMON NIP-19 encode/decode and common Nostr helper actions. | Exact 0.31.0 unions, result envelopes, validation rules, signer/outbox integration, and dispatcher mapping are documented below. [VERIFIED: pinned package source and project code] |
| COM-02 | Napplet can load other users' profile and common Nostr data through Applesauce-backed, stream-oriented backend services. | Reuse `EventRuntime.eventStore`, Applesauce `profile`/`contacts` models, generation-bound relay loads, and projection lifecycle described below. [VERIFIED: pinned Applesauce source and project code] |
| STO-01 | Napplet can set, get, list, and remove scoped key-value data through the pinned NAP-STORAGE contract. | Exact string-only request/result types and error behavior are documented below. [VERIFIED: `@napplet/nap@0.31.0` types] |
| STO-02 | Runtime isolates storage by account and verified napplet identity, supports shared and per-instance scope where the contract requires it, and enforces quotas and deterministic serialization. | Namespace tuple, authority resolution, quota algorithm, sorted keys, and serialized mutation design are prescribed below. [VERIFIED: context and project code; quota values ASSUMED] |
| STO-03 | Napplet storage persists across browser reconnects and portal restarts without becoming shell configuration or browser-owned authority. | A process-owned, versioned, atomic snapshot service patterned after `SettingsStore`/`AccountStore` is specified below. [VERIFIED: project code] |
</phase_requirements>

## Summary

Phase 6 should add two backend services behind the existing iframe → shell → WebSocket → runtime boundary. `CommonService` should decode only the eight pinned `common.*` requests, use `nostr-tools` for synchronous public NIP-19 conversion, and use the existing process-owned Applesauce `EventStore`, relay policy, loader/request lifecycle, signer, and outbox for stateful profile/follows/mutation operations. `StorageService` should decode only the four pinned `storage.*` operations and persist string values in a closed, versioned snapshot keyed by active pubkey, exact accepted manifest identity, and canonical scope. [VERIFIED: pinned package source, CONTEXT.md, and project code]

The largest planning risk is not persistence but authority propagation. The current WebSocket session owns only `connectionId` and `windowId`; the iframe registry knows the verified `{dTag, aggregateHash}`, while `/api/runtime` accepts forwarded NAP messages without attaching that identity. Storage must not infer authority from a caller-supplied coordinate, label, scope identifier, or key. The launch path must register an immutable backend-side capability context before dispatch is enabled, and instance storage must derive its instance component from the backend-issued window/launch session. [VERIFIED: `components/NappletFrame.tsx`, `islands/NappletShell.tsx`, `routes/api/runtime.ts`, `runtime/connections.ts`]

The second risk is overpromising streaming at the NAP-COMMON wire seam. Version 0.31.0 defines one correlated `common.getProfile.result` and the shim resolves its Promise once; it defines no profile subscription/update envelope. Therefore keep the backend projection live and updating, return the current partial/stale snapshot on each correlated lookup, and let subsequent calls observe newer truth. Do not invent repeated result envelopes or a new subscription protocol in Phase 6. [VERIFIED: `@napplet/nap@0.31.0` common types/shim]

**Primary recommendation:** Implement contract decoders and immutable services first, then attach them through one authority-aware dispatcher whose per-window context is established from verified launch output and revoked on account/manifest/session changes. [VERIFIED: project patterns]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| NIP-19 validation/encode/decode | API / Backend | — | The shell owns NIP-19 handling and rejects secret/ambiguous forms before returning canonical contract results. [VERIFIED: pinned NAP docs/types] |
| Profile and follows projections | API / Backend | Relay / EventStore | The backend owns the shared loader and cached event truth; napplets receive sanitized projections only. [VERIFIED: project architecture and Applesauce source] |
| Follow/unfollow/react/report | API / Backend | Relay publishing / signer | Event construction, signing, consent, and publication never cross into the iframe. [VERIFIED: pinned NAP common documentation] |
| Storage operation dispatch | API / Backend | Database / Storage | Runtime validates the envelope and resolves authority before accessing persistence. [VERIFIED: CONTEXT.md] |
| Durable storage snapshot | Database / Storage | API / Backend | A host-only atomic document owns values; the service owns quotas, isolation, and errors. [VERIFIED: project persistence patterns] |
| Iframe capability exposure | Browser / Client | API / Backend | The bridge advertises and forwards only domains granted by verified manifest identity; backend independently rechecks authority. [VERIFIED: `NappletFrame.tsx` and artifact resolution] |

## Project Constraints (from AGENTS.md)

- Use Deno and Fresh; keep backend runtime logic out of islands. [VERIFIED: AGENTS.md]
- Use Applesauce packages for Nostr primitives/networking/storage workflows and follow RxJS composition: no nested subscriptions, no duplicate state machines, and no wait-for-all loading. [VERIFIED: AGENTS.md]
- Treat Nostr as partial, empty, stale, and updating stream state. [VERIFIED: AGENTS.md]
- Production imports remain pinned npm dependencies (`@napplet/core@0.31.0`, `@napplet/nap@0.31.0`); `../napplet` and `../kehto` are reference-only. [VERIFIED: AGENTS.md]
- Sandboxed iframes cross an explicit proxy/message boundary; persistent authority and complex Nostr work stay backend-owned. [VERIFIED: AGENTS.md]
- Use Deno formatting, two-space indentation, double quotes, explicit local extensions, Fresh `class`, existing relative-import style, direct module imports, and `deno task check`. [VERIFIED: AGENTS.md]
- Validate user input at the owning boundary, return explicit stable errors, and never log secrets, request bodies, paths, or stored values. [VERIFIED: AGENTS.md and existing persistence code]
- No project-specific skills are present. [VERIFIED: AGENTS.md and directory scan]

## Exact Pinned Contract Surface

### NAP-COMMON 0.31.0

| Request | Required input | Result shape / behavior |
|---------|----------------|-------------------------|
| `common.encodeNip19` | `id`, structured `input` | `common.encodeNip19.result` extends `{ok,value?,nip19Type?,error?}`. Supported types are exactly `npub`, `note`, `nprofile`, `nevent`, `naddr`, `nrelay`; `nsec` is intentionally unsupported. [VERIFIED: pinned core/common types and shim] |
| `common.decodeNip19` | `id`, `value` | Same supported public types; normalized fields are type-dependent (`hex`, `pubkey`, `eventId`, `identifier`, `relays`, `author`, `kind`, `relay`). [VERIFIED: pinned core/common types] |
| `common.getProfile` | `id`, string target | Target may be hex pubkey, `npub`, or `nprofile`; result is `{ok,pubkey,profile?,result?,error?}`. [VERIFIED: pinned core/common types] |
| `common.follows` | `id` | `{ok,pubkeys,error?}` with hex pubkeys. [VERIFIED: pinned core/common types] |
| `common.follow` / `common.unfollow` | `id`, `pubkeys` (documented as npub targets) | `{ok,eventId?,event?,error?}`. [VERIFIED: pinned common SDK/types] |
| `common.react` | `id`, hex `targetEventId`, reaction, optional emoji URL | Action result. `reaction` permits `+`, `-`, or any string, so runtime must impose safe length/emoji validation. [VERIFIED: pinned core/common types; limits ASSUMED] |
| `common.report` | `id`, event/pubkey target, seven named NIP-56 reasons, text | Action result; runtime must validate target shape and bound text. [VERIFIED: pinned core/common types; limits ASSUMED] |

All eight operations use a caller correlation `id`, and every result echoes it. Decode exact keys per operation, bound IDs consistently with existing transport (`1..128`), and return the corresponding result type rather than throwing through the WebSocket handler. [VERIFIED: pinned types and `runtime/transport.ts`; exact-key recommendation ASSUMED]

### NAP-STORAGE 0.31.0

| Request | Request fields | Result |
|---------|----------------|--------|
| `storage.get` | `id`, `key`, optional `scope` | `storage.get.result`: `id`, `value: string | null`, optional `error`. [VERIFIED: pinned storage types] |
| `storage.set` | `id`, `key`, `value: string`, optional `scope` | `storage.set.result`: `id`, optional `error`. [VERIFIED: pinned storage types] |
| `storage.remove` | `id`, `key`, optional `scope` | `storage.remove.result`: `id`, optional `error`. [VERIFIED: pinned storage types] |
| `storage.keys` | `id`, optional `scope` | `storage.keys.result`: `id`, `keys: string[]`, optional `error`. [VERIFIED: pinned storage types] |

`scope` is exactly `"shared" | "instance"`; omitted scope MUST mean shared. Values are strings, and null means a missing key. Although CONTEXT.md mentions structured-clone/JSON-compatible validation, the pinned 0.31.0 wire contract narrows this phase to strings; JSON objects are napplet-serialized strings, not backend structured values. [VERIFIED: pinned storage types/SDK]

The pinned shim documents a 512 KB per-napplet quota, but it does not define key length, per-value size, key count, byte accounting, whether instance scopes share the aggregate, or stable error vocabulary beyond an optional string. Use the conservative policy below and expose only stable public codes. [VERIFIED: pinned storage shim; policy ASSUMED]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@napplet/core` | 0.31.0, published 2026-07-28 | Canonical common result/value contracts and `NappletMessage` | Project-locked production contract. [VERIFIED: npm registry, lockfile, pinned package source] |
| `@napplet/nap` | 0.31.0, published 2026-07-28 | Exact COMMON/STORAGE request and result unions | Project-locked wire contract. [VERIFIED: npm registry, lockfile, pinned package source] |
| `applesauce-core` | 6.2.0, published 2026-06-26 | Shared `EventStore`, profile/contact models and helpers | Already process-owned and integrated. [VERIFIED: npm registry, pinned package source, project code] |
| `applesauce-loaders` | 6.2.0, published 2026-06-26 | Relay-to-store loading | Existing `EventRuntime` already creates the store-aware unified loader. [VERIFIED: npm registry and project code] |
| `nostr-tools` | 2.24.1 | NIP-19 codecs, event templates, verification primitives | Already pinned and used in first-party runtime code. [VERIFIED: `deno.json` and project code] |
| Deno filesystem APIs | 2.9.4 | Atomic temp-write/rename durable snapshot | Matches `AccountStore` and `SettingsStore`; no database server is warranted. [VERIFIED: local runtime and project code] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| RxJS | 7.8.2 (existing direct npm specifier) | Observable projection composition and teardown | Common projection and generation-bound loader ownership. [VERIFIED: project code and lockfile] |
| Existing signer/outbox ports | project modules | Construct/sign/publish social mutations | Follow, unfollow, reactions, reports; do not expose signer objects. [VERIFIED: project code] |
| `TextEncoder` | Deno/Web standard | UTF-8 quota measurement | Count actual stored snapshot/key/value bytes, not JS UTF-16 code units. [VERIFIED: Web/Deno platform API] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Versioned atomic JSON snapshot | Deno KV / SQLite | Better transactional scaling, but adds a second persistence model for a bounded MVP and contradicts the locked small/auditable direction. [VERIFIED: CONTEXT.md; tradeoff ASSUMED] |
| Existing EventStore models | Custom profile/contact maps | Custom maps duplicate replacement, update, and lifecycle semantics already owned by Applesauce. [VERIFIED: pinned Applesauce source] |
| `nostr-tools` NIP-19 | Hand-written bech32/TLV | Hand-written codecs add canonicalization and secret-form failure risks. [VERIFIED: existing dependency and pinned contract requirements] |

**Installation:** No new package installation is required. Use existing pinned import-map entries. [VERIFIED: `deno.json`]

## Package Legitimacy Audit

No external package is added by this phase. The required packages are already project-locked and installed. The gate nevertheless flags their current registry signals, so the plan must not perform opportunistic upgrades. [VERIFIED: `deno.json`, `deno.lock`, package-legitimacy seam]

| Package | Registry | Published | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----------|-----------|-------------|---------|-------------|
| `@napplet/core@0.31.0` | npm | 2026-07-28 | 1,352/wk | `github.com/sandwichfarm/napplet` | SUS (`too-new`) | Existing locked dependency; no install/upgrade |
| `@napplet/nap@0.31.0` | npm | 2026-07-28 | 1,503/wk | `github.com/sandwichfarm/napplet` | SUS (`too-new`) | Existing locked dependency; no install/upgrade |
| `applesauce-core@6.2.0` | npm | 2026-06-26 | 1,765/wk | registry metadata omitted repository | SUS (`no-repository`) | Existing locked dependency; no install/upgrade |
| `applesauce-loaders@6.2.0` | npm | 2026-06-26 | 1,064/wk | registry metadata omitted repository | SUS (`no-repository`) | Existing locked dependency; no install/upgrade |

All four report no `postinstall` script. [VERIFIED: npm registry]

**Packages removed due to SLOP verdict:** none.
**Packages flagged as suspicious [SUS]:** all four above by automated heuristics; because Phase 6 installs none and the versions are locked project inputs, no install checkpoint is needed unless the plan changes dependencies. [VERIFIED: package-legitimacy seam]

## Architecture Patterns

### System Architecture Diagram

```text
Sandboxed napplet
  | common.* / storage.* request (correlated id)
  v
NappletFrame allowlist + verified frame source
  | runtime.forward {connectionId, windowId, message}
  v
WebSocket endpoint decoder
  | lookup backend-owned WindowCapabilityContext
  |-- missing/revoked/wrong capability --> stable *.result error
  v
Runtime dispatcher
  |-- common.encode/decode --> synchronous validated nostr-tools codec --> result
  |-- common profile/follows --> CommonService
  |       |-- current EventStore projection --> partial/stale result
  |       `-- generation-bound relay load --> shared EventStore --> later projections
  |-- common mutations --> signer + outbox --> explicit action result
  `-- storage operations --> namespace resolver
          | account pubkey + accepted manifest identity + scope (+ backend instance id)
          v
      StorageService per-namespace mutation queue
          | validate -> copy -> quota -> versioned snapshot -> temp write -> rename
          `-- failure --> retain prior in-memory/durable state + stable error
```

### Recommended Project Structure

```text
runtime/
├── common.ts             # exact decoder, NIP-19 helpers, profile/follows/action service
├── common_projection.ts  # generation-bound EventStore/relay projection owner (if split helps tests)
├── storage.ts            # namespace/value policy and immutable service operations
├── storage_store.ts      # closed versioned snapshot codec + atomic persistence
├── nap_dispatcher.ts     # common/storage branch dispatch using resolved window authority
├── portal_runtime.ts     # inject process services and open authority-bound windows
└── transport.ts          # outer runtime.forward validation only
tests/
├── common_test.ts
├── common_projection_test.ts
├── storage_store_test.ts
├── storage_test.ts
└── common_storage_runtime_test.ts
```

File splits are recommendations, not contract requirements; preserve direct imports and immutable/injected-dependency patterns. [ASSUMED]

### Pattern 1: Authority Before Dispatch

**What:** Store a backend-owned `WindowCapabilityContext` containing active account pubkey, exact accepted `{coordinate, manifestEventId, dTag, aggregateHash}`, granted domains, and backend-issued instance id. Resolve it from `connectionId/windowId`; never accept those identity components inside COMMON/STORAGE messages. [VERIFIED: CONTEXT.md and verified artifact model]

**When to use:** Before every common operation requiring identity/signing and every storage operation. Recheck current active account and accepted manifest generation at dispatch time; stale contexts return a stable authorization failure. [VERIFIED: CONTEXT.md; exact code shape ASSUMED]

```ts
// Source: project ConnectionRegistry and Phase 6 locked authority decisions
interface WindowCapabilityContext {
  readonly accountPubkey: string;
  readonly coordinate: string;
  readonly manifestEventId: string;
  readonly dTag: string;
  readonly aggregateHash: string;
  readonly instanceId: string; // backend-issued, never read from iframe input
  readonly domains: ReadonlySet<string>;
}
```

Use the full exact accepted identity in the persisted namespace representation, not just `dTag`; two manifest replacements must not silently share data unless a future migration explicitly allows it. [VERIFIED: CONTEXT.md]

### Pattern 2: Copy-Validate-Persist-Commit

**What:** For each namespace mutation, serialize through a tail Promise, derive a new immutable snapshot from the latest committed state, validate all limits, atomically persist it, and only then replace the service's in-memory committed state. [VERIFIED: project store pattern; commit ordering recommendation ASSUMED]

**When to use:** `storage.set` and `storage.remove`. Reads may use the last committed immutable snapshot; mutation queue order must define deterministic last-writer-wins behavior. [ASSUMED]

```ts
// Source: runtime/settings_store.ts and runtime/account_store.ts pattern
const operation = this.#tails.get(namespaceKey)!.then(async () => {
  const next = withMutation(this.#snapshot, namespace, request);
  enforceQuota(next, namespace);
  await this.#store.write(next);
  this.#snapshot = next;
});
this.#tails.set(namespaceKey, operation.catch(() => undefined));
return operation;
```

For a single whole-file snapshot, independent per-namespace queues are insufficient by themselves because two queues can each rewrite the full document and lose the other's mutation. Use one global file-write serialization tail, or merge/re-read under a global commit section after the namespace-local ordering step. [VERIFIED: atomic snapshot mechanics; concurrency implication]

### Pattern 3: EventStore Is Truth, Projection Is a View

**What:** Subscribe to `eventStore.profile(pointer)` and `eventStore.contacts(pointer)` (or their model constructors), sanitize outputs into core contract shapes, and feed relay events into the same process-owned store. Applesauce models derive replacement updates from store truth. [VERIFIED: pinned Applesauce source]

**When to use:** Profile and follows lookups. Use relay hints from validated `nprofile` only after applying relay policy; fall back to configured lookup/read relays. [VERIFIED: core target shape and project relay policy; fallback ordering ASSUMED]

The current unified event loader loads IDs/addresses, not arbitrary kind-0 filters. Add a small method on `EventRuntime` that uses its existing policy-aware request seam for `kinds:[0], authors:[pubkey]` (and kind 3 for active-user follows) and adds emitted events to `eventStore`. Do not create a new `RelayPool` or EventStore. [VERIFIED: `runtime/event_runtime.ts` and Applesauce source]

### Pattern 4: Generation-Bound Correlated Work

**What:** Each open window owns cancellable common work. Connection detach within grace preserves the window; connection expiry invokes `bridge.close`, unsubscribes active projection/load work, and clears correlations. Account or accepted-manifest replacement increments a generation so late relay results cannot emit under old authority. [VERIFIED: existing `ConnectionRegistry`, `RuntimeServiceHub`, `CatalogSyncOwner`]

**When to use:** Profile relay loading and any future long-running common action. Stateless encode/decode may complete synchronously and be wrapped immediately in a result envelope. [VERIFIED: CONTEXT.md]

### Recommended Quota Policy

Use one 512 KiB aggregate budget for all namespaces belonging to an `(accountPubkey, exactManifestIdentity)` pair, including shared and all instance scopes; this prevents unlimited launches from multiplying quota. Limit each namespace to 256 keys, each UTF-8 key to 1 KiB, and each UTF-8 value to 64 KiB. Count serialized UTF-8 bytes of key and value plus a small fixed overhead, and reject the prospective state before writing. [ASSUMED]

The 512 KiB aggregate is grounded in the pinned shim's documented per-napplet quota; the subordinate limits and aggregation definition are conservative discretion choices. Define constants in one module and test boundary-minus-one, exact-boundary, and boundary-plus-one with multibyte UTF-8. [VERIFIED: pinned shim; subordinate values ASSUMED]

### Anti-Patterns to Avoid

- **Using `windowId` as the shared napplet identity:** reconnect-stable window ownership is not the exact accepted manifest identity and will fragment or leak shared storage. [VERIFIED: current connection and manifest models]
- **Caller-supplied instance id:** allows namespace selection attacks; derive it from the backend launch/window record. [VERIFIED: CONTEXT.md]
- **Per-iframe EventStore/RelayPool:** duplicates process state and leaves subscriptions alive after iframe changes. [VERIFIED: CONTEXT.md and `EventRuntime`]
- **Awaiting relay completion before returning any profile:** violates partial/stale projection semantics and can hang on open-ended relay streams. [VERIFIED: project constraints]
- **Repeated `common.getProfile.result` with the same id:** the pinned shim settles its Promise once and provides no update subscription. [VERIFIED: pinned shim]
- **Writing the live object before durable success:** failed rename would expose data that does not survive restart. [VERIFIED: atomicity requirement]
- **Per-namespace full-file writes without a global commit lock:** concurrent namespaces can overwrite each other's snapshots. [VERIFIED: snapshot concurrency mechanics]
- **Filesystem-derived namespace directories:** leaks identity in paths and complicates traversal safety; keep opaque tuple keys inside one closed document. [ASSUMED]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NIP-19 encoding/decoding | bech32/TLV codec | pinned `nostr-tools/nip19` exports with explicit allowlist | Canonical type/field semantics and secret-form rejection are subtle. [VERIFIED: pinned dependencies/source] |
| Profile parsing | direct unchecked `JSON.parse(event.content)` | Applesauce `getProfileContent` / `eventStore.profile` then sanitize | Handles invalid content and normalized fields. [VERIFIED: pinned Applesauce source] |
| Contact extraction | manual `p`-tag parsing | Applesauce contacts/public contacts helpers/model | Preserves established contact semantics and update behavior. [VERIFIED: pinned Applesauce source] |
| Replacement-event state | custom latest-event map | process `EventStore` replaceable models | Existing store owns replacement and subscriptions. [VERIFIED: project and Applesauce source] |
| Signing/publication | iframe keys or custom signer bridge | existing backend signer and outbox ports | Prevents authority crossing the sandbox boundary. [VERIFIED: project architecture] |
| Durable database | database server or browser storage | Deno temp-write + rename snapshot store | Existing audited local persistence pattern is adequate for bounded MVP. [VERIFIED: CONTEXT.md and project code] |

**Key insight:** The hard problems here are authority, replacement semantics, teardown, and atomic multi-namespace mutation—not JSON serialization. Reuse the owners that already solve those concerns. [VERIFIED: project code and context]

## Common Pitfalls

### Pitfall 1: Contract/Context Value-Type Mismatch

**What goes wrong:** Planner builds generic structured-clone storage because CONTEXT.md mentions structured-clone/JSON-compatible values. [VERIFIED: CONTEXT.md]
**Why it happens:** The exact 0.31.0 storage contract is narrower: `value: string`. [VERIFIED: pinned storage types]
**How to avoid:** Decode strings only. Applications may JSON-stringify structured data themselves. [VERIFIED: pinned SDK examples]
**Warning signs:** `unknown`, `JsonValue`, binary, or structuredClone appears in the service API. [ASSUMED]

### Pitfall 2: Authority Exists Only in the Browser

**What goes wrong:** Runtime dispatch knows a window but not which exact verified manifest owns it, making isolation unenforceable. [VERIFIED: current code]
**Why it happens:** `NappletFrame` holds verified identity while `runtime.forward` contains only connection/window/message. [VERIFIED: current code]
**How to avoid:** Add a backend launch-context registration/reconciliation seam and fail closed until it is established. [ASSUMED]
**Warning signs:** Storage namespace uses coordinate from `runtime.start`, `dTag` alone, title, iframe message fields, or current catalog selection. [VERIFIED: authority constraints]

### Pitfall 3: Mistaking a Promise Contract for a Push Stream

**What goes wrong:** Multiple profile results are emitted for one id but the napplet observes only the first. [VERIFIED: pinned shim]
**Why it happens:** Backend projection requirement is conflated with wire subscription semantics. [VERIFIED: contract comparison]
**How to avoid:** Keep the projection updating internally; answer each call from current truth and schedule/continue shared loading. [ASSUMED]
**Warning signs:** New message types or repeated `.result` envelopes not present in pinned unions. [VERIFIED: pinned types]

### Pitfall 4: Lost Updates Across Namespaces

**What goes wrong:** Account A/shared and Account B/shared mutate concurrently; both write snapshots based on the same old document and the later rename erases the first. [VERIFIED: concurrency mechanics]
**Why it happens:** Mutation serialization is scoped too narrowly while persistence is a single file. [VERIFIED: proposed storage model]
**How to avoid:** Namespace-local ordering plus a global serialized read/merge/write commit, or simply one global mutation tail for Phase 6. [ASSUMED]
**Warning signs:** A `Map<namespace, Promise>` directly calls whole-file `store.write` without a global merge barrier. [ASSUMED]

### Pitfall 5: Incorrect Byte Accounting

**What goes wrong:** Unicode values bypass quota or are rejected inconsistently because `.length` counts UTF-16 code units. [VERIFIED: JavaScript string semantics]
**Why it happens:** Quota is described in bytes but calculated in characters. [VERIFIED: contract documentation]
**How to avoid:** Use `TextEncoder`, define exactly what counts, and test ASCII, emoji, and combining characters. [VERIFIED: platform API; accounting definition ASSUMED]
**Warning signs:** quota expressions use only `key.length + value.length`. [VERIFIED: JavaScript semantics]

### Pitfall 6: Malformed Snapshot Recovery Becomes Data Loss

**What goes wrong:** Invalid JSON silently becomes an empty store and the next write destroys evidence/old data. [ASSUMED]
**Why it happens:** “Recovery” is implemented as reset rather than safe failure. [ASSUMED]
**How to avoid:** Treat missing as empty, reject malformed/unknown versions with a redacted stable read error, and refuse mutation until explicitly recovered; tests should verify no overwrite. This matches current stores. [VERIFIED: `AccountStore`, `SettingsStore`]
**Warning signs:** broad `catch { return EMPTY; }`. [ASSUMED]

### Pitfall 7: Sign-out Deletes or Still Authorizes

**What goes wrong:** Sign-out either erases durable data or lets a retained window continue accessing it. [VERIFIED: locked lifecycle decision]
**Why it happens:** Persistence lifetime and access lifetime are coupled. [ASSUMED]
**How to avoid:** Retain snapshot namespaces but make resolution require currently active matching pubkey and accepted manifest. [VERIFIED: CONTEXT.md]
**Warning signs:** sign-out calls storage delete, or storage receives a cached pubkey without current-identity recheck. [ASSUMED]

### Pitfall 8: Common Mutation Semantics Are Underplanned

**What goes wrong:** Encode/decode and profile ship, but follows/follow/unfollow/react/report are stubbed despite COM-01's “common helper actions.” [VERIFIED: requirements and pinned union]
**Why it happens:** Social mutations need event construction, current replaceable contacts, signing, and publication outcome policy. [VERIFIED: NAP common documentation and project ports]
**How to avoid:** Plan explicit sub-tasks/tests for all eight requests; reuse active contact truth and signer/outbox, preserve existing tags, and return `ok:false` on denial/publish failure. [VERIFIED: pinned result type; event specifics ASSUMED]
**Warning signs:** dispatcher switch covers fewer than eight common requests. [VERIFIED: pinned union]

## Code Examples

### Exact Storage Scope Canonicalization

```ts
// Source: @napplet/nap@0.31.0 dist/storage/types.d.ts
function storageScope(value: unknown): "shared" | "instance" | null {
  if (value === undefined || value === "shared") return "shared";
  if (value === "instance") return "instance";
  return null;
}
```

### Projection From the Shared EventStore

```ts
// Source: applesauce-core@6.2.0 EventModels interface
const subscription = eventRuntime.eventStore
  .profile({ pubkey, relays: relayHints })
  .subscribe((profile) => publishSanitizedProjection(pubkey, profile));

// Own `subscription` in the connection/window cleanup set. Relay loading adds
// kind-0 events to this same EventStore; do not mirror profile truth elsewhere.
```

### Canonical Result Envelope

```ts
// Source: @napplet/nap@0.31.0 common/types.d.ts and storage/types.d.ts
send({
  type: "storage.get.result",
  id: request.id,
  value: result.ok ? result.value : null,
  ...(result.ok ? {} : { error: result.error }),
});
```

The public error must be a stable, redacted string such as `invalid-request`, `not-authorized`, `quota-exceeded`, `storage-unavailable`, or `unsupported`; do not interpolate paths, namespaces, relays, or thrown exception text. [ASSUMED]

## Snapshot and Namespace Design

Recommended closed document: [ASSUMED]

```ts
interface NappletStorageSnapshot {
  readonly version: 1;
  readonly namespaces: Readonly<Record<string, Readonly<Record<string, string>>>>;
}
```

Generate the opaque namespace key from a collision-free serialized tuple, for example JSON serialization of `[accountPubkey, coordinate, manifestEventId, aggregateHash, scope, scope === "instance" ? instanceId : ""]`. Hashing that tuple is optional; a hash improves path/log opacity but the tuple remains necessary for collision-free identity semantics and tests. Store no filesystem path per namespace. [ASSUMED]

Canonicalize snapshot output by sorting namespace keys and each namespace's storage keys before `JSON.stringify`. `storage.keys.result` must return sorted keys regardless of insertion history or restart. Closed parsing must reject arrays, prototypes/non-string values, duplicate semantic namespace tuples, unknown top-level keys, and unknown versions. [ASSUMED]

On startup, read once into immutable committed state. Before each mutation, operate on the latest committed state under the global mutation tail. Atomic store flow should match existing code: create directory mode `0700`, write unique sibling temp mode `0600`, chmod where applicable, rename over destination, best-effort temp cleanup, redacted errors. [VERIFIED: `runtime/account_store.ts`, `runtime/settings_store.ts`]

## State of the Art

| Old/tempting approach | Current/required approach | When established | Impact |
|-----------------------|---------------------------|------------------|--------|
| Top-level storage only | Omitted/`shared` plus explicit `instance` scope | `@napplet/nap` 0.31.0 contract | Dispatcher must canonicalize omission to shared and bind instance server-side. [VERIFIED: pinned types/changelog] |
| One-shot “load everything” common calls | Shared updating EventStore projection with bounded/cancellable relay load | Existing project architecture | Cached partial truth remains useful while transport work is replaced/cancelled. [VERIFIED: project constraints] |
| Browser-local authority/storage | Backend-owned proxy and persistence | Locked Phase 6 scope | Reconnect/restart survival and account/manifest isolation become enforceable. [VERIFIED: requirements/context] |
| Arbitrary NIP-19 decode | Public six-type allowlist, excluding `nsec` | pinned 0.31.0 contract | Prevents secret material crossing the napplet seam. [VERIFIED: pinned shim/core types] |

**Deprecated/outdated:**
- Treating storage as only a shared per-napplet map is incomplete because 0.31.0 adds `instance` scope. [VERIFIED: pinned changelog/types]
- Assuming `common.getProfile` itself is a subscription is unsupported by the 0.31.0 envelope. [VERIFIED: pinned types/shim]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Use 512 KiB aggregate per account + exact manifest across all shared/instance scopes; 256 keys per namespace; 1 KiB keys; 64 KiB values. | Recommended Quota Policy | Changes compatibility/capacity; constants are easy to revise before release. |
| A2 | Use a global mutation commit tail around the single snapshot, with namespace-local semantics optional. | Architecture Pattern 2 | A different transactional store could safely relax global serialization. |
| R3 | RESOLVED: live backend projection plus repeated correlated lookups is the Phase 6 meaning of “updating”; no wire subscription exists or will be invented. | Summary / Pattern 3 / Resolved Questions | A later contract revision would be required for unsolicited iframe updates. |
| A4 | Recommended module/file split and stable public error vocabulary. | Project Structure / Code Examples | Planner may choose fewer files or different exact strings while preserving behavior. |
| R5 | RESOLVED: successful backend catalog launch registers account pubkey, coordinate, accepted manifest event id, dTag, aggregate hash, granted domains, and backend window id. | Authority / Snapshot / Resolved Questions | This matches the verified launch output and current backend window ownership seams. |
| A6 | Relay load methods for kind 0/3 are added to existing EventRuntime request seam. | Pattern 3 | Another existing loader API may offer equivalent integration, but must still reuse store/policy/pool. |

## Open Questions (RESOLVED)

1. **How does backend launch authority reach `/api/runtime`?**
   - What we know: verified identity is held by the browser frame registry and catalog artifact output; current runtime sessions contain only connection/window/source. [VERIFIED: project code]
   - **Resolution:** the successful backend `catalog.launch` branch is the sole authority-registration point. `RuntimeServiceHub.openWindow(...).catalogCommand(...)` receives the verified launch value directly from `CatalogService.launch`; before that value is returned to `/api/runtime`, it records an immutable window capability context containing the active account pubkey, exact coordinate, accepted manifest event id, verified `dTag`/aggregate hash, granted domains, and the already backend-issued window id as instance id. The route never reconstructs this tuple from the browser, and failed/stale launches register nothing. `runtime.start` remains tracer compatibility and must resolve its artifact through the same backend registration method before forwarding napplet messages. [VERIFIED: `runtime/catalog.ts`, `runtime/portal_runtime.ts`, `routes/api/runtime.ts`; composition choice RESOLVED]

2. **What does “updating” mean at the napplet wire surface?**
   - What we know: the pinned shim exposes Promise-returning `getProfile` and no common subscription envelope. [VERIFIED: pinned package]
   - **Resolution:** each correlated `common.getProfile` or `common.follows` call returns exactly one current partial/stale snapshot and schedules bounded relay work into the shared EventStore; a later correlated call reads the newer replacement truth. Phase 6 emits no unsolicited COMMON update and defines no new subscription or push envelope. [VERIFIED: pinned 0.31.0 Promise/result contract; semantics RESOLVED]

3. **Which exact event-building helpers govern follow/unfollow/react/report?**
   - What we know: the core result contract and backend signer/outbox seams are present; Applesauce exposes contact helpers. [VERIFIED: pinned/project source]
   - **Resolution:** `CommonService` builds unsigned templates only after current window/capability validation. Follow/unfollow re-read the active account's latest kind-3 event from the shared EventStore, preserve all non-target tags and content, and deterministically add/remove only requested `p` tags; react builds kind 7 with canonical `e`/`p` context available from the target and report builds kind 1984 with the validated NIP-56 reason tag. Production composition injects `PortalAccounts.signEvent` through the existing `OutboxAdapter`, whose RelayPolicy-filtered preset plus NIP-65 write set is the required relay set; success requires at least one required relay and acceptance from every selected relay, while signer absence/denial, signing failure, zero required relays, or any relay rejection returns a stable correlated failure and does not add the event to EventStore. No new consent UI is introduced: the verified COMMON capability plus active signer is the authorization boundary already locked for this phase. [VERIFIED: `runtime/accounts.ts`, `runtime/outbox.ts`, `runtime/catalog.ts`; policy RESOLVED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Deno | runtime, atomic store, tests | ✓ | 2.9.4 | none needed |
| npm registry metadata | pinned-version audit only | ✓ | npm 10.9.8 | lockfile/local package source |
| `@napplet/core` | contract | ✓ | 0.31.0 | none; locked |
| `@napplet/nap` | wire types | ✓ | 0.31.0 | none; locked |
| Applesauce core/loaders | common projections | ✓ | 6.2.0 | none; existing |
| Local filesystem | durable snapshot | ✓ through Deno permissions used by production `-A` | platform | fail closed with redacted storage error |

**Missing dependencies with no fallback:** none. [VERIFIED: environment probes and local modules]
**Missing dependencies with fallback:** Context7 CLI/MCP was unavailable; exact installed package types/source, lockfile, npm metadata, and reference-only sibling source were used. [VERIFIED: environment probe]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Require current active backend account before common identity actions or any storage namespace resolution. [VERIFIED: context] |
| V3 Session Management | yes | Backend-issued connection/window/instance identity, reconnect grace, expiry teardown, generation invalidation. [VERIFIED: project code/context] |
| V4 Access Control | yes | Exact account + accepted manifest + scope namespace; domain grant checked on every dispatch. [VERIFIED: context] |
| V5 Input Validation | yes | Exact discriminated-union decoder, bounded strings/arrays/URLs/hex/kinds, closed snapshot codec. [ASSUMED] |
| V6 Cryptography | yes | Existing `nostr-tools`, signer accounts, verified manifest identity; never hand-roll codecs/signatures/hashes. [VERIFIED: project stack] |
| V8 Data Protection | yes | Host-only mode `0600`, no secret/path/value logging, no cross-namespace listing. [VERIFIED: project store pattern/context] |
| V12 Files and Resources | yes | Fixed configured snapshot path, random sibling temp, no user-derived paths, atomic replacement. [VERIFIED: project store pattern] |
| V13 API and Web Service | yes | Same-origin WebSocket, owner-bound envelope, maximum message size, canonical correlated results. [VERIFIED: current runtime endpoint/transport] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Foreign iframe/window sends storage request | Spoofing / Information Disclosure | Preserve source/window ownership and resolve backend launch context before namespace access. [VERIFIED: current bridge and context] |
| Caller selects another account/manifest/instance | Elevation of Privilege | Identity components never appear in NAP request; server derives all namespace components. [VERIFIED: pinned storage request types/context] |
| Oversized keys/values or unlimited instance creation exhaust disk | Denial of Service | UTF-8 per-value/key/key-count plus aggregate per-manifest quota across instances. [ASSUMED] |
| Concurrent writes lose other namespaces | Tampering | Global serialized snapshot commit with copy-persist-commit ordering. [ASSUMED] |
| Error leaks path, stored value, signer, relay | Information Disclosure | Map all internal failures to stable redacted error strings; structured logs include only short opaque IDs. [VERIFIED: context/project conventions] |
| Late relay result crosses account/manifest replacement | Spoofing / Information Disclosure | Generation check and teardown; projection remains keyed to validated target/account. [VERIFIED: existing catalog pattern/context] |
| NIP-19 `nsec` decoded through generic codec | Information Disclosure | Explicit six-type public allowlist before projecting decoded fields. [VERIFIED: pinned contract] |
| Malformed snapshot causes silent reset/overwrite | Tampering | Closed version parser, fail closed, retain file, no automatic empty rewrite. [VERIFIED: existing store pattern] |

## Testing Strategy

Nyquist validation is explicitly disabled in `.planning/config.json`, so no formal Validation Architecture section is emitted. Phase planning should still use the existing Deno test runner (`deno task test`) and quality gate (`deno task check`). [VERIFIED: config and `deno.json`]

Prescriptive test groups: [ASSUMED]

1. Contract decoder table tests for every valid COMMON/STORAGE request, unknown/extraneous keys, bad correlation IDs, unsupported `nsec`, invalid hex/TLV/kind/relay/scope, large strings/arrays, and result correlation.
2. NIP-19 round-trips for all six supported representations plus canonical normalized decoded fields.
3. Common projection tests with injected relay Observable: cached partial result first, later kind-0 update in shared EventStore, stale/error state retaining last-good truth, account generation replacement, and cleanup on expiry.
4. Common action tests for signed templates/publish outcomes, not-signed-in, denial, invalid target/reaction/report, and no signer/event leakage.
5. Store codec tests: absent file, exact round-trip, mode, temp cleanup, unknown version, malformed JSON, extra fields, non-string values, and refusal to overwrite malformed state.
6. Storage service tests: shared default equivalence, instance isolation, account isolation, exact manifest replacement isolation, reconnect continuity, restart recovery, sign-out revocation without deletion, sorted keys, missing get/remove, all quota edges including Unicode.
7. Concurrency tests: same namespace set/set ordering, set/remove ordering, different namespaces concurrently without lost update, injected write failure leaves old in-memory and disk state, subsequent queue recovery.
8. End-to-end dispatcher test: only granted `common`/`storage` domains forward; backend context, not iframe fields, chooses namespace; expiry cancels common work but storage survives.

## Sources

### Primary (HIGH confidence)

- Installed `@napplet/core@0.31.0/dist/index.d.ts` — exact COMMON input/result contracts. [VERIFIED: pinned package source]
- Installed `@napplet/nap@0.31.0/dist/common/{types,shim,sdk}.d.ts` — exact envelopes and Promise behavior. [VERIFIED: pinned package source]
- Installed `@napplet/nap@0.31.0/dist/storage/{types,shim,sdk}.d.ts` — string-only values, shared/instance scopes, result errors, 512 KB documentation. [VERIFIED: pinned package source]
- Installed `applesauce-core@6.2.0` EventStore/model/helper source — profile/contact projection semantics. [VERIFIED: pinned package source]
- Installed `applesauce-loaders@6.2.0` types and `runtime/event_runtime.ts` — existing shared loader/request lifecycle. [VERIFIED: pinned package and project source]
- `runtime/account_store.ts`, `runtime/settings_store.ts` — current atomic snapshot, redaction, permission, and queue pattern. [VERIFIED: project code]
- `components/NappletFrame.tsx`, `islands/NappletShell.tsx`, `routes/api/runtime.ts`, `runtime/{portal_runtime,connections,transport}.ts` — current iframe, WebSocket, owner, dispatcher, and teardown seams. [VERIFIED: project code]
- `.planning/phases/06-common-data-and-durable-storage/06-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `AGENTS.md` — locked scope and constraints. [VERIFIED: project planning]
- npm registry metadata and GSD package-legitimacy seam — package publication and risk signals. [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)

- Reference-only sibling `../napplet` source/changelog/docs were checked for contract history and examples, then cross-checked against the installed pinned package. They are not production dependency sources. [VERIFIED: local reference source and installed package]

### Tertiary (LOW confidence)

- No web-only factual sources were used. Discretionary architecture choices are explicitly tagged `[ASSUMED]` and listed in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — exact versions are pinned, installed, registry-checked, and already integrated.
- Architecture: HIGH — authority, persistence, and lifecycle recommendations derive from locked decisions and concrete existing seams; file split/quota details remain assumptions.
- Contract semantics: HIGH — read directly from installed 0.31.0 declarations and shim behavior.
- Pitfalls: HIGH — most are direct mismatches or concurrency/security consequences visible in source; discretionary thresholds are MEDIUM/LOW and tagged.

**Research date:** 2026-07-31
**Valid until:** 2026-08-07 (contracts are newly published and the runtime is actively evolving)
