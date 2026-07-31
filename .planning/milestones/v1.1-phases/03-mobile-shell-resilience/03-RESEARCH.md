# Phase 3: Mobile Shell Resilience - Research

**Researched:** 2026-07-30
**Domain:** Mobile browser lifecycle, resilient WebSocket transport, accessible shell UI, and first-paint theming
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Connection ritual and state language

- **D-01:** Cold connections use a full-screen, wordless ritual inspired by
  Miyamoto Musashi's discipline and a cypherpunk vision of Bitcoin's
  final-subsidy era. It should feel inspirational, purposeful, metered, and
  measured rather than decorative.
- **D-02:** The central metaphor is a cryptographic constellation: scattered
  nodes, blocks, and proof signals form a resilient network.
- **D-03:** Successful progress follows **seed → link → cluster → gate**: one
  pulsing node for pending, a verified link for connected, a measured assembling
  network for bootstrapping, and the sovereign portal mark for ready.
- **D-04:** Verified determinate stages lock into the constellation one by one.
  Genuinely indeterminate work uses a restrained pulse; never show fake
  percentages.
- **D-05:** Retry actively attempts to bridge a fractured link. Offline rests in
  a dormant disconnected arrangement. Repeated failure becomes a stable
  unresolved fracture with sparse motion and a separate Retry affordance while
  quiet recovery continues.
- **D-06:** Geometry and motion carry state meaning through node count, link
  continuity, assembly stage, and movement pattern. Color reinforces meaning but
  is never the sole discriminator.
- **D-07:** The completed constellation becomes the shell: its geometry resolves
  into the portal icon, connection indicator, and navigation accents.
- **D-08:** Reduced-motion mode preserves the same constellation and state
  grammar using discrete transitions with no zooming, orbiting, flashing, or
  continuous movement. Screen-reader-only/plain-language status remains
  available.

### Ritual timing and interruption

- **D-09:** Play the complete ritual for cold connections and an abbreviated
  fracture-and-rebuild treatment for reconnects.
- **D-10:** When readiness is fast, preserve a brief readable cadence but do not
  delay the ready shell by more than roughly one second. Controls become
  interactive at the reveal.
- **D-11:** There is no ordinary Skip control. If startup remains slow, expose
  minimal Home and Account access after roughly three seconds while the
  constellation continues truthfully.

### Connection details and recovery

- **D-12:** Tapping the bottom-bar constellation opens a minimal sheet
  containing one short plain-language current-status sentence and the relevant
  action. Do not show telemetry, timestamps, retry timing, identifiers, or stage
  history by default.
- **D-13:** Retry appears only after repeated failures; early automatic recovery
  stays quiet.
- **D-14:** Unexpected loss starts capped exponential backoff with jitter
  immediately and silently, accompanied by the abbreviated fractured
  constellation.
- **D-15:** Hidden or suspended tabs preserve the reconnect token but suppress
  active retry churn. Reconnect promptly when visible or resumed.
- **D-16:** While the browser reports offline, suspend attempts, preserve token
  and shell state, show the dormant fracture, and resume recovery when online
  returns.
- **D-17:** Automatic recovery never permanently stops. After normal capped
  backoff, enter low-frequency recovery while visible and expose manual Retry
  after repeated failures.

### Navigation and bottom bar

- **D-18:** The open-napplet bottom bar has three stable touch targets: Home,
  constellation connection status, and Account. The status target opens the
  minimal connection sheet.
- **D-19:** Home reveals the shell home view while keeping the napplet iframe
  mounted; reopening resumes the same frame.
- **D-20:** The bar reserves layout space above the mobile safe-area inset and
  never overlays napplet content. It remains visible during interaction.
- **D-21:** Landscape and very short viewports keep the same three controls in a
  slimmer bar with reduced height and padding.
- **D-22:** Use an opaque shell surface with a thin electric-amber boundary so
  the bar has reliable contrast over any napplet.

### Account chrome and responsive identity

- **D-23:** The home header is identity-first rather than an operational
  dashboard. On narrow phones it shows avatar and display name only; the entire
  row is one generous account-sheet target with a subtle disclosure mark.
- **D-24:** A signer-offline state adds a compact non-color mark without
  expanding the narrow card. Wider layouts additionally reveal shortened `npub`
  and signer status.
- **D-25:** Account opens a compact sheet containing identity, signer/connection
  state, settings, switch/sign-in, and a visually separated sign-out action.
- **D-26:** Signed-out state emphasizes one primary Sign In action with a short
  explanation; individual sign-in modes remain in the existing sign-in flow.
