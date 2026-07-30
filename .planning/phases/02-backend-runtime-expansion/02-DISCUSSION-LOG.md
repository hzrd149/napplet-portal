# Phase 2: Backend Runtime Expansion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-30
**Phase:** 2-Backend Runtime Expansion
**Areas discussed:** Event persistence and synchronization, Local relay and Blossom cache behavior, Operator configuration, Napplet catalog and identity, Contract verification

---

## Event persistence and synchronization

Alternatives included an embedded durable database, pluggable storage, cache-grade persistence, concurrent/adaptive reads, acknowledged cache writes, and portal-owned reconciliation.

**User's choice:** Use the optional local Nostr relay itself as the durable event store. Read local through EOSE, fall back upstream using Applesauce timeouts, deliver immediately, asynchronously cache every valid observed upstream event, and retain Applesauce live-store semantics.
**Notes:** The user asked research and planning to follow official Applesauce examples, including its customizable Relay/RelayPool timeout.

---

## Local relay and Blossom cache behavior

Alternatives included portal-owned mirroring, local lookup without population, required write-through, configuration-only discovery, and uniform hash verification.

**User's choice:** Follow the standard local Blossom proxy model with BUD-10 hints and automatic loopback discovery; fall back to portal-owned upstream retrieval if the proxy fails.
**Notes:** Ordinary media from a healthy loopback cache may be trusted, but Phase 1's executable-artifact verification remains mandatory.

---

## Operator configuration

Alternatives included startup-only environment configuration, config-file reload, explicit read/write relay roles, forced stream restarts, and automatic or prompted relay AUTH.

**User's choice:** Use backend-persisted settings for fallback/extra and indexer/lookup relays, prefer Applesauce reactive lists, keep NIP-65 routing automatic, apply changes reactively, and require per-relay AUTH opt-in.
**Notes:** User-blocked relays override every routing source and AUTH permission.

---

## Napplet catalog and identity

Alternatives included portal database records, pinned artifact snapshots, per-napplet events, encrypted content, automatic manifest updates, catalog merging, disabled entries, and raw/simple update prompts.

**User's choice:** Store one public replaceable NIP-78 catalog event with minimal coordinate and accepted-manifest references. Latest event wins; updates require approval; uninstall retains cached artifacts.
**Notes:** Approval presents identity, integrity, and capability changes. Accepted verified manifests own runtime identity.

---

## Contract verification

Alternatives included sibling packages as executable authorities, spec-only fixtures, blocking drift, type-only tests, E2E-only tests, console warnings, and runtime diagnostics.

**User's choice:** Treat pinned npm packages as executable authority, use siblings for non-blocking drift diagnostics, test types/wire/lifecycle behavior, retain an E2E smoke test, and emit a structured report.

## the agent's Discretion

- Exact settings persistence mechanism and UI styling.
- Exact cache-health presentation and timeout value.
- Exact NIP-78 application identifier and encoding.

## Deferred Ideas

None.
