# Phase 1: Napplet Runtime MVP - Context

**Gathered:** 2026-07-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the full locked Phase 1 vertical slice in which one single-user Deno/Fresh backend runtime owns Nostr identity, Applesauce relay/event state, napplet resolution, and Kehto NAP execution. Lightweight browser tabs render a mobile shell, load one verified sandboxed napplet, and proxy NAP-SHELL, NAP-IDENTITY, NAP-RELAY, and NAP-OUTBOX traffic over a live backend connection. The original one-day tracer remains the first delivery checkpoint; completing every D-01–D-47 behavior and Phase 1 requirement has no one-day deadline. Full catalog, durable cache, approval policy, multi-user isolation, and broad NAP coverage remain later-phase work.

</domain>

<decisions>
## Implementation Decisions

### Sign-in and backend account lifetime
- **D-01:** Lead sign-in with Nostr Connect. Show its QR code and copyable URI together with a short signer-app instruction; keep bunker URI and `nsec` as secondary methods.
- **D-02:** Present `nsec` as a normal secondary option labeled **Not recommended**, not as a developer-only feature. Key material remains backend-owned and never enters URLs, logs, napplet storage, or browser-accessible storage.
- **D-03:** Show the active user's avatar in the bottom navigation. Tapping it opens the shell settings area; Phase 1 includes active-account details and sign-out only.
- **D-04:** Use Applesauce's account system and serialization where supported. Persist every successfully added account, its complete signer state (including `nsec` and Nostr Connect client material), and the active-account selection. The newest successful sign-in becomes active; older accounts remain stored but are not exposed in the Phase 1 UI. — **Reversibility:** costly — changing the persisted representation later requires migrating sensitive account records.
- **D-05:** Store serialized account data directly and rely on host filesystem permissions. Documentation must mark the account store as sensitive at-rest material.
- **D-06:** If a restored NIP-46 signer is unavailable, retain it as the active but offline account, continue public reads, and retry connectivity without deleting the account.
- **D-07:** The backend runtime has one globally active Nostr account. Browser tabs are windows into that account. Last successful sign-in wins and identity changes are broadcast to every connected tab and mounted napplet.
- **D-08:** Closing all tabs does not sign out the backend. On sign-out, keep public relay/outbox reads active, push identity-unavailable state, and reject signer-dependent operations.

### Mobile shell and napplet navigation
- **D-09:** After sign-in, automatically open the configured napplet. Render its iframe immediately; do not add a portal loading screen or wait for runtime streams to become complete.
- **D-10:** Keep a two-item bottom navigation in normal layout flow: Home and Profile, both with icons and labels. Include safe-area padding. It reduces the iframe's available height and never overlays napplet content.
- **D-11:** Home is a full shell view with a compact grid of app-style icon/name tiles. Phase 1 shows only the configured napplet with a small active indicator.
- **D-12:** Profile/settings is also a full shell view. Home and Profile temporarily hide—but do not unmount—the iframe. Returning to the napplet preserves in-memory state; use a short subtle fade between views.
- **D-13:** The open napplet has no portal-owned header and uses the full available width, including on desktop.
- **D-14:** Browser Back from the napplet navigates to Home without reloading it. Selecting the active tile returns to the existing iframe.
- **D-15:** On iframe load or handshake failure, keep the iframe visible and show a slim shell error notice above it with Retry.