- **D-27:** A known identity with an offline signer remains visibly signed in,
  shows “Signer offline,” and offers one recovery action. Backend runtime
  reconnection is shown separately and does not mark the signer identity
  offline.

### Sign-out aftermath

- **D-28:** Sign Out is immediate and leaves the mounted napplet visible; it
  does not ask for confirmation or close the frame.
- **D-29:** Use the existing canonical identity/session transition supplied by
  pinned Kehto runtime packages, adapting the portal's existing identity
  projection rather than inventing a portal-only message. Research/planning must
  verify the exact pinned contract.
- **D-30:** Show a brief non-blocking “Signed out” confirmation near the account
  control, transition the sheet to signed-out state, and leave the napplet
  unobscured.
- **D-31:** Subsequent protected requests receive only the contract-defined
  Kehto/NAP denial; do not open account UI or add a shell toast.
- **D-32:** Public/read-only activity continues wherever the contract permits;
  signing and account-scoped capabilities fail.

### Theme and branding

- **D-33:** Default to System with explicit Light, Dark, and System choices.
  Persist an explicit choice in this browser across future visits, independently
  of sign-in.
- **D-34:** Render the correct theme from the first painted frame with the
  smallest reliable mechanism. Avoid a new theme subsystem or elaborate
  server/browser synchronization.
- **D-35:** Explicit theme changes switch all shell-owned surfaces immediately
  and discretely, with no animated color interpolation. System mode follows
  operating-system changes live.
- **D-36:** Mobile browser chrome (`theme-color`) follows the active shell
  theme.
- **D-37:** Theme work is shell-only. Communicating a theme preference across
  the napplet boundary would be a separate NAP capability and is not part of
  Phase 3.
- **D-38:** The portal icon is a minimal sovereign constellation gate assembled
  from connected cryptographic nodes and legible at favicon scale.
- **D-39:** The shared palette is ink, bone, and electric amber, applied with
  accessible contrast in both themes.

### the agent's Discretion

No discussed decisions were delegated to the agent. Exact animation curves,
backoff constants within the capped-jittered policy, typography, spacing tokens,
and final SVG geometry remain implementation details for research and planning.

### Deferred Ideas (OUT OF SCOPE)

- Communicating shell theme preference across the napplet boundary is deferred
  because it would require a separate NAP theme capability outside Phase 3.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHL-01 | User can select or follow system dark/light theme across server-rendered shell views and runtime states. | Central first-paint bootstrap, CSS token strategy, persisted preference, live `matchMedia` handling, and dynamic `theme-color`. |
| SHL-02 | User sees a Napplet Portal SVG icon instead of Fresh starter branding. | One reusable constellation-gate SVG geometry replaces the Fresh logo and is referenced directly as the standards-compatible SVG favicon; the starter ICO is removed. |
| SHL-03 | User sees sign-in/account controls in a home-page header card and a compact bottom navigation with home and current-account controls while a napplet is open. | Existing persistent iframe and shell history architecture can be retained while home/account sheets and the stable three-target bar are restructured. |
| CON-01 | User sees a polished cyberpunk connection sequence driven by actual pending, connected, bootstrapping, ready, retry, and failure states, with reduced-motion and accessible status support. | Explicit connection state reducer maps only observable transport/runtime milestones to constellation stages, plus `role=status` and reduced-motion CSS. |
| CON-02 | User sees a compact bottom-navigation indicator reflecting the current tab's backend runtime connection state. | The same state reducer drives the ritual, persistent status target, sheet copy, and non-color SVG geometry. |
| CON-03 | A disconnected or resumed mobile tab reconnects automatically with capped exponential backoff and jitter while preserving the existing reconnect-token/grace semantics. | A single client controller retains `reconnectToken`, serializes socket attempts, and uses full-jitter capped exponential scheduling. |
| CON-04 | Intentional closure cancels reconnect work, and offline, hidden, or repeated-failure states do not create reconnect storms. | Intent flag/generation guards, timer cancellation, `visibilitychange`, `online`/`offline`, and low-frequency capped recovery prevent duplicate sockets and retry churn. |
</phase_requirements>

## Summary

Phase 3 should be planned as a refinement of one existing browser island, not as a new runtime subsystem. `NappletShell.tsx` already owns the WebSocket, reconnect token, shell history, account projection, notices, and single persistent sandboxed iframe; `routes/api/runtime.ts` and `runtime/connections.ts` already preserve a server-owned connection/window through a reconnect-token grace interval. [VERIFIED: codebase grep] The missing layer is a deterministic client connection controller that separates transport milestones from presentation cadence and serializes every connect, retry, visibility, online, and teardown transition. [VERIFIED: codebase grep]

