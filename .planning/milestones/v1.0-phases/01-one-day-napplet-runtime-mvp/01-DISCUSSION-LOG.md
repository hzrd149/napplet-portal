# Phase 1: One-Day Napplet Runtime MVP - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-30
**Phase:** 1-One-Day Napplet Runtime MVP
**Areas discussed:** Sign-in experience, napplet launch and mobile shell, iframe/runtime interaction, stream presentation, backend account lifetime, signing and publishing, known napplet configuration, runtime configuration and cache seams

---

## Sign-in experience

| Decision | Alternatives considered | Selected |
|---|---|---|
| Entry flow | One chooser; all methods on shell; guided Nostr Connect default | Guided default |
| Nostr Connect display | QR + URI; QR-first fallback; app-handoff-first | QR + URI together |
| `nsec` treatment | Developer disclosure; dev-only label; config-gated; normal secondary option | Normal option labeled “Not recommended” |
| Active identity | Account chip; persistent panel; avatar destination | Avatar in bottom navigation |

**Notes:** Profile/settings opens from the avatar. Full account/profile management was deferred.

## Napplet launch and mobile shell

| Decision | Alternatives considered | Selected |
|---|---|---|
| Initial view | Auto-open; Home launch; limited pre-sign-in view | Auto-open configured napplet |
| Chrome | Bottom navigation; gesture fullscreen; top + bottom bars | Non-overlaying bottom navigation |
| Startup state | Portal status; branded loading; immediate iframe | Immediate iframe |
| Navigation lifecycle | Preserve iframe; restore URL; reload | Preserve mounted iframe |
| Home | Tile grid; list; featured card | Tile grid, one active napplet |
| Wider screens | Full width; phone max-width; declared width | Full available width |

**Notes:** Home/Profile are full shell views, browser Back returns Home, and the iframe has no portal header.

## Iframe/runtime interaction

| Decision | Alternatives considered | Selected |
|---|---|---|
| Handshake | Invented shell flow variants; existing package contract | Existing Kehto NAP-SHELL contract |
| Surface | Identity + stream; identity only; private fixture API | SHELL + IDENTITY + RELAY + OUTBOX |
| Unknown messages | Canonical silent drop; universal errors; strict advertised-only | Canonical behavior |
| Sandbox | `allow-scripts`; common extras; auto-grants | `allow-scripts` only |
| Artifact source | Bundled fixture; verified NIP-5A/Blossom; raw URL | Verified real napplet |
| Verification failure | Refuse; unverified override; cached fallback | Refuse and retry |

**Notes:** Kehto, napplet packages, and living NIP/NAP proposals were made canonical references.

## Stream presentation and backend runtime

| Decision | Alternatives considered | Selected |
|---|---|---|
| Stream proof | RELAY; INC fixture; COUNT | Canonical NAP-RELAY |
| Event source | Synthetic initial value; wait; direct stream | No synthetic value; Applesauce stream |
| Store behavior | Store + live; network only; OUTBOX only | Shared store + live merge |
| Relay provenance | Canonical hints; internal only; RELAY only | Canonical hints when observed |
| EOSE | Current split; remove; defer RELAY | RELAY EOSE, no OUTBOX EOSE |
| Browser transport | WebSocket; POST + SSE; per-subscription SSE | Duplex WebSocket |
| Multi-tab runtime | Shared runtime; per-tab pools; mixed | Shared backend pool/store with isolated window namespaces |

**Notes:** Hyprgate was investigated as the primary Applesauce/Kehto composition reference. A user-provided napplet owns stream presentation.

## Backend account lifetime

| Decision | Alternatives considered | Selected |
|---|---|---|
| Persistence | Reconnectable config only; complete state; pubkey only | Complete Applesauce account state |
| At-rest protection | Server encryption; filesystem permissions; passphrase | Filesystem permissions |
| Offline NIP-46 | Keep offline; sign out; read-only conversion | Keep active/offline and retry |
| Multiple stored accounts | Keep all; replace; one per method | Keep all, newest active |

## Signing and publishing

| Decision | Alternatives considered | Selected |
|---|---|---|
| Publish surface | Both; reads only; RELAY only | Both RELAY and OUTBOX |
| Approval | None; every publish; selected kinds | No Phase 1 approval UI |
| RELAY input | Unsigned; already signed; both | Already-signed event, per current package |
| OUTBOX input | Backend-signed template; signed event; defer | Backend-signed template |
| Encrypted publish | Full; unsupported; NIP-44 only | Canonical backend encryption/signing |
| Settlement | Relay acceptance; queued; any relay | Required target acceptance |

**Notes:** Unexpected signed RELAY publishes receive privacy-safe diagnostics only.

## Known napplet configuration

| Decision | Alternatives considered | Selected |
|---|---|---|
| Identity source | Server coordinate; hard-coded tuple; browser input | Environment-configured NIP-5A coordinate |
| Resolution | Defaults + hints; all explicit; hard-coded endpoints | Default relays and Blossom hints/defaults |
| Missing config | Home empty state; Profile only; startup failure | Home empty state |
| Refresh | Startup; every launch; live hot reload | Startup or explicit retry |

## Runtime configuration and cache seams

| Decision | Alternatives considered | Selected |
|---|---|---|
| Configuration | Environment; TypeScript; JSON file | Environment variables |
| Defaults | Built-ins + overrides; all explicit; relay-only defaults | Built-in relay and Blossom fallbacks |
| Local endpoints | Extra ordinary endpoints; fixed localhost; defer | Extra ordinary endpoints |
| Cache bounds | Configured eviction; unbounded; TTL | Unbounded until restart |
| Invalid URLs | Warn/continue; fail startup; fail on use | Normalize, filter, warn, continue |
| Reload | Restart; live watch; idle reload | Restart required |
| Binding | Loopback; all interfaces; private interface | Loopback by default |

## the agent's Discretion

- Visual design details within the locked shell behavior.
- Environment-variable names and documented built-in endpoint values.
- Exact short reconnect grace duration.
- Internal adapter/module naming.

## Deferred Ideas

- Full account/profile management.
- Installed napplet catalog.
- Durable event/blob caching and synchronization.
- Multi-user authentication and account isolation.
- Per-napplet approval policy.
- Additional NAP domains and an authored example napplet.
