# Napplet Portal

Napplet Portal is a Deno Fresh runtime for one trusted operator. A mobile
browser hosts a sandboxed napplet while the server owns account credentials,
Nostr relay connections, state, artifact verification, and NAP execution.

Phase 1 runs one configured NIP-5D napplet. The supplied Security Lab artifact
is the acceptance prerequisite; this repository intentionally does not include
an example napplet or installed-app catalog.

## Requirements and commands

Install Deno 2.9 or newer, then run:

```sh
deno task dev
deno task check
deno task test
deno task build
deno task start
```

`deno task dev` cannot serve the `/api/runtime` WebSocket with the current
latest Fresh releases, `@fresh/core` 2.3.3 and `@fresh/plugin-vite` 1.1.2. Fresh
runs the app as a Node middleware under the Vite dev server, where upgrade
requests are never routed, so the portal stays on "Preparing secure signer
connection..." until it times out. Exercise the runtime with
`deno task build && deno task
start` until a Fresh release with Vite dev-server
WebSocket upgrade support is available.

Development and production tasks bind to `127.0.0.1` unless `PORTAL_BIND` is
explicitly set to another valid host address. Both tasks resolve the address
through the same validation the runtime uses, so URL-shaped or host-port values
are rejected with a warning instead of being served. Anyone who can reach this
server acts as the same trusted operator and shares the backend's globally
active signer. There is no portal authentication or multi-user isolation in
Phase 1. Do not expose it to a LAN or the public internet without adding an
appropriate trusted access boundary.

## Configuration

Copy `.env.example` to `.env` and edit it:

```sh
cp .env.example .env
```

`deno task dev` and `deno task start` load `.env` from the project root before
the server starts. Variables already present in the real environment are never
overwritten by the file, so an exported value wins over `.env`. The
`deno task check` and `deno task test` commands deliberately ignore `.env` and
stay hermetic.

## Release verification

Run the production and browser gates from the repository root:

```sh
deno task check
deno task test
deno task build
deno test -A tests/production_multiclient_smoke_test.ts
deno run -A npm:@playwright/test@1.62.1 test tests/browser/portal_acceptance_test.ts --grep-invert "two browser pages"
deno test -A tests/requirement_traceability_test.ts
```

The four non-media local Chromium rows cover phone viewports, themes, reduced
motion, focus, history, reconnect/visibility, and intent popup behavior. The
two-page media browser row is not a release pass: after one bounded exact-
artifact closure attempt it still stops at sanitized `blob-unavailable` before
media creation. The built Deno two-client media smoke passes, but does not
replace browser playback evidence.

Before a production release, review
`.planning/phases/09-runtime-expansion-hardening/UAT-MATRIX.md`. Physical iOS
Safari and Android Chrome safe-area/background/touch/popup/autoplay checks,
public relay and public/local Blossom interoperability, target-deployment
COMMON/STORAGE behavior, and the two-page media browser row are explicitly
`NOT RUN — accepted residual risk`. Use the disposable-data scripts there; never
record signer material, reconnect tokens, authorization headers, or private
payloads.

Configuration is read once when the process starts. Restart after changing it.

| Variable                             | Meaning                                              | Default                                  |
| ------------------------------------ | ---------------------------------------------------- | ---------------------------------------- |
| `NAPPLET_COORDINATE`                 | Required NIP-5D `naddr` for the one active napplet   | Empty; Home explains how to configure it |
| `NOSTR_RELAYS`                       | Comma-separated `ws:`/`wss:` relay URLs              | Small built-in public fallback list      |
| `REMOTE_SIGNER_RELAYS`               | NIP-46 signer transport relays                       | `wss://bucket.coracle.social`            |
| `BLOSSOM_SERVERS`                    | Comma-separated `http:`/`https:` Blossom bases       | Small built-in public fallback list      |
| `PORTAL_RECONNECT_GRACE_MS`          | Detached-tab retention, from 1000 through 120000 ms  | `10000`                                  |
| `PORTAL_BIND`                        | Server bind host, without a port or URL scheme       | `127.0.0.1`                              |
| `NAPPLET_UNSAFE_SKIP_VERIFICATION`   | Unsafe local HTML mode; exactly `true` or `false`    | `false`                                  |
| `NAPPLET_UNSAFE_LOCAL_ARTIFACT_PATH` | Explicit local `.html`/`.htm` source for unsafe mode | Empty                                    |

