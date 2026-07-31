# Phase 8: Cross-Tab Media Sessions - Research

**Researched:** 2026-07-31 **Domain:** Canonical NAP-MEDIA 0.31.0 envelopes,
backend-owned cross-tab arbitration, and browser playback enactment
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

### Session model

- Use pinned 0.31.0 MEDIA envelopes and one process-owned coordinator keyed by
  active account and canonical session identity.
- Track origin connection, current owner connection, monotonic generation,
  playback metadata/state, and last accepted command.
- Broadcast immutable current-state projections to every eligible connected tab
  after each accepted transition.
- Keep media source validation within Phase 5 resource policy where URLs/blobs
  are involved.

### Ownership arbitration

- Starting a new session or transferring ownership increments the generation and
  issues stop/revoke to the prior owner before confirming the new owner.
- Resolve concurrent start/transfer commands through one serialized reducer with
  deterministic ordering.
- Require generation checks on every owner command so delayed or restored tabs
  cannot reclaim playback.
- Idempotent repeats settle without duplicate playback or extra ownership
  changes.

### Cross-tab transport and shell controls

- Use the existing backend WebSocket connections as the canonical coordination
  fabric; browser-only channels may optimize UI but never decide ownership.
- Show compact shell-owned now-playing state and transfer/stop actions in every
  connected tab.
- A tab enacts playback only while its connection and generation match the
  authoritative owner projection.
- Reconnect receives a snapshot before it can issue owner commands and does not
  silently resume stale playback.

### Closure and failure behavior

- Closing/expiring the origin connection ends its session and broadcasts a
  terminal state.
- Owner loss without origin loss stops playback and leaves an explicit
  transferable paused/stopped state only if the pinned contract permits it.
- Delivery failures, hidden tabs, reconnect races, duplicate commands, and
  shutdown settle deterministically without two owners.
- Test reducer invariants with fake connections plus production transport smoke
  coverage across at least two clients.

### the agent's Discretion

Choose timeout/grace details, compact control layout, and internal
reducer/module boundaries where contracts are silent, prioritizing deterministic
single ownership over seamless but ambiguous continuation.

### Deferred Ideas (OUT OF SCOPE)

Background audio service workers, lock-screen integrations, playlists,
remote-cast protocols, and cross-device ownership remain outside this phase.
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID     | Description                                                                                                                                                | Research Support                                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| MED-01 | Napplet can create and control an ownership-aware NAP-MEDIA session through the backend runtime.                                                           | Exact 0.31.0 envelopes, validation rules, directionality, reducer commands, and bridge routing are specified below.                |
| MED-02 | Only one browser tab owns playback for the active media session, and starting playback elsewhere stops or transfers the competing owner deterministically. | The generation protocol, serialized reducer, stop-before-grant effect order, and invariants define deterministic single ownership. |
| MED-03 | Every connected tab receives current media state, can request transfer to itself, and can stop the active session from shell navigation.                   | The portal projection/control protocol, recipient eligibility, shell UI, and broadcast rules are specified below.                  |
| MED-04 | Closing the origin tab closes its media session, while stale or reconnected tabs cannot reclaim ownership with outdated commands.                          | Origin expiry semantics, reconnect snapshot gate, generation checks, and closure tests are specified below.                        |

</phase_requirements>

## Summary

Phase 8 should add a process-owned `MediaSessionCoordinator` beside the existing
connection/runtime services, with a pure reducer at its center and delivery
effects around it. The pinned npm packages already provide the complete
napplet-facing NAP-MEDIA 0.31.0 vocabulary: eight envelope types, two
playback-owner values, seven actions, four playback statuses,
metadata/context/source shapes, and the correlated create result. The contract
does **not** contain cross-tab generation, browser connection ownership,
transfer requests, snapshot messages, or delivery acknowledgements. Those must
remain portal-internal WebSocket control/projection messages and must never be
injected into the iframe as invented `media.*` envelopes. [VERIFIED: installed
`@napplet/core@0.31.0` and `@napplet/nap@0.31.0` declarations]

