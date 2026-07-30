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

Development and production tasks bind to `127.0.0.1` unless `PORTAL_BIND` is
explicitly set. Anyone who can reach this server acts as the same trusted
operator and shares the backend's globally active signer. There is no portal
authentication or multi-user isolation in Phase 1. Do not expose it to a LAN or
the public internet without adding an appropriate trusted access boundary.

## Configuration

Configuration is read once when the process starts. Restart after changing it.

| Variable                    | Meaning                                             | Default                                  |
| --------------------------- | --------------------------------------------------- | ---------------------------------------- |
| `NAPPLET_COORDINATE`        | Required NIP-5D `naddr` for the one active napplet  | Empty; Home explains how to configure it |
| `NOSTR_RELAYS`              | Comma-separated `ws:`/`wss:` relay URLs             | Small built-in public fallback list      |
| `BLOSSOM_SERVERS`           | Comma-separated `http:`/`https:` Blossom bases      | Small built-in public fallback list      |
| `PORTAL_RECONNECT_GRACE_MS` | Detached-tab retention, from 1000 through 120000 ms | `10000`                                  |
| `PORTAL_BIND`               | Server bind address                                 | `127.0.0.1`; `::1` is also accepted      |

Setting `NOSTR_RELAYS` or `BLOSSOM_SERVERS` overrides its built-in fallback
list. Local endpoints are ordinary list entries: include local and public URLs
together when both should be tried. URLs are normalized and deduplicated;
invalid schemes are rejected with a sanitized warning while other valid entries
continue. Manifest-provided Blossom hints are merged with the configured list,
and every returned blob is verified rather than trusted.

No credentials belong in endpoint URLs. Environment files are gitignored, but
operators should still apply host-level secret controls.

## Security and sensitive state

- Napplet HTML executes only after its manifest signature, aggregate, and every
  referenced blob pass verification. The iframe uses exactly
  `sandbox="allow-scripts"`, leaving it at an opaque origin.
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

## Deliberate deferrals

Later phases own the installed-app catalog, durable event/blob caches and cache
synchronization, multi-user authentication/isolation, per-napplet approval UI,
read-only account mode, example napplets, production network hardening, and NAP
domains beyond SHELL, IDENTITY, RELAY, and OUTBOX (including STORAGE, RESOURCE,
INTENT, THEME, NOTIFY, UPLOAD, LINK, INC, CONFIG, MEDIA, KEYS, VALUE, and POW).

The original sign-in → verified napplet → initial-plus-live stream tracer was
targeted as a one-day checkpoint. The complete locked Phase 1 scope has no
one-day deadline.
