# Phase 3: Mobile Shell Resilience - Context

**Gathered:** 2026-07-30 **Status:** Ready for planning

<domain>
## Phase Boundary

Polish the existing mobile shell so its backend connection is truthful, legible,
accessible, and recoverable while home and napplet views share coherent themes,
portal branding, account chrome, and navigation. This phase refines the proven
backend-owned runtime and reconnect-token/grace boundary; it does not add
catalog behavior, new NAP domains, or browser-owned runtime authority.

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements

- `.planning/PROJECT.md` — Project value, backend/browser authority boundary,
  reactive constraints, and milestone direction.
- `.planning/REQUIREMENTS.md` — Phase 3 requirements SHL-01 through SHL-03 and
  CON-01 through CON-04, plus quality/security constraints.
- `.planning/ROADMAP.md` — Phase 3 goal, fixed boundary, and success criteria.

### Pinned contract authority

- `deno.json` — Production import pins, especially `@kehto/runtime@0.20.1`,
  `@napplet/core@0.31.0`, and `@napplet/nap@0.31.0`. The pinned package
  surface—not sibling source—is authoritative for sign-out identity and
  capability behavior.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `islands/NappletShell.tsx`: Existing browser transport owner, reconnect token,
  mounted iframe preservation, shell history views, notice/retry UI, primary
  navigation, account state, and sign-out command.
- `components/HomeView.tsx`: Existing home/catalog surface where the
  identity-first header can be refined without moving runtime authority into the
  route.
- `components/ProfileView.tsx`: Existing active/offline profile projection and
  account presentation patterns.
- `components/NappletFrame.tsx`: Existing verified iframe mount and explicit
  napplet message boundary; keep it mounted across Home and sign-out
  transitions.
- `assets/styles.css`, `static/logo.svg`, and `static/favicon.ico`: Existing
  global shell styling and starter branding replacement points.

### Established Patterns

- Browser transport/interactivity stays in Fresh islands; routes and components
  remain server-renderable/presentational where possible.
- `runtime/portal_runtime.ts` already projects reactive `identity.changed`
  events from backend account state.
- `routes/api/runtime.ts` and `runtime/connections.ts` already implement
  reconnect-token/grace ownership; Phase 3 extends client recovery around this
  seam rather than replacing it.
- Runtime and signer state are process-owned. The browser renders safe
  projections and sends commands but does not own authority.
- The current code already preserves the napplet iframe through shell-owned
  views; navigation and sign-out should retain that property.

### Integration Points

- Extend `islands/NappletShell.tsx` with explicit connection phases,
  visibility/online-aware backoff, intentional-close cancellation, ritual state,
  account sheet, and bottom-bar behavior.
- Keep server-side session attachment in `routes/api/runtime.ts` and grace
  semantics in `runtime/connections.ts`; add only transport projections needed
  for truthful client stages.
- Update route metadata and early theme application across `routes/_app.tsx`,
  `routes/index.tsx`, `routes/signin.tsx`, and `routes/settings.tsx` without
  duplicating theme state machines.
- Replace Fresh starter branding through `static/logo.svg`,
  `static/favicon.ico`, and shared shell CSS.

</code_context>

<specifics>
## Specific Ideas

- The visual north star combines Miyamoto Musashi's disciplined “way of the
  warrior” with a cypherpunk future around Bitcoin's final-subsidy era (commonly
  framed as roughly 2140).
- The experience should communicate resolve, sovereignty, verification, and
  long-horizon network civilization without explanatory words in the primary
  ritual.
- “Metered and measured” means actual verified stages where known and honest
  indeterminate motion where progress cannot be quantified.
- The constellation gate is not a disposable loader: it becomes the persistent
  brand mark and connection-status grammar throughout the shell.

</specifics>

<deferred>
## Deferred Ideas

- Communicating shell theme preference across the napplet boundary is deferred
  because it would require a separate NAP theme capability outside Phase 3.

</deferred>

---

_Phase: 3-Mobile Shell Resilience_ _Context gathered: 2026-07-30_