The most important integration correction is sign-out. Pinned `@kehto/shell@0.19.1` says the canonical napplet-facing sign-out transition is `identity.changed` with `pubkey: ""`, delivered through `ShellBridge.publishIdentityChanged()`. [VERIFIED: pinned package README and dist declarations] The current endpoint sends `{type: "runtime.identity", account: null}`, which `NappletShell.tsx` does not consume or forward. [VERIFIED: codebase grep] Planning must route the canonical transition across the existing verified iframe boundary, keep the frame mounted and visible, and independently update shell account chrome.

No new external package is needed. Browser-native WebSocket, Page Visibility, online/offline, `matchMedia`, localStorage, HTML dialog, SVG, CSS custom properties, and reduced-motion features cover the phase. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API] [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-color-scheme] The theme bootstrap belongs in the global Fresh app wrapper so it runs before shell paint across `/`, `/signin`, and `/settings`; route-level duplicated fixed `theme-color` tags should be removed. [CITED: https://fresh.deno.dev/docs/1.x/concepts/app-wrapper]

**Primary recommendation:** Build one testable `ConnectionController`/reducer seam for truthful runtime state and lifecycle-safe retry scheduling, then let the ritual, bottom status target, and status sheet be pure projections of that state while a minimal global theme bootstrap and CSS token system unify all shell routes.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Connection attempt/retry lifecycle | Browser / Client | API / Backend | The current tab observes browser lifecycle and schedules sockets; the backend retains token/grace authority. [VERIFIED: codebase grep] |
| Reconnect namespace preservation | API / Backend | Browser / Client | `ConnectionRegistry.attach()` resolves the token and cancels grace expiry; the browser only retains and resubmits the opaque token. [VERIFIED: codebase grep] |
| Ritual, status indicator, sheets, navigation | Browser / Client | Frontend Server (SSR) | Interactive state belongs in the island, with server-renderable presentational components and global CSS. [VERIFIED: AGENTS.md] |
| Theme first paint | Frontend Server (SSR) | Browser / Client | `_app.tsx` supplies universal head markup; a tiny pre-paint script resolves browser preference and later island controls persist changes. [CITED: https://fresh.deno.dev/docs/1.x/concepts/app-wrapper] |
| Account/signer truth | API / Backend | Browser / Client | Backend account streams remain authoritative; browser renders `identity.changed` projections and sends commands. [VERIFIED: codebase grep] |
| Napplet identity sign-out notification | API / Backend | Browser / Client | Backend owns identity transition; shell boundary forwards pinned canonical `identity.changed {pubkey:""}` to the mounted verified frame. [VERIFIED: pinned @kehto/shell@0.19.1] |
| Branding SVG/favicon | CDN / Static | Browser / Client | Static assets and shared inline SVG geometry render without runtime authority. [VERIFIED: codebase grep] |

## Project Constraints (from AGENTS.md)

- Use Deno and Fresh; routes render server-side and islands contain browser interactivity only. [VERIFIED: AGENTS.md]
- Keep persistent state, Nostr logic, relay/Blossom operations, account handling, and NAP execution in the backend runtime. [VERIFIED: AGENTS.md]
- Keep the napplet in an exact sandboxed iframe and cross the explicit proxy/message boundary for NAP APIs. [VERIFIED: AGENTS.md]
- Preserve stream-oriented, partial/updating behavior; do not convert runtime readiness into an “all data loaded” promise. [VERIFIED: AGENTS.md]
- Production imports must use pinned packages; sibling `../kehto` and `../napplet` are reference-only. [VERIFIED: AGENTS.md]
- Use Deno formatting, two-space indentation, double quotes, explicit local extensions, Fresh `class`, and `deno task check`. [VERIFIED: AGENTS.md]
- Prefer route handlers for file-routed APIs, typed shared state through `utils.ts`, default exports for pages/islands, and named exports for reusable components. [VERIFIED: AGENTS.md]
- Validate inputs and return explicit HTTP statuses; never log secrets or request bodies. [VERIFIED: AGENTS.md]
- The Vite-backed Fresh 2.3 development server cannot exercise this WebSocket upgrade; runtime transport verification must use `deno task build && deno task start`. [VERIFIED: AGENTS.md]
- Complete work under the appropriate GSD workflow, verify, inspect the diff, and commit intentional files. [VERIFIED: AGENTS.md]

## Standard Stack

### Core

| Library/API | Version | Purpose | Why Standard |
|-------------|---------|---------|--------------|
| Fresh | 2.3.3 pinned | Global app wrapper, SSR routes, head metadata | Existing project foundation; `_app.tsx` owns the document shell. [VERIFIED: deno.json; CITED: https://fresh.deno.dev/docs/1.x/concepts/app-wrapper] |
| Preact | 10.29.7 pinned/current; published 2026-07-08 | Island state/effects and presentational components | Already installed and current on npm; no added state library is justified. [VERIFIED: npm registry and deno.json] |
| `@preact/signals` | 2.10.0 pinned/current; published 2026-07-23 | Existing browser reactive primitive where needed | Already installed, though ordinary reducer/state plus refs is sufficient for the controller. [VERIFIED: npm registry and deno.json] |
| `@kehto/shell` | 0.19.1 pinned/current; published 2026-07-29 | Canonical protected identity delivery contract | Its pinned declarations define `publishIdentityChanged("")` for sign-out. [VERIFIED: npm registry and pinned package declarations] |
| Browser Web APIs | Platform | WebSocket, lifecycle, network hints, theme preference, persistence | Directly match the phase and avoid dependency risk. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API] |

### Supporting

| Library/API | Version | Purpose | When to Use |
|-------------|---------|---------|-------------|
| CSS custom properties / `color-scheme` | Platform | Ink/bone/amber theme tokens | All shell-owned surfaces, focus, borders, dialogs, form controls. [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-color-scheme] |
| `matchMedia()` change event | Platform | Follow OS theme changes | Only while stored preference is `system`. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList/change_event] |
| `localStorage` | Platform | Persist `system|light|dark` per browser/origin | Wrap reads/writes in `try/catch`; invalid values fall back to `system`. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage] |
| `document.visibilityState`, `online`/`offline` | Platform | Suppress retry churn and resume promptly | Gate scheduling; do not treat `navigator.onLine` as endpoint reachability proof. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Window/online_event] |
| SVG + CSS animations | Platform | Constellation ritual and reusable portal mark | Use semantic state classes/data attributes, not canvas, so reduced motion and tests remain straightforward. [VERIFIED: existing project SVG/CSS pattern] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Testable local controller/reducer | More `useState` flags inside `NappletShell` | Smaller initial diff but invites impossible state combinations, duplicate timers, and stale closure bugs. [VERIFIED: current shell has independent `connecting`, `notice`, and `runtimeError` flags] |
| Browser-native APIs | Reconnect/theme/animation npm libraries | Adds package and lifecycle abstraction without improving the locked, project-specific policy. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API] |
| Inline SVG/CSS constellation | Canvas/WebGL | Canvas complicates accessible state semantics, reduced-motion snapshots, favicon geometry reuse, and DOM testing. [ASSUMED] |

