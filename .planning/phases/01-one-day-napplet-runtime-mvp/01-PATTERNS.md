# Phase 01: One-Day Napplet Runtime MVP - Pattern Map

**Mapped:** 2026-07-30
**Files analyzed:** 27 new/modified files
**Analogs found:** 25 / 27

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `deno.json` | config | startup/batch | existing `deno.json` | exact |
| `main.ts` | config/composition root | request-response | existing `main.ts` | exact |
| `utils.ts` | utility/types | request-response | existing `utils.ts` | exact |
| `runtime/config.ts` | config | transform | no close source analog | no analog |
| `runtime/portal_runtime.ts` | service/provider | event-driven | `../hyprgate-gui/apps/shell/src/lib/kehto/bootstrap.ts` | role-match |
| `runtime/accounts.ts` | service/store | event-driven | Applesauce account API pattern in `01-RESEARCH.md` | partial |
| `runtime/account_store.ts` | store | file-I/O | no close source analog | no analog |
| `runtime/artifacts.ts` | service | file-I/O/transform | `../kehto/packages/nip/src/5d/index.ts` | exact |
| `runtime/relay_adapter.ts` | service | streaming/pub-sub | `../hyprgate-gui/apps/shell/src/lib/relay/relay-req-stream.ts` + `relay-event-store.ts` | exact |
| `runtime/outbox.ts` | service | streaming/pub-sub | `../hyprgate-gui/apps/shell/src/lib/kehto/outbox-router.ts` | exact |
| `runtime/connections.ts` | provider/store | event-driven | `../hyprgate-gui/apps/shell/src/lib/relay/relay-pool-service.ts` | role-match |
| `runtime/transport.ts` | utility | request-response/pub-sub | `../kehto/packages/runtime/src/relay-handler.ts` | flow-match |
| `routes/api/runtime.ts` | route | request-response/streaming | existing `routes/api/[name].tsx` + Fresh `App.ws` research example | role-match |
| `routes/index.tsx` | route/component | request-response | existing `routes/index.tsx` | exact |
| `routes/_app.tsx` | component | request-response | existing `routes/_app.tsx` | exact |
| `islands/NappletShell.tsx` | component/controller | event-driven/streaming | existing `islands/Counter.tsx` + Hyprgate `NappletFrame.svelte` | role-match |
| `components/HomeView.tsx` | component | transform | existing `components/Button.tsx` | role-match |
| `components/ProfileView.tsx` | component | transform | existing `components/Button.tsx` | role-match |
| `components/NappletFrame.tsx` | component | event-driven | `../hyprgate-gui/apps/shell/src/components/NappletFrame.svelte` | exact |
| `assets/styles.css` | config/style | transform | existing `assets/styles.css` | exact |
| `tests/runtime_contract_test.ts` | test | request-response | `../kehto/packages/runtime/src/dispatch.test.ts` | role-match |
| `tests/account_store_test.ts` | test | file-I/O | Deno built-in test conventions; no project analog | partial |
| `tests/accounts_test.ts` | test | event-driven | Hyprgate auth tests adjacent to `auth-actions.ts` | role-match |
| `tests/artifact_resolver_test.ts` | test | file-I/O/transform | Kehto NIP-5D tests adjacent to `packages/nip/src/5d/index.ts` | exact |
| `tests/relay_stream_test.ts` | test | streaming | Hyprgate `relay-event-store.test.ts` / `relay-req-stream.test.ts` | exact |
| `tests/websocket_session_test.ts` | test | streaming/event-driven | Kehto runtime dispatch tests | flow-match |
| `README.md` | documentation | batch | existing `README.md` | role-match |

## Pattern Assignments

### `main.ts`, `utils.ts`, `routes/api/runtime.ts` (Fresh server boundaries)

**Analogs:** `main.ts`, `utils.ts`, `routes/api/[name].tsx`

Use `main.ts` only as the process composition root. Preserve the typed state/helper seam and file-system route registration; remove starter middleware and the programmatic demo API.

**Composition/import pattern** (`main.ts:1-6`, `main.ts:29-30`):