### Verified napplet loading and Kehto boundary
- **D-16:** Configure one NIP-5A napplet address/manifest coordinate in server configuration. Resolve its signed manifest from default relays at backend startup, fetch the artifact through manifest server hints plus configured default Blossom servers, verify the blob/aggregate identity, and bind that identity at iframe creation. — **Reversibility:** costly — this identity forms the NIP-5D session and capability-policy key.
- **D-17:** Refuse to execute unverifiable content and show a shell-owned integrity error with Retry. Refuse launch when required NAP capabilities are unavailable and name the missing capability.
- **D-18:** Keep the verified artifact in a simple session runtime cache behind the same artifact-adapter seam future local Blossom caching will use. Retain the startup-resolved version until restart or explicit retry.
- **D-19:** If no napplet coordinate is configured, show Home with an empty state explaining that server configuration is required.
- **D-20:** Use `sandbox="allow-scripts"` without `allow-same-origin`. Add no other sandbox tokens in Phase 1.
- **D-21:** Follow Kehto and napplet package contracts exactly. The napplet sends `shell.ready`; the shell replies exactly once with `shell.init`. Dynamically inject only mandatory shell plus supported/granted NAP domains. Bind identity from `MessageEvent.source`, silently ignore unknown types, and use NAP-defined errors for recognized failures.
- **D-22:** Phase 1 supports NAP-SHELL, NAP-IDENTITY, NAP-RELAY, and NAP-OUTBOX only. A user-provided test napplet verifies the seam; do not build an example napplet.
- **D-23:** Ordinary NAP errors are returned to the napplet for presentation. Shell notices are reserved for iframe, integrity, connection, or session failures. Correlated backend timeouts return typed errors with the original ID and do not kill the napplet session.

### Applesauce relay/event runtime
- **D-24:** Run one backend-wide Applesauce `RelayPool` and one in-memory `EventStore`. Merge matching store events with live relay observables and pipe live events through the store so deduplication is centralized. Do not create nested subscriptions.
- **D-25:** Keep logical Kehto subscriptions independent per napplet window while allowing Applesauce to multiplex underlying relay work. Subscription ownership is keyed by backend connection, napplet window, and napplet `subId`.
- **D-26:** On `relay.close` or `outbox.close`, unsubscribe the composed observable immediately, stop delivery, release per-subscription resources, and emit the canonical closed envelope.
- **D-27:** NAP-RELAY uses the napplet-supplied relay URL. NAP-OUTBOX combines preset runtime relays with user NIP-65 routing through the existing Kehto service contract.
- **D-28:** Treat partial relay availability as normal Nostr behavior. Use Applesauce relay-pool primitives, relay selection, and the event store rather than inventing portal-level partial-failure semantics.
- **D-29:** Preserve exact observed relay provenance in canonical `RelayEventResult.sidecar.relayHints`. Omit hints when the delivering relay is not known; never substitute all targeted relays as fake provenance.
- **D-30:** Preserve current lifecycle contracts: NAP-RELAY emits `relay.eose`; NAP-OUTBOX has no EOSE message. Reconstruct one RELAY EOSE from Applesauce relay-message state if the higher-level event observable omits it, then keep the live tail open.

### Browser-to-backend stream transport and shared runtime
- **D-31:** Use one duplex WebSocket per browser tab for correlated commands/results and subscription events.
- **D-32:** A reconnecting tab automatically re-registers only its active logical subscriptions, preserves napplet `subId` values, and deduplicates replay through the shared event store.
- **D-33:** Each tab receives its own connection/window namespace, but all tabs share the one backend account, relay pool, and event store. Identical subscriptions stay logically independent.
- **D-34:** Retain a disconnected tab's runtime sessions for a short configurable grace window, then tear down only that connection's sessions and subscriptions.
- **D-35:** Do not add portal authentication. Anyone able to access the web server is the same trusted operator as the backend's active account. Bind to loopback by default and require explicit configuration for LAN/public exposure. — **Reversibility:** costly — adding multi-user authentication later changes every runtime/session ownership boundary.

### Signing and publishing
- **D-36:** Implement canonical NAP-RELAY and NAP-OUTBOX publish operations in Phase 1 with no approval UI for supported/granted napplets.
- **D-37:** Follow current package contracts to the letter: NAP-RELAY accepts an already-signed Nostr event and forwards it unchanged; NAP-OUTBOX accepts an unsigned template, signs it with the global backend account, and performs canonical fanout.
- **D-38:** Treat a napplet-supplied signed NAP-RELAY event as unexpected-but-supported behavior. Log only napplet identity, event ID/kind, and request correlation ID—never content, signature, or secrets.
- **D-39:** Implement `relay.publishEncrypted` using backend-owned Applesauce event operations for encryption and signing. Never expose keys or signer authority to the napplet.
- **D-40:** Report publish success only after the target relay or required NAP-OUTBOX relay set acknowledges acceptance. Return only canonical Kehto/NAP result fields and per-relay outcomes.

