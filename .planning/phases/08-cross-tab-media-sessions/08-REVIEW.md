---
phase: 08-cross-tab-media-sessions
reviewed: 2026-07-31T00:00:00Z
depth: deep
files_reviewed: 17
files_reviewed_list:
  - assets/styles.css
  - components/MediaControls.tsx
  - islands/NappletShell.tsx
  - routes/api/runtime.ts
  - runtime/connections.ts
  - runtime/media_contract.ts
  - runtime/media_reducer.ts
  - runtime/media_sessions.ts
  - runtime/portal_runtime.ts
  - runtime/transport.ts
  - tests/media_contract_test.ts
  - tests/media_lifecycle_test.ts
  - tests/media_reducer_test.ts
  - tests/media_sessions_test.ts
  - tests/media_shell_test.tsx
  - tests/media_transport_smoke_test.ts
  - tests/media_transport_test.ts
findings:
  critical: 4
  warning: 1
  info: 0
  total: 5
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-07-31T00:00:00Z
**Depth:** deep
**Files Reviewed:** 17
**Status:** issues_found

## Summary

The exact MEDIA decoder, serialized reducer, account-scoped broadcasts, lifecycle generation changes, and reducer-level stop-before-grant effect order are present. However, the browser implementation cannot actually enforce local playback revocation through the sandbox boundary, a transferred owner is never told to begin playback, initial autoplay state is optimistic rather than observed, and shell stop is incorrectly removed for sessions that omit the `stop` capability. These are release blockers for MED-01 through MED-04. The focused Phase 8 suite passes 19/19, including the production smoke, but the smoke contains a vacuous ordering assertion and omits several promised scenarios, so that pass does not close the gates below.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Shell revocation and hidden-tab stopping cross an inaccessible sandbox boundary

**File:** `islands/NappletShell.tsx:819`

**Issue:** `stopLocalMedia` reads `iframe.contentDocument` and queries its media elements. The napplet iframe is created with `sandbox="allow-scripts"` in `components/NappletFrame.tsx:165`, without `allow-same-origin`, so its document has an opaque origin. Parent access to `contentDocument` content is unavailable/throws a `SecurityError` in the production browser. The same invalid access is repeated by the autoplay retry handler at `islands/NappletShell.tsx:1705`. Consequently, `snapshot()` can fail while trying to stop a revoked owner, `hidden()` can fail before sending its truthful paused report, and the user-gesture retry cannot reach a media element. A stale or hidden tab can therefore continue playback, violating the central single-owner safety invariant.

**Fix:** Keep the opaque-origin sandbox and implement stopping/retry through the authenticated `postMessage` bridge. Send only canonical `media.command` messages (`stop`, `pause`, or `play`) to the registered current napplet window, and require the napplet owner to report the resulting canonical `media.state`. If shell-owned playback is supported, mount a shell-owned `HTMLMediaElement` outside the sandbox and retain its reference; do not inspect the iframe DOM.

### CR-02: Transfer grants authority but never enacts playback in the new owner tab

**File:** `islands/NappletShell.tsx:1154`

**Issue:** The reducer correctly emits `runtime.media.grant` after the prior-owner stop (`runtime/media_reducer.ts:347-357`), and the production route delivers it as a top-level portal frame. `receiveRuntimeMessage` handles `runtime.connected`, `runtime.event`, catalog, snapshot, result, and artifact frames, but has no `runtime.media.grant` branch. A snapshot merely changes `isOwner`; it does not send a canonical `play` command or resolve/enact a shell-owned source. Thus transfer stops A and labels B as owner without starting anything in B. The requested cross-tab playback transfer is authority-only state mutation, not a functioning media transfer.

**Fix:** Add a current-socket/current-window/current-generation grant path. For napplet-owned playback, translate a valid grant into a canonical `media.command` sent only to B's registered iframe and wait for B's truthful state report. For shell-owned playback, resolve the approved source via the Phase 5 resource seam, call the shell media element's `play()`, and report `playing` only after fulfillment. Ignore stale grants and stop locally before accepting a newer non-owner projection.

### CR-03: Create publishes `playing` before any browser playback succeeds

**File:** `runtime/media_reducer.ts:210`

**Issue:** A create with `autoplay: true` immediately records and broadcasts `status: "playing"`. No media element has been played at this point, and the shell does not invoke `MediaShellController.play()` in response to create or grant. Mobile autoplay may reject, the napplet may never start, or the owner may be disconnected, while every eligible tab still renders authoritative playing state. This directly violates the locked requirement that autoplay rejection never produce optimistic playing truth.

**Fix:** Initialize every newly created session to a non-playing canonical state (normally `stopped`). Treat `autoplay` as an enactment request to the granted owner. Transition to `playing` only after the current owner/current generation reports a successful canonical `media.state`; on rejection retain/report `paused` or `stopped` and expose the user-gesture retry.

### CR-04: Eligible tabs lose the required emergency Stop action when the owner omits a capability

**File:** `components/MediaControls.tsx:48`

**Issue:** The shell renders Stop only when `session.capabilities.includes("stop")`. The Phase 8 contract requires any eligible tab to be able to stop the authoritative session; capabilities describe owner media actions, while `runtime.media.stop` is a separate portal authority operation. `capabilities` is optional on create, so the common empty/default list produces a now-playing session with no Stop button even though the backend accepts the stop request. Users cannot terminate such playback from another tab.

**Fix:** Render the portal Stop action for every ready, nonterminal active session (subject only to pending/eligibility state). Continue using canonical capabilities for owner-directed playback controls such as seek/next/volume, but do not gate the coordinator's emergency stop operation on them.

## Warnings

### WR-01: Production smoke passes without proving its advertised ordering and race gates

**File:** `tests/media_transport_smoke_test.ts:237`

**Issue:** `stopIndex` is assigned the queue length and later checked only with `stopIndex >= 0`, which is always true; it never compares the stop frame's position with the grant frame. The first `runtime.media.result` for `transfer-1` is also left queued, so the post-duplicate lookup at lines 250-259 can consume the original result rather than prove replay behavior. Despite the plan's explicit 11-step requirement, the test has no foreign-account client, no concurrent transfer permutations, no assertion that stale A reports produce no projection, and no post-expiry command rejection. This lets transport ordering, isolation, stale-generation, and terminality regress while the named production gate remains green.

**Fix:** Record a single monotonic receive sequence across both sockets and assert `stop.sequence < grant.sequence`; consume/assert the first control result before retrying and then prove no second generation/effect. Add the promised foreign-account exclusion, both concurrent arrival orders, a negative assertion for the delayed old-generation report, and a rejected command after origin expiry. Keep event-driven bounded waits and production build/start isolation.

## Gate Verdict

- Exact pinned MEDIA envelope validation: **PASS** at the decoder boundary.
- Reducer single-owner/generation invariants: **PASS** for covered backend transitions.
- Stop-before-grant reducer effect order: **PASS** in unit coverage; production proof is **INCOMPLETE** (WR-01).
- Every accepted transition broadcast: **PASS** for covered reducer paths.
- Active-account recipient filtering: **PASS** in coordinator coverage; production foreign-account proof is **INCOMPLETE** (WR-01).
- Detach/reconnect/origin-expiry authority: **PASS** at backend lifecycle level.
- Shell revocation/hidden-tab truth: **FAIL** (CR-01).
- Transfer playback enactment: **FAIL** (CR-02).
- Autoplay truth: **FAIL** (CR-03).
- Shell transfer/stop controls: **FAIL** (CR-04).
- Production two-client smoke: **FAIL AS A GATE** (WR-01).

---

_Reviewed: 2026-07-31T00:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