```ts
import { App, staticFiles } from "fresh";
import { define, type State } from "./utils.ts";

export const app = new App<State>();
app.use(staticFiles());
app.fsRoutes();
```

**Typed shared-state pattern** (`utils.ts:1-9`):

```ts
import { createDefine } from "fresh";

export interface State {
  shared: string;
}

export const define = createDefine<State>();
```

Replace `shared` with only request-visible runtime references/snapshots that are safe for routes. The WebSocket route should validate the upgrade/request first, then delegate to the singleton runtime; do not construct a pool, store, signer, or Kehto runtime per request.

### `runtime/portal_runtime.ts` (process-wide provider, event-driven)

**Analog:** `../hyprgate-gui/apps/shell/src/lib/kehto/bootstrap.ts`

**Construction and service registration** (`bootstrap.ts:372-411`):

```ts
if (_bridge !== null) {
  throw new Error("install called twice without cleanup");
}
const bridge = createShellBridge(adapter);
const registerRuntimeService = (name: string, handler: ServiceHandler): void => {
  bridge.runtime.registerService(name, handler);
};
```

Adapt this to a Deno backend singleton using `createRuntime()`, registering only identity and outbox plus the relay adapter. The portal runtime owns the one account manager, `RelayPool`, `EventStore`, artifact cache, and connection registry. It exposes narrow connection/command methods to the route.

**Ordered, idempotent teardown** (`bootstrap.ts:1108-1137`):

```ts
for (const { name, handler } of [...registeredServices].reverse()) {
  runtime.unregisterService(name);
  handler.destroy();
}
relayPoolAdapter.destroy();
bridge.destroy();
```

Destroy connection/window subscriptions first, services in reverse order next, and the runtime/pool last. Catch only during best-effort shutdown, with sanitized warnings.

### `runtime/connections.ts` (connection/window/subscription registry)

**Analog:** `../hyprgate-gui/apps/shell/src/lib/relay/relay-pool-service.ts`

**Ownership key and cleanup pattern** (`relay-pool-service.ts:20-28`, `69-105`):

```ts
let relayPoolInstance: RelayPool | null = null;
const relaySubscriptions = new Map<string, () => void>();

export function trackSubscription(subKey: string, unsubscribe: () => void): void {
  relaySubscriptions.set(subKey, unsubscribe);
}

export function cleanupRelaySubscriptions(windowId: string): void {
  const prefix = `${windowId}:`;
  for (const [key, unsubscribe] of relaySubscriptions) {
    if (key.startsWith(prefix)) {
      unsubscribe();
      relaySubscriptions.delete(key);
    }
  }
}
```

Extend the key to `${connectionId}:${windowId}:${subId}`. On close, delete registry ownership before unsubscribe so late emissions cannot pass the ownership check. On socket loss, retain the connection record behind a configurable grace timer; reconnect cancels that timer and reattaches the same namespace. Grace expiry calls `runtime.destroyWindow` only for that connection's windows.

### `runtime/relay_adapter.ts` (Applesauce streaming adapter)

**Analogs:** Hyprgate `relay-req-stream.ts`, `relay-event-store.ts`, `relay-pool-adapter.ts`

**Raw message stream and non-terminal EOSE** (`relay-req-stream.ts:50-71`):

```ts
const messages = pool.req(relays, filters).pipe(share());
const events = messages.pipe(
  filter((msg) => msg.type === "EVENT"),
  map((msg) => msg.event),
);
const eose = messages.pipe(
  completeCondition,
  filter(Boolean),
  take(1),
  map(() => "EOSE" as const),
);
return merge(events, eose);
```

Do not copy Hyprgate's event-only mapping verbatim where provenance is required. Retain each `EVENT` message's `from`, call `eventStore.add(message.event, message.from)`, and produce `relayHints: [message.from]`. EOSE is emitted once after the selected group completion condition and the live tail remains subscribed.

**Store-first/live merge and centralized dedup** (`relay-event-store.ts:257-280`):