**Installation:** No new packages. Keep current `deno.json` pins. [VERIFIED: codebase and requirements]

## Architecture Patterns

### System Architecture Diagram

```text
Fresh SSR request
  -> routes/_app.tsx pre-paint theme bootstrap
  -> NappletShell island mounts
       -> ConnectionController reads visible/online/intent state
          -> eligible? no -> dormant hidden/offline state; no timer/socket
          -> eligible? yes -> one WebSocket attempt
               -> open -> connected
               -> runtime.connected -> token stored + runtime.start -> bootstrapping
               -> runtime.artifact/catalog/identity projections -> ready shell
               -> unexpected close/error/timeout -> failure count
                    -> capped full-jitter timer -> retry
                    -> repeated failures -> manual Retry visible + quiet low-frequency loop
       -> ConnectionState projection
          -> cold constellation ritual / reconnect fracture
          -> bottom status target -> minimal status sheet
          -> screen-reader status text
       -> Home / Account navigation
          -> views hide/show while one sandboxed NappletFrame remains mounted

Backend boundary
  routes/api/runtime.ts -> ConnectionRegistry token/grace -> existing runtime window
  account identity -> canonical identity.changed -> verified iframe boundary
```

### Recommended Project Structure

```text
components/
├── AccountSheet.tsx             # presentational account states/actions
├── ConnectionConstellation.tsx  # semantic SVG shared by ritual/status/brand
├── ConnectionSheet.tsx          # minimal status sentence + contextual action
├── HomeHeader.tsx               # responsive identity-first account target
└── PortalMark.tsx               # reusable gate geometry
islands/
├── NappletShell.tsx             # integration owner; retains one frame and shell views
└── ThemeControls.tsx            # explicit preference UI if settings remains separate SSR frame
runtime/
└── (existing backend seams only; no browser lifecycle logic)
shell/
├── connection.ts                # pure state/event reducer and backoff calculation
└── theme.ts                     # validated preference and DOM application helpers
routes/_app.tsx                  # global pre-paint theme bootstrap and metadata
assets/styles.css                # tokens, responsive shell, ritual, reduced motion
static/logo.svg                  # canonical gate artwork
static/logo.svg                  # canonical static mark, also referenced directly as the SVG favicon
tests/
├── connection_controller_test.ts
├── shell_resilience_test.tsx
└── theme_test.ts
```

