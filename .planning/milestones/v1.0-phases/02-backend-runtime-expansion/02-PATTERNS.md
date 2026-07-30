# Phase 2: Backend Runtime Expansion - Pattern Map

**Mapped:** 2026-07-30
**Files analyzed:** 15 new files, plus integration modifications
**Analogs found:** 13 / 15

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `runtime/settings_store.ts` | store | file-I/O | `runtime/account_store.ts` | exact |
| `runtime/settings.ts` | service/provider | event-driven | `runtime/accounts.ts` | exact |
| `runtime/relay_policy.ts` | utility/service | transform | `runtime/outbox.ts` | role-match |
| `runtime/event_runtime.ts` | provider/service | streaming | `runtime/portal_runtime.ts` | exact |
| `runtime/relay_cache.ts` | service | streaming | `runtime/relay_adapter.ts` | exact |
| `runtime/blossom_cache.ts` | service | request-response | `runtime/artifacts.ts` | exact |
| `runtime/catalog.ts` | model/service | streaming + CRUD | `runtime/outbox.ts`, `runtime/accounts.ts` | role-match |
| `runtime/contract_report.ts` | utility | batch + file-I/O | none | none |
| `routes/settings.tsx` | route/component | request-response | `routes/signin.tsx`, `routes/api/signin/nsec.ts` | role-match |
| `tests/settings_test.ts` | test | file-I/O + event-driven | `tests/account_store_test.ts` | exact |
| `tests/relay_cache_test.ts` | test | streaming | `tests/relay_stream_test.ts` | exact |
| `tests/blossom_cache_test.ts` | test | request-response | `tests/artifact_resolver_test.ts` | exact |
| `tests/relay_policy_test.ts` | test | transform | `tests/relay_stream_test.ts` | role-match |
| `tests/catalog_test.ts` | test | streaming + CRUD | `tests/relay_stream_test.ts` | role-match |
| `tests/contract_drift_test.ts` | test | batch + file-I/O | `tests/runtime_contract_test.ts` | role-match |

Expected integration modifications: `runtime/portal_runtime.ts`, `runtime/relay_adapter.ts`, `runtime/artifacts.ts`, `runtime/outbox.ts`, `main.ts`, `utils.ts`, `components/HomeView.tsx`, `components/NappletFrame.tsx`, `islands/NappletShell.tsx`, `deno.json`, and `.planning/phases/02-backend-runtime-expansion/02-CONTRACT-DRIFT.json`. Extend these seams; do not create a parallel runtime or move backend authority into an island.

## Pattern Assignments

### `runtime/settings_store.ts` (store, file-I/O)

**Analog:** `runtime/account_store.ts`

Copy the versioned defensive parser (`lines 9-34`), serialized write queue (`lines 36-42, 71-82`), and temp-file/rename transaction (`lines 85-113`). Adapt the schema and error text; do not expose paths or persisted values.

```ts
export class AccountStore {
  readonly #path: string;
  #writeQueue: Promise<void> = Promise.resolve();

  write(snapshot: AccountSnapshot): Promise<void> {
    const serialized = JSON.stringify(snapshot);
    const operation = this.#writeQueue.then(() =>
      this.#writeAtomically(serialized)
    );
    this.#writeQueue = operation.catch(() => undefined);
    return operation;
  }
}
```

Atomic write/error pattern (`runtime/account_store.ts:92-113`):

```ts
const temporary = `${directory}/.${name}.${crypto.randomUUID()}.tmp`;
await Deno.mkdir(directory, { recursive: true, mode: 0o700 });
try {
  await Deno.writeTextFile(temporary, serialized, { create: true, mode: 0o600 });
  await Deno.rename(temporary, this.#path);
} catch {
  try { await Deno.remove(temporary); } catch { /* best effort */ }
  throw new Error("Account snapshot could not be written");
}
```

### `runtime/settings.ts` (service/provider, event-driven)

**Analog:** `runtime/accounts.ts`

Copy the process-owned `BehaviorSubject`, read-only snapshot getter, startup restoration, and update-after-authoritative-change pattern (`lines 1-13, 67-94, 100-124`). Settings must expose one `settings$` and `.settings`/`.value` snapshot rather than copied arrays.

```ts
readonly identity$ = new BehaviorSubject<IdentitySnapshot>(UNAVAILABLE);

get identity(): IdentitySnapshot {
  return this.identity$.value;
}

async restore(): Promise<IdentitySnapshot> {
  const snapshot = await this.#store.read();
  if (!snapshot) return this.identity;
  // validate, then publish one authoritative snapshot
  return this.identity;
}
```

### `runtime/relay_policy.ts` (utility/service, transform)

**Analog:** `runtime/outbox.ts`

Copy option injection and relay-set derivation (`lines 61-79, 222-230`), but apply the blocked-relay filter before any `pool.relay`, subscription, publish, or AUTH call. Extend the current preset + NIP-65 union with lookup/indexer defaults, direction-aware NIP-65 results, explicit AUTH opt-in, normalization, and block precedence.