```ts
const subscription = new Subscription();
const deliverEvent = makeEventDeduper((event) => callback(event));
subscribeCacheArms(relays, filters, cacheFilters, deliverEvent, subscription);
const relaySub = reqRelayStream(pool, relays, filters)
  .pipe(tapRelayItemsToStore())
  .subscribe({ next: (item) => item === "EOSE" ? callback(item) : deliverEvent(item) });
subscription.add(relaySub);
return subscription;
```

Use one composed observable per logical subscription, `finalize` for release, and no nested `subscribe`. Cache/store events flow before/alongside live messages and dedup at the `EventStore` seam.

**Adapter cleanup** (`relay-pool-adapter.ts:217-289`):

```ts
const ownedCleanups = new Set<() => void>();
return {
  subscribe(filters, callback, relayUrls) {
    if (destroyed) return { unsubscribe() {} };
    return openPoolSubscription(filters, callback, relayUrls, ownedCleanups);
  },
  destroy() {
    if (destroyed) return;
    destroyed = true;
    for (const cleanup of ownedCleanups) cleanup();
    ownedCleanups.clear();
  },
};
```

### `runtime/outbox.ts` (Kehto outbox composition)

**Analog:** `../hyprgate-gui/apps/shell/src/lib/kehto/outbox-router.ts`

**Router composition** (`outbox-router.ts:548-599`):

```ts
const stock = createRelayPoolOutboxRouter({
  relayPool: options.relayPool,
  loadRelayLists: options.loadRelayLists,
  fallbackRelays: options.fallbackRelays,
  signEvent: options.signEvent,
});

return {
  query: (filters, options) => stock.query(filters, options),
  publish: (template, options) => publishWithExplicitFanout(options, template, options),
  resolveRelays: stock.resolveRelays,
  subscribe(filters, options, sink) { /* live subscription */ },
};
```

For Phase 1 prefer the stock `createRelayPoolOutboxRouter()` contract with injected Applesauce relay pool, NIP-65 loader, preset fallbacks, and active-account signer. Preserve Kehto's no-EOSE OUTBOX lifecycle. Await required publish fanout settlement and return canonical per-relay outcomes.

### `runtime/artifacts.ts` (verified artifact adapter)

**Analog:** `../kehto/packages/nip/src/5d/index.ts`

**Verification/cache seam** (`index.ts:364-412`):

```ts
export async function resolveNapplet(options: ResolveNappletOptions): Promise<ResolvedNapplet> {
  const { event, fetchBlob: fetchBlobBytes, textDecode = defaultDecode, cache } = options;
  if (!verifyManifestSignature(event)) throw new NappletResolutionError("invalid-signature", "...");
  const manifest = parseNappletManifest(event);
  if (computeAggregateHash(manifest.paths) !== manifest.aggregateHash) throw new NappletResolutionError("aggregate-mismatch", "...");
  // cache hit is re-verified; fetched bytes are verified before insertion
  await cache?.writeVerifiedResolution({ event, manifest, files, indexHtml });
  return { dTag: manifest.dTag, aggregateHash: manifest.aggregateHash, files, indexHtml, manifest };
}
```

Resolve the manifest event from configured relays, merge manifest server hints with configured Blossom endpoints in `fetchBlob`, and keep a process-memory implementation of `NappletArtifactCache`. Fail closed: no HTML is sent on any verification or required-capability error. Return verified `indexHtml`, `dTag`, `aggregateHash`, display metadata, and supported domains.

### `components/NappletFrame.tsx` and `islands/NappletShell.tsx` (opaque iframe bridge)

**Analog:** `../hyprgate-gui/apps/shell/src/components/NappletFrame.svelte`

**Identity before `srcdoc` invariant** (`NappletFrame.svelte:119-137`, `274-301`):

```ts
const identity = { dTag, aggregateHash: computedAggregateHash };
originRegistry.unregister(windowId);
originRegistry.register(iframeEl.contentWindow, windowId, identity);

registerIframeIdentity(); // before srcdoc
window.addEventListener("shell-ready", onNappletShellReady); // before srcdoc
iframeEl.srcdoc = injectNapShellCompatibilityPrelude(
  resolved.indexHtml,
  getRuntimeDomains(),
);
```

**Iframe contract** (`NappletFrame.svelte:325-334`):