### Pattern 1: One serialized connection controller

**What:** Represent connection truth as one discriminated state (`pending`, `connected`, `bootstrapping`, `ready`, `retry`, `offline`, `hidden`, `failed`, `closed`) plus refs for the current socket, timer, attempt generation, failure count, reconnect token, and intentional-close flag. [VERIFIED: requirements and codebase seam]

**When to use:** Every socket open/close/error/timeout, visibility transition, network hint, manual Retry, and unmount.

**Example:**

```typescript
// Source: AWS full-jitter guidance + MDN lifecycle events
export function retryDelay(attempt: number, random = Math.random): number {
  const windowMs = Math.min(30_000, 500 * 2 ** Math.min(attempt, 6));
  return Math.floor(random() * windowMs);
}

function eligible(): boolean {
  return !intentionalClose.current &&
    document.visibilityState === "visible" && navigator.onLine;
}
```

The constants above are recommended implementation details within the locked policy: 500 ms base, 30 s normal cap, Retry affordance after 3 consecutive failures, then a visible-only low-frequency window around 60 s. [ASSUMED] Reset the attempt count only after a verified ready milestone, not merely TCP/WebSocket `open`, so handshake failures cannot hammer at the base interval. [ASSUMED]

### Pattern 2: Truth state separate from ritual cadence

**What:** The controller advances truth immediately; a presentation layer may hold earlier completed visual stages briefly, but never show a later stage than truth and never delay usable ready controls beyond D-10. [VERIFIED: CONTEXT.md]

**When to use:** Cold startup can complete faster than the user can perceive; reconnect should use the abbreviated path.

### Pattern 3: First-paint theme bootstrap

**What:** In `_app.tsx`, emit light and dark CSS variables plus a tiny inline script before body paint. It validates one storage key, resolves System through `matchMedia`, sets `document.documentElement.dataset.theme` and `style.colorScheme`, and updates the single `meta[name=theme-color]`. The hydrated theme control reuses the same helper and registers a media-query change listener only for System mode. [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-color-scheme] [CITED: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/theme-color]

### Pattern 4: Canonical sign-out projection

**What:** On immediate sign-out, update shell chrome without confirmation, keep `NappletFrame` mounted/visible, and forward the pinned canonical `identity.changed` payload with empty pubkey to the eligible verified napplet session. [VERIFIED: pinned @kehto/shell@0.19.1 README/declarations] The transport endpoint should acknowledge/result the command only as needed for shell confirmation; it must not introduce a new napplet-facing message type. [VERIFIED: CONTEXT.md]

### Anti-Patterns to Avoid

- **Retry from both `error` and `close`:** browsers normally follow error with close; schedule recovery from one terminal path and make it generation/idempotency guarded. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close_event]
- **Calling `socket.close()` before marking supersession/intent:** the old close callback can schedule a retry for its replacement. Increment the attempt generation and clear current ownership first. [VERIFIED: current `openSocket()` closes the prior socket]
- **Equating WebSocket `open` with runtime ready:** `runtime.connected` and the later runtime projections are separate verified stages. [VERIFIED: codebase grep]
- **Equating `navigator.onLine` with server availability:** it only reports network access heuristics; use it to suppress known-offline attempts, not to declare connection success. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Window/online_event]
- **Setting signer offline on backend socket close:** signer identity and portal transport are distinct locked states; retain the last identity projection until an identity event says otherwise. [VERIFIED: CONTEXT.md]
- **Unmounting/hiding the frame on sign-out:** D-28 requires it to remain visible; only protected operations should start failing. [VERIFIED: CONTEXT.md]
- **Duplicated route theme metadata:** fixed per-route tags can disagree with active theme; own the global mechanism in `_app.tsx`. [VERIFIED: codebase grep]
- **Animating all properties then disabling with a blanket wildcard:** specify motion-bearing transforms/opacity deliberately and provide a static reduced-motion state grammar. [CITED: https://www.w3.org/WAI/WCAG21/Techniques/css/C39.html]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Theme persistence | Backend account setting/sync protocol | Validated `localStorage` preference | Theme is explicitly browser-local and sign-in-independent. [VERIFIED: CONTEXT.md] |
| System theme observation | Polling loop | `matchMedia("(prefers-color-scheme: dark)")` change event | Native event is direct and widely supported. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList/change_event] |
| Mobile suspension detection | Timer drift heuristics | Page Visibility `visibilitychange` | Hidden includes background tabs and mobile app switching/screen lock cases. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event] |
| Network reachability test | Periodic fetch probe | WebSocket outcome, with online/offline only as gates | `navigator.onLine` cannot prove the portal host is reachable. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Window/online_event] |
| Reconnect namespace/session | Browser-generated session identity | Existing opaque reconnect token and `ConnectionRegistry` grace | Backend already owns connection/window/subscription continuity. [VERIFIED: codebase grep] |
| Napplet sign-out event | `runtime.identity` or portal-only envelope | Pinned Kehto canonical `identity.changed { pubkey: "" }` | Exact contract is already defined and capability-protected. [VERIFIED: pinned @kehto/shell@0.19.1] |
| Connection artwork runtime | Canvas animation engine | Semantic inline SVG + CSS classes | Existing stack suffices and geometry can be shared across ritual, nav, and logo. [ASSUMED] |