```ts
#relays(): readonly string[] {
  const pubkey = this.#options.identity().pubkey;
  return [
    ...new Set([
      ...this.#options.presetRelays,
      ...(pubkey ? this.#options.nip65Relays(pubkey) : []),
    ]),
  ];
}
```

### `runtime/event_runtime.ts` (provider/service, streaming)

**Analog:** `runtime/portal_runtime.ts`

Use the existing composition root’s dependency-injection and owned teardown style. It must own one process-wide `EventStore`, `RelayPool`, loader/policy/cache collaborators, and explicit `destroy()` lifecycle. Feed the existing `BackendRelayAdapter`; do not instantiate a second store or pool per browser connection.

Also copy terminal resource cleanup from `runtime/relay_adapter.ts:280-287`:

```ts
destroy(): void {
  for (const [key, subscription] of this.#subscriptions) {
    this.#subscriptions.delete(key);
    subscription.unsubscribe();
  }
}
```

### `runtime/relay_cache.ts` (service, streaming)

**Analog:** `runtime/relay_adapter.ts`

Copy typed pool/store ports (`lines 24-43`), subscription ownership (`lines 68-105`), event provenance insertion (`lines 107-114`), dedupe/EOSE delivery (`lines 116-149`), and `finalize` cleanup (`lines 116-118`). Replace the Phase 1 `merge(cached$, live$)` with the locked sequential `concat(localRequest$, upstream$)` behavior. Cache request timeout/error must complete to `EMPTY`; upstream errors remain upstream errors. Cache publish is observed but never awaited before delivery.

```ts
const cached$ = from(this.#store.query(message.filters)).pipe(
  map((event): RawRelayItem => ({ type: "EVENT", event, from: "" })),
);
const live$ = this.#pool.req([message.relay], message.filters).pipe(
  tap((item) => {
    if (item.type === "EVENT") this.#store.add(item.event, item.from);
  }),
);
```

Preserve per-owner close semantics (`runtime/relay_adapter.ts:156-179`) so closing one browser subscription cannot affect another.

### `runtime/blossom_cache.ts` (service, request-response)

**Analog:** `runtime/artifacts.ts`

Copy injected fetch dependencies and ordered source fallback from `PortalArtifactResolver`, while keeping the verified resolver as the final consumer. Probe only the fixed loopback `http://127.0.0.1:24242/` with bounded `HEAD`; on non-2xx, timeout, 404, or fetch error continue to upstream. Construct BUD-10 `xs`/`as` query parameters with `URL`/`searchParams`, never string concatenation.

The immutable integrity boundary is represented by `runtime/artifacts.ts:13-33`: failures are typed and executable HTML is never returned.

```ts
export class ArtifactResolutionError extends Error {
  readonly executableHtml = undefined;
  constructor(readonly code: ArtifactResolutionErrorCode, message: string) {
    super(message);
    this.name = "ArtifactResolutionError";
  }
}
```

### `runtime/catalog.ts` (model/service, streaming + CRUD)

**Analogs:** `runtime/accounts.ts`, `runtime/outbox.ts`

Use `PortalAccounts.identity$` (`runtime/accounts.ts:67-94`) as the account-change trigger and `signEvent` authority (`lines 181-187`). Copy outbox sign-then-publish settlement (`runtime/outbox.ts:153-211`), including typed success/failure results and per-relay caught outcomes.

```ts
event = await this.#options.signEvent(template);
const outcomes = await Promise.all(
  this.#relays().map(async (relay) => {
    try {
      return { relay, accepted: await this.#options.pool.publish(relay, event) };
    } catch {
      return { relay, accepted: false };
    }
  }),
);
```

New protocol-specific code must defensively accept only kind `30078`, the active account pubkey, exact `d` tag, versioned JSON, valid NIP-5A coordinates, and 64-hex accepted manifest IDs. Mutations derive a replacement event from the latest projected catalog. Display/version/capability data comes only from the accepted, integrity-verified manifest.

### `runtime/contract_report.ts` (utility, batch + file-I/O)

**Analog:** none. Use RESEARCH.md’s structured report contract. Keep sibling reads diagnostic-only and catch missing/changed sibling inputs into report entries. Output must name affected contracts, exact pinned package versions, sibling revisions/availability, and adapter coverage; report generation must not be imported by production runtime or fail the normal check/release path.

### `routes/settings.tsx` (route/component, request-response)

**Analogs:** `routes/signin.tsx`, `routes/api/signin/nsec.ts`

Copy the server-rendered page wrapper and `Head` metadata (`routes/signin.tsx:1-15`). Use `define.handlers` and explicit POST validation like `routes/api/signin/nsec.ts:8-25`; consume backend settings from `ctx.state` and persist through the settings service. Return explicit 400 responses for invalid relay/Blossom inputs. The browser submits settings; it does not own routing state.

```tsx
export const handler = define.handlers({
  async POST(ctx) {
    try {
      const body = await readJsonObject(ctx.req);
      // validate before service mutation
      return json({ status: "ok" });
    } catch (error) {
      return json({
        status: "error",
        message: error instanceof Error ? error.message : "settings update failed",
      }, { status: 400 });
    }
  },
});
```