```tsx
<iframe
  sandbox="allow-scripts"
  title={title}
  ref={iframeRef}
  class="block h-full w-full border-0"
/>
```

In Preact, retain one iframe element/ref across Home/Profile navigation. Compare every `MessageEvent.source` to `iframeRef.current?.contentWindow`, silently ignore unknown types, and forward only recognized shell/identity/relay/outbox envelopes through the tab's WebSocket. Prepend the Kehto namespace prelude outside verified artifact bytes. Accept `shell.ready` once and send exactly one `shell.init`. The island may own socket reconnect, pending correlation timeouts, history, view state, notices, and postMessage; it must not import Applesauce, account/signing classes, or `@kehto/runtime`.

### `runtime/transport.ts` (validated transport codec)

**Analog:** `../kehto/packages/runtime/src/relay-handler.ts`

**Close-before-unsubscribe pattern** (`relay-handler.ts:191-207`):

```ts
const subKey = `${windowId}:${subId}`;
subscriptions.delete(subKey);
hooks.relayPool?.untrackSubscription(subKey);
hooks.sendToNapplet(windowId, { type: "relay.closed", subId, message: "" });
```

**Recognized-error correlation** (`relay-handler.ts:209-255`):

```ts
const id = m.id ?? "";
if (!eventTemplate || typeof eventTemplate !== "object") {
  sendRelayPublishResult(hooks, windowId, id, false, undefined, "invalid event template");
  return;
}
try {
  const signed = await signEvent(eventTemplate);
  // publish and correlate with original id
} catch (error) {
  sendRelayPublishResult(hooks, windowId, id, false, undefined, "event signing failed");
}
```

Parse JSON into a small discriminated union before dispatch. Validate sizes, IDs, connection/window ownership and operation fields. Preserve original IDs on typed timeouts/errors. Unknown message types get no response.

### `runtime/accounts.ts` and `runtime/account_store.ts` (server-owned sensitive state)

**Closest authoritative pattern:** Applesauce account API excerpt in `01-RESEARCH.md:316-328` (no close application source analog).

```ts
manager.registerType(NostrConnectAccount);
manager.registerType(PrivateKeyAccount);
manager.fromJSON(snapshot.accounts);
if (snapshot.activeAccountId) manager.setActive(snapshot.activeAccountId);
```

Snapshot shape is `{ version, activeAccountId, accounts: manager.toJSON() }`; `activeAccountId` is portal-owned because manager serialization omits selection. All three sign-in paths run on the backend, newest success becomes active, and `active$` is projected to public browser-safe identity state. Offline NIP-46 restore remains active/offline. Sign-out clears active signing authority but not public runtime streams.

`account_store.ts` should use `Deno.readTextFile`, a temporary sibling file, restrictive directory/file permissions where supported, then `Deno.rename` for atomic replacement. Serialize all writes through one promise queue. Never return serialized records to a route/island and never log parse content or keys.

### `runtime/config.ts` (immutable startup configuration)

No close analog exists. Follow existing Deno module style: explicit local `.ts` imports, double quotes, named exports. Read environment once, validate schemes (`ws/wss` relays, `http/https` Blossom), normalize/deduplicate, merge local endpoints as ordinary endpoints, default bind to `127.0.0.1`, and return an immutable object. Log only coordinate, endpoint counts, restoration state and readiness; rejected endpoint warnings may show the rejected public URL but no credentials.

### `routes/index.tsx`, `routes/_app.tsx`, `components/HomeView.tsx`, `components/ProfileView.tsx`

**Analogs:** existing portal route/app/component files.

**SSR route boundary** (`routes/index.tsx:1-6`, `11-30`):

```tsx
import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import NappletShell from "../islands/NappletShell.tsx";

export default define.page(function Home(ctx) {
  return <NappletShell initialSnapshot={/* browser-safe only */} />;
});
```

**Document shell** (`routes/_app.tsx:3-14`): retain `define.page`, viewport meta, and `<Component />`; set product metadata and body classes only.

**Presentational component pattern** (`components/Button.tsx:1-17`): use named exports, typed props, native elements, `class` rather than `className`, and no browser state. Home/Profile receive public serializable props and callbacks from the island. Use semantic nav/dialog/buttons and the exact UI-SPEC copy.