**Key insight:** The difficult part is lifecycle serialization and truthful state ownership, not drawing the constellation. The visual system should consume a state model that is independently testable with fake clocks, sockets, visibility, network hints, and deterministic randomness. [VERIFIED: requirements]

## Common Pitfalls

### Pitfall 1: Duplicate sockets after resume
**What goes wrong:** A pending timer, `online`, `visibilitychange`, and manual Retry each open a socket. [ASSUMED]
**Why it happens:** Independent callbacks lack a single eligibility/attempt guard. [ASSUMED]
**How to avoid:** Centralize `requestConnect(reason)`; clear timer first; no-op for CONNECTING/OPEN; bind callbacks to an attempt generation. [ASSUMED]
**Warning signs:** More than one live `WebSocket`, multiple `runtime.start` messages, or token grace resuming different connection IDs. [VERIFIED: existing protocol]

### Pitfall 2: Hidden-tab timer churn
**What goes wrong:** Browser timer throttling bunches delayed retries when the page resumes. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API]
**How to avoid:** Cancel scheduled retries on hidden/offline, preserve token and failure count, and make one immediate guarded attempt on visible/online. [VERIFIED: CONTEXT.md]

### Pitfall 3: Fake bootstrapping progress
**What goes wrong:** UI advances based on elapsed time rather than observed protocol stages. [VERIFIED: CONTEXT.md]
**How to avoid:** Map pending to attempt creation, connected to WebSocket/`runtime.connected` as explicitly defined, bootstrapping to `runtime.start` accepted/in-flight, and ready only to the projection that makes the shell usable. If the current protocol cannot distinguish a stage, add one sanitized transport projection rather than infer a percentage. [VERIFIED: codebase grep and CONTEXT.md]