### Test files

**`tests/settings_test.ts` analog:** `tests/account_store_test.ts:48-125`. Use a temp directory with `try/finally`, assert atomic round-trip, last queued write wins, no temp sibling, defaults on absence, corrupt/version-invalid rejection, validation, and reactive emission without restart.

**`tests/relay_cache_test.ts` analog:** `tests/relay_stream_test.ts:14-135`. Drive deterministic `Subject<RawRelayItem>` sources and record store/publish/listener calls. Assert local EOSE precedes upstream subscription, timeout/error falls through, upstream event delivery precedes cache acknowledgement, provenance is stored, duplicates collapse, EOSE is singular, and owner close is isolated.

**`tests/blossom_cache_test.ts` analog:** `tests/artifact_resolver_test.ts:28-121`. Inject `fetch`, record requested URLs, and assert fixed loopback HEAD discovery, repeated `xs` plus optional `as`, local hit, 404/error/timeout upstream fallback, and unchanged signature/hash fail-closed behavior.

**`tests/relay_policy_test.ts` analog:** `tests/relay_stream_test.ts`. Use fake pool calls to prove blocked URLs never reach connection, subscription, publish, or AUTH creation; then cover normalized dedupe, NIP-65/default/fallback precedence, and opt-in AUTH independent of login.

**`tests/catalog_test.ts` analog:** `tests/relay_stream_test.ts` plus `runtime/outbox.ts:153-211`. Use a subject-backed projection and injected signer/publisher. Cover defensive decoding, replacement winner, install/update/uninstall templates, active-account isolation, signer failure, partial relay failure, accepted manifest pinning, and rejection of iframe identity claims.

**`tests/contract_drift_test.ts` analog:** `tests/runtime_contract_test.ts:14-64`. Import authoritative pinned package types, round-trip serialized fixtures, and retain ownership/correlation assertions. Add handshake, stream, EOSE, close, and typed-error lifecycle cases. Sibling mismatch/unavailability is written into a structured report and never throws solely because drift exists.

## Shared Patterns

### Imports and module boundaries

Use explicit `.ts`/`.tsx` extensions for local imports, direct implementation imports (no barrels), double quotes, and pinned package aliases from `deno.json`. Production code must never import `../kehto` or `../napplet`; those paths are drift-test inputs only.

### Backend-owned reactive state

**Source:** `runtime/accounts.ts:67-94`  
**Apply to:** settings, event runtime, relay policy, and catalog.

Expose a `BehaviorSubject` observable plus synchronous snapshot getter. Derive consumers with RxJS operators; do not mirror settings, NIP-65 state, or catalog state in islands.

### Validation and redacted errors

**Sources:** `runtime/account_store.ts:15-34, 44-68`; `routes/api/signin/nsec.ts:8-25`  
**Apply to:** persisted settings/catalog parsing, route POST handling, and drift inputs.

Validate unknown decoded values field-by-field. Use stable errors that do not embed persisted content, secrets, full filesystem paths, or arbitrary upstream bodies.

### Stream ownership and teardown

**Source:** `runtime/relay_adapter.ts:68-105, 116-179, 280-287`  
**Apply to:** relay cache, event runtime, catalog subscriptions.

Key subscriptions by connection/window/subscription where browser-owned. Register a pending placeholder before subscribing to synchronous observables, use `finalize`, make close idempotent, and explicitly tear down process-owned streams.

### Publishing and failure isolation

**Source:** `runtime/outbox.ts:153-211`  
**Apply to:** local cache write-through and catalog publication.

Catch per-relay failures into outcomes. Catalog commands may report failure; optional cache writes update sanitized health and never gate event delivery.

### Verification

Follow the existing dependency-injected Deno tests with local `assert` helpers. Relevant gates are `deno task test` and `deno task check`; keep the supplied-napplet end-to-end flow as smoke coverage.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `runtime/contract_report.ts` | utility | batch + file-I/O | No first-party structured, non-blocking drift reporter exists. |
| `.planning/phases/02-backend-runtime-expansion/02-CONTRACT-DRIFT.json` | evidence artifact | batch | New generated evidence format; define from D-25 and RESEARCH.md. |

The local-first `Relay.request(..., { timeout })` sequence, fixed-loopback Blossom proxy hints, NIP-42 AUTH policy, and NIP-78 codec are also new protocol behavior. Their surrounding lifecycle/error/injection patterns have analogs above, but their exact implementation must follow RESEARCH.md and installed Applesauce declarations rather than Phase 1’s `merge` behavior.

## Metadata

**Analog search scope:** `runtime/`, `routes/`, `components/`, `islands/`, `tests/`, root composition/config files  
**Files scanned:** 49 first-party source/test files; 9 analog files read in detail  
**Strong analogs retained:** 5 pattern families (`account_store`, `accounts`, `relay_adapter`/`outbox`, `artifacts`, Fresh routes/tests)  
**Pattern extraction date:** 2026-07-30