### Runtime configuration and cache seams
- **D-41:** Supply the napplet coordinate, relay list, Blossom server list, reconnect grace period, bind address, and related MVP settings through environment variables read once at startup.
- **D-42:** Ship small documented built-in relay and Blossom fallback lists. Environment configuration overrides those lists.
- **D-43:** Treat local Nostr relays and local Blossom servers as ordinary additional event/blob endpoints merged into their respective lists. Phase 1 does not create a separate cache protocol or durable synchronization.
- **D-44:** Normalize, validate, and deduplicate endpoint URLs with Applesauce helpers where available. Warn about rejected values and continue with valid/default endpoints.
- **D-45:** Leave the shared Phase 1 in-memory event/artifact cache unbounded until backend restart.
- **D-46:** Print a sanitized startup summary containing the napplet coordinate, endpoint counts, account-restoration state, and runtime readiness. Never print credentials or signer material.
- **D-47:** Keep the original one-day vertical tracer as Phase 1's first delivery checkpoint, but remove the one-day deadline from full Phase 1 completion. All D-01–D-46 decisions and all Phase 1 requirements remain in Phase 1; none may move to a later phase to satisfy the former time box.

### the agent's Discretion
- Exact visual styling, icon set, spacing, colors, and animation duration within the locked mobile-shell behavior.
- Exact environment-variable names and built-in endpoint values, provided they are documented and satisfy the configuration semantics above.
- Exact duration of the short reconnect grace window.
- Internal module boundaries and adapter type names, provided backend ownership and canonical package contracts remain intact.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope and requirements
- `.planning/PROJECT.md` — One-day MVP boundary, backend ownership, stream-first constraints, and deferred runtime breadth.
- `.planning/REQUIREMENTS.md` — Phase 1 requirement set and quality bar.
- `.planning/ROADMAP.md` — Phase goal, success criteria, and phase boundary.
- `.planning/codebase/ARCHITECTURE.md` — Existing Fresh composition, route, island, and request-state patterns.
- `.planning/codebase/INTEGRATIONS.md` — Current absence of auth, storage, external services, and runtime integrations.
- `.planning/codebase/STRUCTURE.md` — Existing file placement and integration points.

### NIP and NAP contracts
- `https://github.com/nostr-protocol/nips/pull/2303` — Living NIP-5D transport, sandbox, identity, unknown-message, and capability rules.
- `https://github.com/nostr-protocol/nips/blob/master/01.md` — Relay EVENT/EOSE/CLOSED lifecycle semantics.
- `https://github.com/napplet/naps/pull/2` — Current draft NAP-RELAY operations, EOSE, and `RelayEventResult` contract.
- `https://github.com/napplet/naps/pull/32` — Current draft NAP-OUTBOX routing and lifecycle; explicitly has no caller-visible EOSE.

### Kehto runtime contracts
- `../kehto/RUNTIME-SPEC.md` — Canonical Kehto runtime model, NAP-SHELL handshake, sandboxing, identity, and unknown-type behavior.
- `../kehto/packages/shell/README.md` — `createShellBridge`, injected namespaces, session identity, and shell integration contract.
- `../kehto/docs/packages/shell.md` — Exported host adapter surface and package boundaries.
- `../kehto/packages/runtime/src/relay-handler.ts` — Existing NAP-RELAY dispatch, subscription ownership, EOSE, close, and publish behavior.
- `../kehto/packages/runtime/src/relay-result.ts` — Canonical `RelayEventResult` and relay-hint helpers.

### Napplet package contracts
- `../napplet-web/README.md` — NIP-5D web projection and package roles.
- `../napplet-web/packages/core/src/types/nostr.ts` — Shared event, filter, result, sidecar, and subscription types.
- `../napplet-web/packages/nap/src/relay/types.ts` — Current NAP-RELAY wire shapes.
- `../napplet-web/packages/nap/src/outbox/types.ts` — Current NAP-OUTBOX wire shapes and fanout fields.