Setting `NOSTR_RELAYS` or `BLOSSOM_SERVERS` overrides its built-in fallback
list. Local endpoints are ordinary list entries: include local and public URLs
together when both should be tried. URLs are normalized and deduplicated;
invalid schemes are rejected with a sanitized warning while other valid entries
continue. Manifest-provided Blossom hints are merged with the configured list,
and every returned blob is verified rather than trusted.

For local or private-network testing during a Blossom outage, set
`NAPPLET_UNSAFE_SKIP_VERIFICATION=true`, set
`NAPPLET_UNSAFE_LOCAL_ARTIFACT_PATH` to an explicit UTF-8 HTML file, and set
`PORTAL_BIND` to the host address used for the test, such as `100.77.91.59` for
mobile access over a trusted private network. Startup fails if unsafe mode has
no local byte source. The portal displays a persistent unsafe-mode banner, the
runtime labels the artifact `unsafe-local`, and the local bytes receive a fresh
SHA-256 identity; they are never represented as verified. The normal size and
HTML input boundaries still apply, and WebSocket origin, iframe sandbox, signer,
capability, storage, URL, and message authority remain unchanged. Never enable
this mode on an untrusted or publicly exposed interface.

No credentials belong in endpoint URLs. Environment files are gitignored, but
operators should still apply host-level secret controls. `.env.example` is
committed and must keep placeholder values only.

## Security and sensitive state

- Outside the explicitly enabled unsafe local testing mode, napplet HTML
  executes only after its manifest signature, aggregate, and every referenced
  blob pass verification. The iframe uses exactly `sandbox="allow-scripts"`,
  leaving it at an opaque origin.
- The account snapshot contains complete Applesauce signer serialization and the
  active account ID. This may include an `nsec` or Nostr Connect client
  material. Treat the snapshot as sensitive at-rest data. Atomic writes request
  restrictive directory/file modes, but actual protection ultimately relies on
  host filesystem permissions, backups, and operator access controls.
- Signer material, account serialization, event content, signatures, bunker
  values, and Nostr Connect session material never belong in browser state or
  logs.
- Startup output is allowlisted to readiness, bind address, configured napplet
  coordinate, relay/Blossom counts, and account restoration status.
- The in-memory event and verified-artifact caches are intentionally unbounded
  and are discarded on backend restart. Local relay and Blossom endpoints are
  supported as ordinary sources; durable cache synchronization is deferred.

## Delivered Phase 1 NAP boundary

- **SHELL:** source-bound `shell.ready`, exactly one `shell.init`, and only the
  supported domains injected.
- **IDENTITY:** browser-safe active/offline/unavailable updates. Sign-out
  removes signing authority while public reads may continue.
- **RELAY:** the napplet supplies one relay URL. Store values and live events
  are deduplicated, exact observed relay hints are preserved, one `relay.eose`
  marks the initial boundary, and the live tail stays open. Signed publish
  events pass unchanged; encrypted publish is encrypted and signed on the
  backend.
- **OUTBOX:** preset relays combine with user NIP-65 routing. Reads stay live
  and expose no EOSE. Unsigned templates are signed by the active backend
  account; publish succeeds only after all required per-relay outcomes settle.

NAP errors stay inside the napplet. Portal notices are reserved for connection,
session, iframe, integrity, and capability failures.

## Contract drift diagnostics

Pinned npm packages are the executable contract authority. Sibling `../kehto`
and `../napplet` checkouts are optional, mutable reference inputs only. Generate
the non-blocking diagnostic report with:

```sh
deno run -A runtime/contract_report.ts
```

The report records exact pinned versions, sibling revision availability,
per-contract status, missing public markers, and the portal adapters covered by
blocking tests. A `mismatch` or `unavailable` entry is review evidence, not a
runtime, check, test, or release failure.

## Deliberate deferrals

Later phases own the installed-app catalog, durable event/blob caches and cache
synchronization, multi-user authentication/isolation, per-napplet approval UI,
read-only account mode, example napplets, production network hardening, and NAP
domains beyond SHELL, IDENTITY, RELAY, and OUTBOX (including STORAGE, RESOURCE,
INTENT, THEME, NOTIFY, UPLOAD, LINK, INC, CONFIG, MEDIA, KEYS, VALUE, and POW).

The original sign-in → verified napplet → initial-plus-live stream tracer was
targeted as a one-day checkpoint. The complete locked Phase 1 scope has no
one-day deadline.