The coordinator should keep at most one active session per
`(accountId, canonicalSessionId)`, while also enforcing one current playback
owner across the active account. Every accepted state-changing command produces
a new immutable projection and a strictly increasing generation where authority
changes. Transfer is a two-stage effect: commit a generation that revokes the
old owner and sends it canonical `media.command { action: "stop" }`, then grant
the new owner only after the revoke delivery attempt is sequenced. Delivery
success cannot be proven by WebSocket `send()`, so safety comes from the new
generation invalidating the old owner before either effect is emitted. RFC 6455
orders messages within one WebSocket but does not create a total order across
clients; the single backend reducer supplies that total order. [CITED:
https://www.rfc-editor.org/rfc/rfc6455]

Browser tabs are actuators and projections, never authorities. A reconnecting
client must receive and accept `runtime.media.snapshot` before its media
controls/iframe forwarding are enabled. Browser `visibilitychange` may
defensively stop an element, but origin closure must be tied to authoritative
backend window expiry after the existing reconnect grace, because mobile
browsers may not fire `pagehide`, `beforeunload`, or `unload`. [CITED:
https://developer.chrome.com/docs/web-platform/page-lifecycle-api]

**Primary recommendation:** Implement a pure account-scoped media reducer plus a
process-owned coordinator that validates exact 0.31.0 NAP envelopes, assigns
monotonic authority generations, sequences revoke before grant, and broadcasts
portal-only snapshots to all authenticated connections.

## Architectural Responsibility Map

| Capability                                | Primary Tier     | Secondary Tier   | Rationale                                                                                                        |
| ----------------------------------------- | ---------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| Validate napplet `media.*` envelopes      | API / Backend    | Browser / Client | The iframe bridge authenticates source, but the backend must validate exact keys/types before authority changes. |
| Canonical session IDs and account scoping | API / Backend    | —                | IDs and active-account association are process authority and cannot trust a tab hint.                            |
| Cross-tab ordering and generation         | API / Backend    | —                | Only the common backend observes all clients and can serialize their commands.                                   |
| Revoke/stop and grant delivery            | API / Backend    | Browser / Client | Backend decides and orders effects; the matching browser tab enacts playback commands.                           |
| Media rendering/playback                  | Browser / Client | —                | `HTMLMediaElement` and user activation exist only in the browser.                                                |
| Now-playing projection/actions            | Browser / Client | API / Backend    | Shell renders immutable backend state and submits transfer/stop requests.                                        |
| Media URL/blob resolution                 | API / Backend    | Browser / Client | Existing Phase 5 policy owns fetch/validation; browser receives only an approved playable result.                |
| Origin/owner lifecycle                    | API / Backend    | Browser / Client | Backend connection expiry is authoritative; browser lifecycle signals are advisory.                              |

## Project Constraints (from AGENTS.md)

- Use Deno and Fresh; use Fresh routes for server rendering and islands only for
  browser interactivity.
- Keep persistent state and complex Nostr/runtime logic in the backend.
- Use pinned production npm imports, including `@napplet/core@0.31.0` and
  `@napplet/nap@0.31.0`; sibling `../napplet` is reference-only.
- Napplets remain sandboxed, and every NAP API operation crosses an explicit
  proxy/message boundary.
- Keep the shell acceptable on mobile browsers, especially fullscreen napplet
  usage.
- Respect streaming/reactive patterns and do not duplicate an existing reactive
  source into another state machine.
- Media source access must remain compatible with local relay/Blossom caching
  and Phase 5 transfer policy.
- Follow Deno formatting/lint/type-checking, two-space indentation, double
  quotes, explicit local extensions, and Preact `class` attributes.
- Use named exports for reusable runtime helpers and default exports for
  route/island components; do not add barrel files.
- Validate user/external input before processing, return explicit failures, and
  do not log secrets or payload bodies.
- Run `deno task check`, inspect the intentional diff, and commit the research
  artifact.

## Exact Pinned NAP-MEDIA 0.31.0 Contract

All facts in this section are verified against the installed lock-resolved
declarations under `node_modules/.deno/@napplet+nap@0.31.0` and
`@napplet/core@0.31.0`, with the sibling source used only as a readable
reference. [VERIFIED: codebase grep and installed npm declarations]

### Canonical types

| Type                  | Exact shape                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `MediaPlaybackOwner`  | `"shell"                                                                                  |
| `MediaAction`         | `"play"                                                                                   |
| `MediaState.status`   | `"playing"                                                                                |
| `MediaState`          | Required `status`; optional finite `position`, `duration`, `volume`                       |
| `MediaMetadata`       | Optional `title`, `artist`, `album`, `artwork`, `duration`, `mediaType: "audio"           |
| `MediaArtwork`        | Optional `url`, `hash`                                                                    |
| `MediaSourceRef`      | Optional `url`, `blossomHash`, `nostr`, `mimeType`                                        |
| `MediaNostrRef`       | Optional `eventId`, `address`, `relays`                                                   |
| `MediaSessionContext` | Optional `label`, `detail`, `index`, `total`, `links`                                     |
| `MediaContextLink`    | Required lower-case `rel`; optional `title`, `nostr`                                      |
| `MediaSessionCreate`  | Discriminated by owner: `shell` requires `source`; `napplet` permits optional `source`    |
| `MediaSessionResult`  | Optional `sessionId`, `owner`, `error`; success requires ID+owner, failure requires error |

### Exact envelopes and direction

| Type literal                  | Direction in 0.31.0                              | Required fields         | Optional fields                                                                  | Portal handling                                                                                                                          |
| ----------------------------- | ------------------------------------------------ | ----------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `media.session.create`        | Napplet → shell                                  | `id`, `owner`           | `sessionId`, `source`, `metadata`, `context`, `capabilities`, `autoplay`, `live` | Correlated request; canonicalize ID; validate shell source; create/replace through reducer.                                              |
| `media.session.create.result` | Shell → napplet                                  | `id`                    | `sessionId`, `owner`, `error`                                                    | Exactly one result for each accepted/rejected create; never combine success and error.                                                   |
| `media.session.update`        | Napplet → shell                                  | `sessionId`, `metadata` | Metadata fields are partial                                                      | Origin-only metadata patch; no response.                                                                                                 |
| `media.session.destroy`       | Napplet → shell                                  | `sessionId`             | —                                                                                | Origin-only terminal transition; no response.                                                                                            |
| `media.state`                 | Owner → peer; union allows both directions       | `sessionId`, `status`   | `position`, `duration`, `volume`                                                 | Accept only from authoritative owner+generation; forward canonical state where contract calls for it and project internally to all tabs. |
| `media.capabilities`          | Owner → peer; union allows both directions       | `sessionId`, `actions`  | —                                                                                | Accept only from authoritative owner+generation; deduplicate actions and reject unknown actions.                                         |
| `media.command`               | Controller → owner; union allows both directions | `sessionId`, `action`   | `value`                                                                          | Route only to current owner. `seek` requires non-negative finite value; `volume` requires finite 0..1; other actions reject `value`.     |
| `media.controls`              | Shell → napplet                                  | `sessionId`, `controls` | —                                                                                | Shell-advertised canonical action list; send to relevant napplet owner, not as cross-tab state.                                          |

The phrase “8 message types” counts create, create-result, update, destroy,
state, capabilities, command, and controls. No other `media.*` literal is
canonical in 0.31.0. [VERIFIED: `@napplet/nap/media/types`]

### Important contract limits

- `sessionId` on create is only a preferred hint; the shell returns the
  canonical ID. Canonical IDs should be generated server-side with
  `crypto.randomUUID()` unless an unused, bounded hint can safely be accepted.
  [VERIFIED: installed declarations]
- The wire `owner` means playback implementation (`shell` or `napplet`), not
  which browser tab owns cross-tab authority. Store it separately from
  `ownerConnectionId`/`ownerWindowId`. [VERIFIED: installed declarations]
- `media.session.update` only updates metadata; context, source, owner,
  autoplay, and live are not updateable by this envelope. [VERIFIED: installed
  declarations]
- The contract has no acknowledgment for
  destroy/update/state/capabilities/command. Portal-internal request/result
  messages may acknowledge shell transfer/stop controls, but must not masquerade
  as NAP messages. [VERIFIED: installed declarations]
- Owner loss can settle as `status: "stopped"` because that status is canonical.
  It must not invent a `detached`, `revoked`, or `transferable` NAP status.
  Transferability is a portal projection boolean. [VERIFIED: installed
  declarations]
- `next`/`prev` are canonical actions even though playlists are deferred; route
  them only when the owner reported those capabilities. Phase 8 does not build a
  queue. [VERIFIED: installed declarations]

## Standard Stack

### Core

| Library                 | Version / publish date | Purpose                                                       | Why Standard                                                                                                      |
| ----------------------- | ---------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `@napplet/core`         | 0.31.0 / 2026-07-28    | Core media owner/action/session types and NAP domain registry | Project-locked canonical contract. [VERIFIED: npm registry, lockfile, installed declarations]                     |
| `@napplet/nap`          | 0.31.0 / 2026-07-28    | Exact media envelopes, shim, and SDK                          | Project-locked canonical MEDIA surface. [VERIFIED: npm registry, lockfile, installed declarations]                |
| Deno WebSocket/Web APIs | Deno 2.9.4             | Server transport, UUIDs, browser-compatible types             | Already owns the production runtime endpoint; no new transport dependency. [VERIFIED: local runtime and codebase] |
| Preact hooks            | 10.29.4 locked         | Shell projection and compact actions                          | Existing island architecture and dependency. [VERIFIED: lockfile/codebase]                                        |

### Supporting

| Library                                  | Version     | Purpose                                              | When to Use                                                                                                |
| ---------------------------------------- | ----------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Existing `ConnectionRegistry`            | first-party | Reconnect identity, grace, window expiry             | Use its expiry callback as the authoritative lifecycle seam. [VERIFIED: codebase]                          |
| Existing Phase 5 resource policy/service | first-party | Validate/fetch URL, Blossom, and Nostr media sources | Use for shell-owned media before exposing bytes/URLs to playback. [VERIFIED: codebase and locked decision] |
| Deno test runner                         | Deno 2.9.4  | Pure reducer and production WebSocket tests          | Existing `deno task test` infrastructure. [VERIFIED: codebase]                                             |

### Alternatives Considered

| Instead of                      | Could Use                                  | Tradeoff                                                                                                                                  |
| ------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Process-owned reducer           | `BroadcastChannel` / Web Locks             | Browser coordination cannot cover disconnected/frozen tabs or enforce backend account/session policy; explicitly disallowed as authority. |
| Portal-only generation protocol | Add fields to canonical `media.*` messages | Would violate pinned 0.31.0 exact shapes and contract drift tests.                                                                        |
| Connection expiry               | `unload`/`beforeunload`                    | Mobile browsers do not reliably fire them; advisory only.                                                                                 |
| Existing Preact state           | New state library                          | Adds dependency and another state machine without solving authority.                                                                      |

**Installation:** No new packages. Keep existing pinned import-map entries.

## Package Legitimacy Audit

No external package installation is required. The two already-pinned project
dependencies were nevertheless audited because this phase consumes them.

| Package                | Registry | Age at research | Downloads  | Source Repo                       | Verdict         | Disposition                                                                    |
| ---------------------- | -------- | --------------- | ---------- | --------------------------------- | --------------- | ------------------------------------------------------------------------------ |
| `@napplet/core@0.31.0` | npm      | 3 days          | 1,352/week | `github.com/sandwichfarm/napplet` | SUS (`too-new`) | Already locked/project-mandated; do not upgrade; retain contract drift checks. |
| `@napplet/nap@0.31.0`  | npm      | 3 days          | 1,503/week | `github.com/sandwichfarm/napplet` | SUS (`too-new`) | Already locked/project-mandated; do not upgrade; retain contract drift checks. |

Both packages have no `postinstall` script. **Packages removed due to SLOP:**
none. **Packages flagged SUS:** both pinned packages; they are a locked project
decision and already installed, so no new install checkpoint is needed, but the
planner should preserve exact-version drift tests. [VERIFIED: npm registry and
package-legitimacy seam]

## Architecture Patterns

### System Architecture Diagram

```text
Sandboxed napplet iframe
  │ exact 0.31.0 media.* envelope + authenticated frame source
  ▼
NappletShell iframe bridge
  │ runtime.forward(connectionId, windowId, message)
  ▼
Production WebSocket endpoint ── exact decoder / account lookup
  │ normalized MediaInput {account, connection, window, generation, command}
  ▼
Process-owned MediaSessionCoordinator
  │ serialized pure reducer
  ├── reject/no-op ───────────────► correlated create error / control result
  └── accepted transition
       │ immutable projection + ordered effects
       ├── 1. revoke generation + media.command(stop) to previous owner
       ├── 2. grant projection/command to new owner
       └── 3. runtime.media.snapshot broadcast to eligible account tabs
              │
              ▼
        Every NappletShell
          ├── compact now-playing projection
          ├── transfer/stop portal controls
          └── iframe receives only canonical media.* messages

Shell-owned source ──► Phase 5 resource policy/cache ──► browser media element
Connection expiry ───► coordinator origin/owner lifecycle transition
```

### Recommended Project Structure

```text
runtime/
├── media_contract.ts       # exact decoders/normalizers for 0.31.0 envelopes
├── media_reducer.ts        # pure state, commands, effects, invariants
├── media_sessions.ts       # process-owned coordinator and delivery wrapper
├── portal_runtime.ts       # composition/open-window integration
└── transport.ts            # portal media snapshot/control envelope decoding
islands/
└── NappletShell.tsx        # projection gate, controls, iframe enactment
components/
└── MediaControls.tsx       # compact shell-owned presentation
tests/
├── media_contract_test.ts
├── media_reducer_test.ts
├── media_shell_test.tsx
└── media_transport_smoke_test.ts
```

### Pattern 1: Pure reducer, explicit ordered effects

**What:** A synchronous reducer receives one normalized command at a time and
returns `{state, effects, outcome}`. State is frozen after transition; effects
contain recipient IDs and typed canonical/portal messages, not callbacks.

**When to use:** Every create, update, destroy, state/capabilities report,
transfer, stop, connection expiry, and shutdown.

```typescript
// Source: project-specific pattern derived from locked CONTEXT.md decisions.
type MediaEffect =
  | { type: "send-nap"; to: OwnerRef; message: MediaNapMessage }
  | { type: "broadcast"; accountId: string; projection: MediaProjection };

function reduceMedia(
  state: MediaCoordinatorState,
  command: MediaCoordinatorCommand,
): MediaTransition {
  // Validate authority, compute next immutable state, then ordered effects.
}
```

### Pattern 2: Separate NAP contract from portal coordination protocol

**What:** Decode iframe messages as exact `MediaRequestMessage` shapes. Define
separate `runtime.media.snapshot`, `runtime.media.transfer`,
`runtime.media.stop`, and `runtime.media.result` messages for shell-to-backend
coordination.

**When to use:** Cross-tab projection and shell controls. The portal protocol
carries `generation`; canonical NAP envelopes do not.

Recommended portal projection:

```typescript
interface MediaProjection {
  readonly accountId: string; // backend comparison only; omit from browser wire if unnecessary
  readonly sessionId: string;
  readonly generation: number;
  readonly origin: { readonly connectionId: string; readonly windowId: string };
  readonly owner:
    | { readonly connectionId: string; readonly windowId: string }
    | null;
  readonly playbackOwner: "shell" | "napplet";
  readonly metadata: Readonly<MediaMetadata>;
  readonly context?: Readonly<MediaSessionContext>;
  readonly state: Readonly<MediaState>;
  readonly capabilities: readonly MediaAction[];
  readonly transferable: boolean;
  readonly terminal: boolean;
}
```

Do not transmit `accountId` unless the UI needs it; eligibility is decided
server-side.

### Pattern 3: Generation as an authority fence

**What:** Increment generation on creation, ownership grant/transfer, owner
loss, origin closure, and terminal shutdown. Require the browser’s current
projection generation on portal transfer/stop requests and internally attach the
generation to any owner-originated NAP forwarding context.

**When to use:** Any input that could cause playback or mutate owner-reported
state.

The iframe cannot include a generation in canonical `media.state` or
`media.command`. Therefore the shell bridge must associate forwarded canonical
messages with the last accepted portal projection generation. The backend
compares that transport context to coordinator state. A stale iframe cannot
choose its own generation. [VERIFIED: absence of generation from pinned
declarations]

### Pattern 4: Snapshot-before-command reconnect gate

**What:** After `runtime.connected`, the server sends `runtime.media.snapshot`
(active projection or explicit `null` plus account epoch). The island sets
`mediaReady=true` only after validating that snapshot. Until then it neither
enables shell media controls nor forwards ownership-sensitive `media.state`,
`media.capabilities`, or playback-causing commands.

**When to use:** Every new or resumed socket, including reconnect-token
resumption.

### Deterministic transfer algorithm

1. Validate authenticated active account, connection/window membership, session
   ID, request ID, and exact expected generation.
2. If requester is already the owner at that generation, return idempotent
   success without generation increment or effects.
3. Increment generation and immediately make the old owner unauthorized in
   reducer state.
4. Emit old-owner `media.command { action: "stop" }` first, tagged by the outer
   portal delivery context with the new generation/revocation.
5. Set canonical state to `stopped` (preserving bounded last position/duration),
   then emit the new-owner grant projection.
6. Broadcast the same frozen projection to all eligible connections for that
   account.
7. Record the request ID/outcome in a bounded per-session idempotency cache; an
   exact retry returns the recorded result, while same ID/different payload is
   rejected.

“Stop before transfer” is an **effect ordering guarantee**, not proof that the
prior browser actually stopped. Safety remains deterministic because its old
generation loses authority before grant. If the prior browser ignores delivery,
it is misbehaving visually but cannot publish accepted owner state or regain
authority. A later hidden/visible or reconnect snapshot must force local stop
when ownership does not match.

### Session key and cardinality

- Primary key: `(accountId, canonicalSessionId)`.
- Secondary indexes: origin window → session keys; owner window → session key;
  active account → current session key.
- One active current session per account for Phase 8. A new accepted create
  terminates/revokes the previous active account session before confirming the
  new session. This directly realizes “one backend-coordinated media session”
  and prevents two different session IDs from each owning playback.
- Canonical session ID: accept a preferred hint only if it is non-empty, ≤128
  characters, safe (`[A-Za-z0-9._:-]`), and unused for that account; otherwise
  generate UUID. Never permit a hint to select or overwrite another origin’s
  session.
- Origin identity: the authenticated `{connectionId, windowId}` that created the
  session. Only origin may update/destroy it.
- Owner identity: current `{connectionId, windowId}` allowed to enact/report
  playback; may differ from origin after transfer.

### Lifecycle matrix

| Event                              | Required transition                                                                                                                                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| New create                         | Revoke/stop previous active owner/session, terminalize previous session, create new generation, result to origin, broadcast.                                                                                                               |
| Same create request ID/payload     | Replay same result; no new ID/generation/playback.                                                                                                                                                                                         |
| Origin socket transient detach     | Keep state during existing reconnect grace; disconnected origin cannot issue commands.                                                                                                                                                     |
| Origin window expiry after grace   | Increment generation, revoke/stop owner if present, terminalize and remove active index, broadcast terminal projection.                                                                                                                    |
| Owner detach, origin still present | Immediately increment generation, revoke authority, set owner `null`, canonical status `stopped`, transferable `true`; do not wait grace to protect single ownership. A resumed same connection remains non-owner until explicit transfer. |
| Owner equals origin and detaches   | Owner loss stops immediately; session terminalizes only when origin expires after grace.                                                                                                                                                   |
| Owner send/delivery failure        | Treat as owner loss using the same transition; never grant based on delivery success.                                                                                                                                                      |
| Reconnect                          | Snapshot first; old generation is invalid; local playback stops unless snapshot names this connection/window at current generation.                                                                                                        |
| Hidden tab                         | Local UI may pause/stop defensively; authority changes only from backend command/connection lifecycle.                                                                                                                                     |
| Runtime shutdown                   | Increment/terminalize all sessions, best-effort stop current owners, then close transport/services.                                                                                                                                        |
| Active account sign-out/change     | Terminalize all sessions for prior account before broadcasting new identity; never project prior account media into new account.                                                                                                           |

The existing 10-second reconnect grace is appropriate for **origin expiration**
and should remain configurable through `PORTAL_RECONNECT_GRACE_MS`. Owner
authority should be revoked immediately on socket detach because preserving
playback through an unreachable owner creates ambiguity; a reconnect can
explicitly transfer again. [VERIFIED: existing `ConnectionRegistry`
default/config seam; timeout choice is agent discretion]

### Anti-Patterns to Avoid

- **Put generation inside `media.command` or `media.state`:** violates exact
  0.31.0 envelopes. Carry it in trusted outer transport/coordinator context.
- **Conflate `owner: "napplet"` with owner tab:** one describes playback
  implementation, the other cross-tab authority.
- **Wait for stop ACK before changing authority:** no canonical ACK exists and a
  dead/hidden tab could block forever. Revoke state first, order delivery
  effects, and grant deterministically.
- **Use `BroadcastChannel`, localStorage, or Web Locks as authority:** they do
  not cover server/account policy and are unreliable across discarded tabs.
- **Use unload to close the origin:** termination callbacks are unreliable on
  mobile.
- **Allow any tab to report `media.state`:** only exact current owner+generation
  reports may mutate state.
- **Forward portal snapshots to iframe:** napplets should only see canonical NAP
  messages.
- **Render optimistic owner state:** shell controls should wait for the
  authoritative projection/result.

## Don't Hand-Roll

| Problem                | Don't Build                 | Use Instead                                                    | Why                                                                       |
| ---------------------- | --------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| MEDIA wire types       | Similar local interfaces    | Pinned `@napplet/nap/media` types plus strict runtime decoders | Prevents drift from eight exact messages.                                 |
| Session UUIDs          | Timestamps/random strings   | `crypto.randomUUID()`                                          | Collision-resistant built-in.                                             |
| Cross-tab transport    | Browser peer bus            | Existing authenticated backend WebSocket                       | Already owns origin, reconnect, and account boundary.                     |
| Media resource fetch   | Direct iframe/browser fetch | Phase 5 resource policy/cache                                  | Keeps SSRF, scheme, size, redirect, MIME, and Blossom policy centralized. |
| Mobile close detection | unload heartbeat protocol   | Existing socket detach/expiry lifecycle                        | Browser termination is not reliably observable.                           |
| New reactive store     | Custom/global event state   | Preact state fed by immutable backend projections              | Small projection surface; backend remains authority.                      |

**Key insight:** The hard part is not playing media; it is maintaining a single
authorization fact across independent, failure-prone browser processes. Keep
that fact in one backend reducer and make every browser action conditional on
its current projection.

## Common Pitfalls

### Pitfall 1: Inventing generation fields in canonical envelopes

**What goes wrong:** Contract drift breaks pinned shims/conformance and creates
non-portable napplets. **Why it happens:** The phase requires generations but
NAP-MEDIA 0.31.0 does not expose them. **How to avoid:** Put generation in
portal-only outer messages and derive it at the authenticated iframe bridge.
**Warning signs:** `generation` appears in a `MediaNapMessage` object or iframe
postMessage payload.

### Pitfall 2: Treating WebSocket ordering as global ordering

**What goes wrong:** Simultaneous transfers from two sockets appear to race
nondeterministically. **Why it happens:** Each connection is ordered, but
independent clients have no shared protocol order. **How to avoid:**
Synchronously dispatch every decoded input through one coordinator/reducer and
assign generation there. [CITED: https://www.rfc-editor.org/rfc/rfc6455]
**Warning signs:** Per-socket state machines each mutate media ownership.

### Pitfall 3: Granting before revocation is committed

**What goes wrong:** Two tabs temporarily believe they own playback. **Why it
happens:** Delivery code drives state or awaits the old client. **How to
avoid:** Reducer first invalidates old generation; ordered effects send stop
then grant. **Warning signs:** New owner is stored before generation changes, or
transfer awaits network acknowledgment.

### Pitfall 4: Autoplay promise is ignored

**What goes wrong:** Projection says playing but mobile browser blocks `play()`.
**Why it happens:** Script-initiated playback is subject to autoplay/user
activation policy. **How to avoid:** Handle the Promise from
`HTMLMediaElement.play()`; report actual state only after fulfillment, and
report/retain stopped or paused state on `NotAllowedError`. Shell transfer UI
must allow a user gesture retry. [CITED:
https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play]
**Warning signs:** `void media.play()` without rejection handling or optimistic
“playing” UI.

### Pitfall 5: Depending on browser close events

**What goes wrong:** Sessions leak or stale tabs retain UI because mobile
browser kills the page without callbacks. **Why it happens:** `beforeunload`,
`pagehide`, and `unload` are not reliable termination signals on mobile. **How
to avoid:** Use backend WebSocket detach/expiry; visibility events only stop
local work defensively. [CITED:
https://developer.chrome.com/docs/web-platform/page-lifecycle-api] **Warning
signs:** authoritative destroy is sent only from `unload`.

### Pitfall 6: Account leakage

**What goes wrong:** A signed-out/new account sees or controls a previous
account’s media session. **Why it happens:** Coordinator keyed only by session
ID or broadcasts to all sockets. **How to avoid:** Key by active account,
maintain account epochs, filter every broadcast, and terminalize on account
change. **Warning signs:** global `activeSession` without account index.

### Pitfall 7: Unbounded high-frequency state/input

**What goes wrong:** position reports cause memory/CPU pressure or invalid
numbers reach UI. **Why it happens:** `media.state` is explicitly high-frequency
and TypeScript types do not validate runtime JSON. **How to avoid:** Require
exact keys, finite bounded numbers, coalesce projection broadcasts to a small
cadence (recommend ≤4/second for position-only changes), but process
status/owner changes immediately. Never debounce stop/revoke. **Warning signs:**
every `timeupdate` causes an allocation/broadcast or accepts `NaN`/Infinity.

## Code Examples

### Exact create validation split by playback owner

```typescript
// Source: installed @napplet/core@0.31.0 MediaSessionCreate declaration.
function validCreate(message: Record<string, unknown>): boolean {
  if (message.type !== "media.session.create" || !boundedId(message.id)) {
    return false;
  }
  if (message.owner === "shell") return validSource(message.source);
  return message.owner === "napplet" &&
    (message.source === undefined || validSource(message.source));
}
```

### Browser enactment must confirm play

```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play
async function enactPlay(
  element: HTMLMediaElement,
): Promise<"playing" | "blocked"> {
  try {
    await element.play();
    return "playing";
  } catch {
    element.pause();
    return "blocked";
  }
}
```

### Authority check

```typescript
// Source: project-specific generation fence from locked CONTEXT.md decisions.
function isCurrentOwner(
  projection: MediaProjection,
  actor: OwnerRef,
  generation: number,
): boolean {
  return !projection.terminal && projection.generation === generation &&
    projection.owner?.connectionId === actor.connectionId &&
    projection.owner.windowId === actor.windowId;
}
```

## State of the Art

| Old Approach                                | Current Approach                                                 | When Changed                       | Impact                                                                                                                                |
| ------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy standalone media package assumptions | Layered `@napplet/nap/media` subpath and core owner/action types | Pinned 0.31.0                      | Import exact current contract; do not add legacy message names. [VERIFIED: installed package]                                         |
| Browser-local media session ownership       | Backend generation-fenced ownership across connections           | Phase 8 locked design              | Frozen/reconnected tabs cannot reclaim playback.                                                                                      |
| Unload-driven cleanup                       | Visibility as advisory, socket expiry as authority               | Current mobile lifecycle guidance  | Correct under mobile termination/discard. [CITED: https://developer.chrome.com/docs/web-platform/page-lifecycle-api]                  |
| Assume `play()` succeeds                    | Await/reject-aware playback enactment                            | Modern Promise-returning media API | UI reflects browser policy rather than desired state. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play] |

**Deprecated/outdated:**

- Any `media.*` type outside the eight listed above is not part of pinned
  0.31.0.
- `unload` as reliable cleanup is explicitly discouraged for mobile lifecycle
  handling.

## Assumptions Log

| # | Claim                                                                                                                   | Section | Risk if Wrong |
| - | ----------------------------------------------------------------------------------------------------------------------- | ------- | ------------- |
| — | None. Project-specific choices are recommendations under explicit agent discretion; external facts were verified/cited. | —       | —             |

## Open Questions

All planning-relevant questions are resolved:

1. **Does pinned MEDIA permit a transferable ownerless state?**
   - Resolution: Yes at the portal projection layer: canonical state uses
     `status: "stopped"`, while portal state uses `owner: null` and
     `transferable: true`. Do not invent a NAP status.
2. **What exactly closes an origin session?**
   - Resolution: authoritative `ConnectionRegistry` window expiry after
     configured reconnect grace. Detach alone preserves origin identity during
     grace; owner authority is revoked immediately.
3. **How is generation carried when canonical envelopes lack it?**
   - Resolution: trusted portal WebSocket projection/control context and
     bridge-held current generation, never fields inside `media.*`.
4. **Can stop-before-transfer wait for confirmation?**
   - Resolution: No canonical ACK exists. Commit revocation/generation first,
     emit stop before grant, and rely on the authority fence for safety.
5. **How many sessions may be active?**
   - Resolution: one active session per account for Phase 8, indexed by
     `(accountId, canonicalSessionId)`; new create terminalizes the previous
     active session.
6. **What timeout/grace applies?**
   - Resolution: reuse `PORTAL_RECONNECT_GRACE_MS` (current default 10 seconds)
     for origin expiration; owner loss revokes immediately.
7. **Who may update/destroy/report?**
   - Resolution: origin may update/destroy; only current owner+generation may
     report state/capabilities; any eligible same-account tab may request
     transfer/stop with current generation.
8. **How should autoplay failure settle?**
   - Resolution: do not claim playing until `play()` fulfills; rejection leaves
     stopped/paused and surfaces a user-gesture retry.

## Environment Availability

| Dependency                        | Required By                      | Available     | Version                                       | Fallback                                                               |
| --------------------------------- | -------------------------------- | ------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| Deno                              | runtime/tests/build              | ✓             | 2.9.4                                         | —                                                                      |
| TypeScript                        | type checking                    | ✓             | 6.0.3 via Deno                                | —                                                                      |
| npm registry                      | pinned-version verification only | ✓             | npm CLI 10.9.8                                | Installed lock-resolved declarations                                   |
| `@napplet/core`                   | media types                      | ✓             | 0.31.0                                        | none; locked                                                           |
| `@napplet/nap`                    | media envelopes                  | ✓             | 0.31.0                                        | none; locked                                                           |
| Production Fresh WebSocket server | multi-client smoke tests         | ✓ after build | Existing `deno task build && deno task start` | Vite dev is not valid for upgrades in current Fresh/plugin combination |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** none.

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                      |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| V2 Authentication     | yes     | Existing active signer/account state binds every media input and broadcast.                           |
| V3 Session Management | yes     | Reconnect token/connection registry plus snapshot gate and authority generation.                      |
| V4 Access Control     | yes     | Origin-only mutation/destruction; owner-only reports; same-account eligible shell controls.           |
| V5 Input Validation   | yes     | Exact-key runtime decoders, bounded strings/arrays, finite numeric ranges, known enums.               |
| V6 Cryptography       | yes     | `crypto.randomUUID()` for opaque IDs; existing authenticated signer boundary; no custom cryptography. |

### Known Threat Patterns for Deno/Fresh WebSocket media coordination

| Pattern                                    | STRIDE                  | Standard Mitigation                                                                                                     |
| ------------------------------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Foreign socket/window claims ownership     | Spoofing / Elevation    | Ignore client-supplied owner identity; bind actor from authenticated connection/window registry.                        |
| Stale replay reclaims playback             | Tampering               | Monotonic generation check and bounded idempotency keys.                                                                |
| Cross-account state broadcast              | Information Disclosure  | Account-keyed recipient filter and terminalization on identity change.                                                  |
| Malicious media URL / Blossom reference    | Tampering / SSRF        | Phase 5 scheme/redirect/size/MIME/hash policy; iframe never fetches arbitrary source by authority.                      |
| Flood of state updates/creates             | Denial of Service       | 256 KB outer limit, exact shape/field bounds, one active account session, bounded caches, state coalescing/rate limits. |
| Hidden stale tab continues sound           | Denial / safety failure | Revoke generation before grant, stop effect first, visibility/snapshot local stop guard.                                |
| Guessed session ID mutates another session | Elevation               | Account-scoped canonical IDs plus origin/owner authorization independent of ID secrecy.                                 |
| Logging media URLs/context                 | Information Disclosure  | Log only type and shortened identifiers, not sources/metadata/context.                                                  |

## Production Multi-Client Test Architecture

Nyquist validation is disabled in `.planning/config.json`, so the general
`Validation Architecture` section is intentionally omitted. The locked phase
decision still requires explicit production transport coverage.

### Pure reducer suite (`tests/media_reducer_test.ts`)

- Table-test every legal transition and every unauthorized/stale transition.
- Property/invariant loop with deterministic seeded command sequences: at most
  one owner; generation never decreases; terminal sessions have no owner;
  accepted owner reports exactly match owner+generation; duplicate request IDs
  never create extra effects.
- Race permutations: A/B simultaneous create, A/B simultaneous transfer,
  transfer vs origin expiry, transfer vs stop, state report vs revoke, reconnect
  snapshot vs delayed command.
- Assert exact effect order: old-owner stop precedes new-owner grant/broadcast.
- Fake delivery failure must still leave one/no owner, never roll authority
  back.

### Contract suite (`tests/media_contract_test.ts`)

- Accept every exact canonical envelope and reject missing required fields,
  extra keys, unknown enum values, invalid source ownership,
  non-finite/out-of-range numbers, oversized IDs/metadata/arrays.
- Import pinned types from `@napplet/nap/media`; add source-text/fixture
  assertions that the exact eight literals and unions remain pinned.
- Ensure portal `runtime.media.*` messages never pass through as
  `MediaNapMessage` or reach the iframe path.

### Shell suite (`tests/media_shell_test.tsx`)

- Snapshot renders title/artist/status and only capability-valid controls.
- Non-owner shows Transfer and Stop; owner hides/disables redundant Transfer.
- Controls are disabled until initial snapshot after every socket generation.
- Older-generation snapshot/result is ignored; newer projection forces local
  stop before render.
- `play()` fulfillment/rejection drives reported state; visibility hidden stops
  local playback without independently changing authority.
- Compact controls remain reachable at mobile widths and do not obstruct
  fullscreen/napplet navigation.

### Required production transport smoke (`tests/media_transport_smoke_test.ts`)

Run against `deno task build && deno task start`, not `deno task dev`, because
the current Vite-backed dev server does not carry WebSocket upgrades. [VERIFIED:
AGENTS.md/codebase stack constraint]

1. Start server on an isolated loopback port with short test reconnect grace.
2. Open WebSocket client A and B with same authenticated test account; record
   distinct connection/window IDs.
3. Verify both receive an explicit initial `runtime.media.snapshot` before media
   controls are accepted.
4. A creates a napplet-owned session; A receives exact correlated
   `media.session.create.result`; both receive identical generation projection.
5. A reports playing with the current transport generation; both projections
   update.
6. B requests transfer twice with same request ID; assert A receives exactly one
   stop/revoke before B receives grant and generation increments once.
7. Send delayed A state/command under old generation; assert rejection/no state
   change.
8. Drop B socket; assert immediate owner revocation and stopped/transferable
   projection while A origin remains.
9. Reconnect B using token; assert snapshot arrives and no silent resume occurs.
10. Expire A origin; assert both clients receive terminal projection and later
    commands cannot recreate/reclaim it.
11. Repeat with concurrent transfers in both arrival orders to prove reducer
    arrival order is the deterministic tie-break.

The test must capture ordered outbound frames per socket and coordinator
transition log; wall-clock sleeps should be replaced by injected clock/timer
controls where possible. Production transport coverage may use short bounded
polling only at the process boundary.

## Sources

### Primary (HIGH confidence)

- Installed `@napplet/core@0.31.0/dist/index.d.ts` — exact `MediaPlaybackOwner`,
  `MediaAction`, `MediaSessionCreate`, public API.
- Installed `@napplet/nap@0.31.0/dist/media/types.d.ts` — exact eight envelopes,
  direction unions, metadata/context/source/state shapes.
- npm registry metadata and package-legitimacy seam — versions, publication
  timestamps, repositories, downloads, scripts, verdicts.
- Project code: `runtime/connections.ts`, `runtime/portal_runtime.ts`,
  `runtime/transport.ts`, `routes/api/runtime.ts`, `islands/NappletShell.tsx` —
  current connection, bridge, reconnect, decoder, and projection seams.

### Secondary (MEDIUM confidence)

- https://www.rfc-editor.org/rfc/rfc6455 — WebSocket framing and per-connection
  ordered delivery.
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play —
  Promise fulfillment/rejection and autoplay policy.
- https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay — script
  playback/user activation policy.
- https://developer.chrome.com/docs/web-platform/page-lifecycle-api — mobile
  hidden/termination/discard reliability.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — locked packages and versions verified from import map,
  lockfile, installed declarations, and npm registry.
- Architecture: HIGH — follows locked process-owned coordinator decision and
  existing runtime/connection seams; portal-only generation boundary is forced
  by exact contract absence.
- Pitfalls: HIGH — derived from pinned declarations, current code, RFC 6455, and
  current browser lifecycle/media documentation.
- Browser edge behavior: MEDIUM — authoritative web documentation, but
  real-device UAT remains necessary for vendor-specific autoplay/background
  behavior.

**Research date:** 2026-07-31 **Valid until:** 2026-08-07 (browser/runtime
behavior is fast-moving; pinned package contract remains valid while version
stays 0.31.0)