### Hyprgate Applesauce reference implementation
- `../hyprgate-gui/apps/shell/src/lib/relay/relay-pool-service.ts` — Shared pool and per-window subscription cleanup.
- `../hyprgate-gui/apps/shell/src/lib/relay/relay-pool-adapter.ts` — Kehto `RelayPoolAdapter` over Applesauce.
- `../hyprgate-gui/apps/shell/src/lib/relay/relay-event-store.ts` — EventStore/cache/live-stream merge and centralized deduplication.
- `../hyprgate-gui/apps/shell/src/lib/relay/relay-req-stream.ts` — EOSE reconstruction while preserving a live tail.
- `../hyprgate-gui/apps/shell/src/lib/kehto/outbox-router.ts` — NIP-65 discovery, fallback routing, relay selection, and Kehto outbox integration.
- `../hyprgate-gui/apps/shell/src/lib/kehto/bootstrap.ts` — Runtime/service composition and ordered teardown.
- `../hyprgate-gui/apps/shell/src/lib/auth/auth-actions.ts` — Applesauce signer integration and NIP-46 reconnect patterns; use as reference, not as the chosen account persistence implementation.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `main.ts` and `utils.ts`: Fresh app composition and typed request-state seams; replace starter middleware/routes with runtime wiring rather than preserving demos.
- `routes/index.tsx` and `routes/_app.tsx`: Server-rendered shell entry and root document metadata.
- `islands/Counter.tsx`: Existing hydration boundary to replace with narrowly scoped shell/navigation/WebSocket interactivity.
- `components/Button.tsx`: Presentational primitive that may be reused or replaced as the product shell develops.
- `assets/styles.css` and Tailwind: Existing styling pipeline for mobile shell and safe-area layout.

### Established Patterns
- File-system API routes belong under `routes/api/`; do not add endpoint implementations directly to `main.ts`.
- Browser behavior belongs in islands; backend runtime, signers, Applesauce pools/stores, and persistent account state do not.
- Shared Fresh request state is typed through `State`/`define` in `utils.ts`.
- The starter has no database, auth, WebSocket, tests, or external integration patterns to preserve.

### Integration Points
- Replace `routes/index.tsx` starter UI with the server-rendered mobile shell and one interactive client boundary.
- Add a focused backend runtime module layer imported from the Fresh composition/API boundary.
- Add a WebSocket endpoint/upgrade path that maps browser connections to backend runtime window namespaces.
- Adapt sibling `../kehto` and `../napplet-web` packages rather than reimplementing NAP envelope contracts.
- Add Applesauce dependency imports and account/relay/store initialization at backend startup.

</code_context>

<specifics>
## Specific Ideas

- The architecture should resemble Hyprgate's relationship between one runtime and many napplet windows, adapted so multiple browser tabs are those windows while the Deno backend owns the shared runtime.
- Home should already look like the future installed-app grid even though Phase 1 contains only one configured napplet.
- The user will provide the simple napplet used to test interface compatibility; this phase does not author a demonstration napplet.
- Applesauce should own Nostr complexity: account persistence, relay pooling, event-store deduplication, URL normalization, observable composition, encryption helpers, and NIP-65 data loading where its APIs support them.

</specifics>

<deferred>
## Deferred Ideas

- Full account-management and profile-settings UI.
- Installed napplet catalog beyond the single configured NIP-5A coordinate.
- Durable event/blob cache, local cache synchronization, quotas, and eviction policy.
- Multi-user/multi-account runtime isolation and portal authentication.
- Per-napplet approval/consent UI and persistent capability policy.
- Broad Kehto/NAP domain coverage beyond SHELL, IDENTITY, RELAY, and OUTBOX.
- Example/demo napplet authored by this project.
- Production deployment/security hardening beyond loopback-by-default and sensitive-log avoidance.

</deferred>

---

*Phase: 1-Napplet Runtime MVP*
*Context gathered: 2026-07-30*