### Pitfall 4: Flash of the wrong theme
**What goes wrong:** the island reads storage after hydration, after the light SSR frame has painted. [ASSUMED]
**How to avoid:** Apply validated preference in the document head before paint; keep default CSS System-compatible; avoid animated color transitions. [CITED: https://fresh.deno.dev/docs/1.x/examples/modifying-the-head]

### Pitfall 5: Sign-out destroys public continuity
**What goes wrong:** Current `signOut()` navigates Home, nulls profile, and the render condition hides the napplet stack; it also uses a confirmation dialog. [VERIFIED: codebase grep]
**How to avoid:** Make account-sheet sign-out immediate, keep view/frame unchanged, announce “Signed out” non-blockingly, and rely on canonical capability denial for later protected requests. [VERIFIED: CONTEXT.md]

### Pitfall 6: Status conveyed only visually
**What goes wrong:** color/animation changes but assistive technology receives no status, or repeated changes become noisy alerts. [CITED: https://www.w3.org/TR/WCAG22/]
**How to avoid:** Keep one concise `role="status"`/polite live region for ordinary state, reserve `role="alert"` for actionable terminal errors, and give the status button an updated accessible name. [CITED: https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22]

### Pitfall 7: Grace period and backoff fight each other
**What goes wrong:** First retry occurs after the server's 10-second default grace, so the old namespace expires. [VERIFIED: runtime/connections.ts]
**How to avoid:** Retry promptly while eligible, with early full-jitter windows comfortably inside grace; keep the token even after grace because the backend safely treats an expired token as a fresh attachment. [VERIFIED: codebase grep]

## Code Examples

### Theme resolution and live System following

```typescript
// Sources: MDN localStorage, prefers-color-scheme, MediaQueryList change
type ThemePreference = "system" | "light" | "dark";

export function resolveTheme(
  preference: ThemePreference,
  systemDark: boolean,
): "light" | "dark" {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}
```

### Idempotent terminal handling

```typescript
// Source: project protocol plus MDN WebSocket close semantics
function finishAttempt(attempt: number, reason: "close" | "timeout"): void {
  if (attempt !== attemptGeneration.current) return;
  if (intentionalClose.current) return;
  socket.current = null;
  scheduleRetry(reason);
}
```

### Accessible connection projection

```tsx
// Source: WCAG 2.2 SC 4.1.3 and WAI ARIA22
<button type="button" aria-label={`Connection: ${plainStatus}`}>
  <ConnectionConstellation state={state} compact />
</button>
<p class="sr-only" role="status" aria-live="polite">{plainStatus}</p>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed light colors in root and every route | CSS theme tokens + first-paint resolved System preference | Phase 3 | Eliminates route inconsistency and theme flash. [VERIFIED: current codebase; CITED: MDN prefers-color-scheme] |
| Manual retry button after disconnect | Immediate capped full-jitter automatic recovery plus later manual Retry | Locked Phase 3 | Prevents storms while recovery never permanently stops. [CITED: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/] |
| Two-target Home/Profile bottom nav | Stable Home/status/Account bar | Locked Phase 3 | Connection truth remains reachable without covering napplet content. [VERIFIED: CONTEXT.md] |
| Portal-only `runtime.identity` sign-out wrapper | Canonical Kehto `identity.changed` empty pubkey transition | `@kehto/shell@0.19.1` pinned 2026-07-29 | Napplet receives contract-defined identity loss and protected actions deny correctly. [VERIFIED: pinned package] |

**Deprecated/outdated:**
- Confirmation-modal sign-out and forced Home navigation conflict with D-28 through D-30. [VERIFIED: CONTEXT.md and codebase grep]
- Treating socket loss as signer loss conflicts with D-27. [VERIFIED: CONTEXT.md]
- Fresh starter logo/favicon and violet/light-only palette must be replaced. [VERIFIED: static assets and CSS]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Inline SVG/CSS is preferable to canvas for this artwork. | Alternatives / Don't Hand-Roll | Low; UI-SPEC could choose another native rendering technique, but accessibility/tests may cost more. |
| A2 | Recommended retry constants: 500 ms base, 30 s normal cap, Retry after 3 failures, ~60 s low-frequency recovery. | Architecture Pattern 1 | Medium; tune with device/UAT evidence while preserving locked capped-jittered policy. |
| A3 | Independent callbacks without serialization are the likely source of duplicate sockets. | Common Pitfalls | Low; this is a design risk, not a claim that the current code already exhibits it. |
| A4 | Hydration-only theme resolution would visibly flash the light theme. | Common Pitfalls | Medium; actual visibility varies by browser/cache, but first-paint correctness still requires pre-paint application. |

## Open Questions (RESOLVED)

1. **Shell-ready milestone — resolved:** `runtime.connected` proves attachment and starts the connected stage; sending `runtime.start` enters bootstrapping; the first verified `runtime.artifact` is the ready milestone for a cold napplet launch. Home and Account become usable after D-11's roughly three-second threshold while artifact work continues, but the ritual must not label the napplet ready before `runtime.artifact`. No new stage message is needed because the existing milestones express the required truth. [VERIFIED: codebase grep and CONTEXT.md]

2. **Canonical sign-out adapter — resolved:** add the narrow adapter at the existing verified-frame bridge: when backend account truth transitions to signed out, invoke the pinned Kehto shell publisher semantics equivalent to `publishIdentityChanged("")` and forward its canonical `identity.changed` empty-pubkey envelope only through the registered `windowId`/source-eligible frame. Do not introduce a portal-only napplet message or replace the custom runtime hub. Contract tests must assert exactly one eligible delivery, stale/foreign rejection, and canonical protected denials afterward. [VERIFIED: pinned `@kehto/shell@0.19.1` declarations and codebase]

3. **Palette and SVG authority — resolved:** Phase 3 implementation owns the exact ink/bone/electric-amber token values and the canonical node/link gate paths because no UI-SPEC exists. `components/PortalMark.tsx` is the source geometry for the ready ritual and inline shell mark; `static/logo.svg` carries the same geometry and is referenced directly as the document's standards-compatible SVG favicon, so no ICO generator or independently drawn favicon exists. Token choices are accepted only when automated checks prove WCAG AA 4.5:1 normal-text and 3:1 non-text/UI contrast in both themes and structural SVG checks prove the mark retains its defining nodes, links, and viewBox at favicon dimensions. [CITED: https://www.w3.org/TR/WCAG22/]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Deno | check/test/build | ✓ | 2.9.4 / TypeScript 6.0.3 | — [VERIFIED: local command] |
| Browser DOM APIs | island runtime | ✓ in target browser platform | Baseline widely available for cited APIs | Feature-safe System/light defaults. [CITED: MDN] |
| Fresh production WebSocket path | transport UAT | ✓ after build | Fresh 2.3.3 | Use `deno task build && deno task start`; not Vite dev. [VERIFIED: AGENTS.md] |
| Real mobile browsers | final lifecycle/safe-area UAT | Not locally probed | — | Automated fake lifecycle tests first; real-device gate remains required by QLT-04 later. [VERIFIED: REQUIREMENTS.md] |

**Missing dependencies with no fallback:** Real-device suspension/browser-chrome behavior cannot be fully proven by Deno unit tests. [VERIFIED: REQUIREMENTS.md]

**Missing dependencies with fallback:** None for implementation; native APIs and current packages suffice. [VERIFIED: codebase inspection]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Backend signer/account remains authoritative; browser gets sanitized identity only. [VERIFIED: architecture/codebase] |
| V3 Session Management | yes | Opaque reconnect token, bounded query length, same-origin upgrade, server grace/expiry, intentional teardown. [VERIFIED: routes/api/runtime.ts] |
| V4 Access Control | yes | Preserve verified iframe identity, capability checks, and canonical Kehto denial after sign-out. [VERIFIED: pinned contract and requirements] |
| V5 Input Validation | yes | Validate stored theme enum and runtime message shapes; never interpolate token/status into markup unsafely. [VERIFIED: existing parsing pattern] |
| V6 Cryptography | no new cryptography | Reuse opaque crypto-generated reconnect identifiers and verified artifact boundary; never encode authority in constellation UI. [VERIFIED: runtime/connections.ts] |

### Known Threat Patterns for Deno/Fresh + WebSocket shell

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reconnect token leakage | Information Disclosure / Spoofing | Keep token in memory only, same-origin WSS endpoint, no status-sheet/log display, enforce length bound. [VERIFIED: CONTEXT.md and route] |
| Stale socket sends after replacement | Spoofing / Tampering | Generation guard and current-socket identity check before every callback/send. [VERIFIED: current partial guard pattern] |
| Retry storm/resource exhaustion | Denial of Service | One timer/socket, full jitter, visibility/offline suppression, cap and low-frequency recovery. [CITED: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/] |
| Sign-out UI without capability revocation | Elevation of Privilege | Await backend canonical session transition; test protected denial through pinned Kehto/NAP dispatcher. [VERIFIED: CONTEXT.md] |
| Napplet overlays shell controls | Spoofing | Keep iframe exact sandbox, reserve grid row, opaque nav surface, stable z-order and safe-area. [VERIFIED: requirements/codebase] |
| Inline theme script weakens CSP | Tampering | If CSP is enabled, use a nonce/hash-compatible tiny first-party script; do not broadly add `unsafe-inline`. [CITED: https://fresh.deno.dev/docs/plugins/csp] |

## Sources

### Primary (HIGH confidence)

- Project `AGENTS.md`, `deno.json`, `islands/NappletShell.tsx`, `routes/api/runtime.ts`, `runtime/connections.ts`, `runtime/portal_runtime.ts`, and tests — current architecture and gaps.
- Pinned `node_modules/@kehto/shell@0.19.1` README and declarations — canonical identity sign-out contract.
- [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) — visibility lifecycle.
- [MDN online event](https://developer.mozilla.org/en-US/docs/Web/API/Window/online_event) and [offline event](https://developer.mozilla.org/en-US/docs/Web/API/Window/offline_event) — network hint semantics.
- [MDN prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-color-scheme), [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), and [theme-color](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/theme-color) — theme mechanism.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [WAI C39](https://www.w3.org/WAI/WCAG21/Techniques/css/C39.html) — accessibility requirements.
- [AWS Exponential Backoff and Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) — full-jitter strategy.

### Secondary (MEDIUM confidence)

- [Fresh app wrapper](https://fresh.deno.dev/docs/1.x/concepts/app-wrapper) and [modifying the head](https://fresh.deno.dev/docs/1.x/examples/modifying-the-head) — official Fresh documentation currently indexed under 1.x; the same mechanisms are verified in the installed Fresh 2.3 codebase.
- npm registry checks on 2026-07-30 — current/pinned versions and publish dates.

### Tertiary (LOW confidence)

- None beyond the four explicit implementation assumptions in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing pinned stack and native browser APIs were verified; no install is proposed.
- Architecture: HIGH — based on direct code inspection, locked decisions, and official browser/Fresh sources.
- Pitfalls: HIGH — most derive directly from current seams and authoritative lifecycle/retry/accessibility guidance; speculative items are tagged assumed.

**Research date:** 2026-07-30
**Valid until:** 2026-08-29 (stable browser APIs and pinned project versions; recheck if dependencies change)