### `assets/styles.css`

**Analog:** existing `assets/styles.css:1-10`.

Keep `@import "tailwindcss";`, remove `.fresh-gradient`, and add only global shell primitives Tailwind cannot express cleanly: `100vh` fallback then `100dvh`, safe-area bottom padding, focus ring defaults, visually-hidden/inert view behavior, and reduced-motion override. Inline the locked UI-SPEC colors/spacing as Tailwind arbitrary values; do not create a design-system dependency.

### Tests and `deno.json`

Use Deno's built-in `Deno.test`, local typed fakes, and no external framework. Add a `test` task while preserving `check`. Map fixtures at adapter seams: fake relay messages with exact `from`, fake clock for reconnect grace/timeouts, fake filesystem for snapshot ordering, fake Blossom bytes for hash failure, and a captured user-provided napplet contract fixture (never author a demo napplet).

Tests should directly assert:

- singleton pool/store across two connections while subscription ownership remains independent;
- store-first delivery, dedup, exact relay hint, one EOSE, and live events after EOSE;
- close deletes ownership before unsubscribe and grace expiry destroys only its windows;
- source mismatch/unknown message is silent; recognized timeout preserves correlation ID;
- account serialization includes active ID and never crosses browser transport;
- identity changes broadcast without iframe remount;
- verified identity is registered before `srcdoc`; sandbox is exactly `allow-scripts`;
- island dependency graph contains no Applesauce/signers/pool/store/runtime imports.

## Shared Patterns

### One runtime, many browser windows

**Sources:** Hyprgate `relay-pool-service.ts:20-28`, Kehto bootstrap `372-411`.

Create all expensive/authoritative runtime objects once. WebSockets create namespaces, not runtimes. Keys are connection + window + napplet `subId`; never key globally by `subId`.

### Exact relay provenance

**Sources:** Hyprgate `relay-req-stream.ts:50-71`, Kehto `relay-result.ts:45-53`.

```ts
export function createRelayEventResultWithHints(event, relayHints) {
  return createRelayEventResult(
    event,
    relayHints?.length ? { relayHints } : undefined,
  );
}
```

Populate hints only from the raw `pool.req()` message's `from`; omit when unknown. Never substitute the target relay list.

### Error handling and logging

Fail artifact verification closed. Return typed canonical errors only for recognized envelopes and retain correlation IDs. Unknown types are silent. Log allowlisted metadata only: napplet identity, event ID/kind, request ID, endpoint counts, lifecycle status. Never log event content, signatures, Nostr Connect session material, `nsec`, account snapshots, or request bodies.

### Browser/server authority boundary

SSR sends only public initial shell state. The island owns visual state, browser history, iframe/source checks, postMessage and one reconnecting WebSocket. Every signer, account record, pool, event store, artifact fetch/verification operation, NIP-65 operation, and Kehto runtime service stays in `runtime/`.

### Import and module conventions

Use relative imports with explicit `.ts`/`.tsx`, double quotes, two-space Deno formatting, default exports for routes/islands, named exports for reusable components/services, and direct implementation imports (no barrels).

## No Analog Found

| File | Role | Data Flow | Reason / planner fallback |
|---|---|---|---|
| `runtime/config.ts` | config | transform | Starter has no environment/config parsing; implement from locked decisions and validate with `tests/config_test.ts`. |
| `runtime/account_store.ts` | store | file-I/O | Siblings do not implement the required Deno server-side sensitive snapshot; use the research's atomic temp-file/rename pattern and Deno tests. |

## Metadata

**Analog search scope:** portal root, `../kehto/packages`, `../napplet-web/packages`, `../hyprgate-gui/apps/shell/src`
**Primary analogs read:** 15 files (portal Fresh shell, Kehto NIP/runtime, Hyprgate relay/Kehto/iframe)
**Pattern extraction date:** 2026-07-30

Planner note: local Kehto checkout manifests are on an older peer line than sibling napplet-web. Follow the research checkpoint and pin one coherent published dependency line before implementation; use sibling source as contract reference, not a mixed local runtime dependency.
