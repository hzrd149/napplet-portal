import { injectNappletNamespacePrelude } from "@kehto/shell";
import type { NostrEvent } from "@napplet/core";
import { verifyEvent } from "nostr-tools";
import type { RelaySubscribeMessage } from "@napplet/nap/relay";
import { debug as rootDebug, shortId } from "../debug.ts";
import { MediaSessionCoordinator } from "./media_sessions.ts";
import { AccountRuntime } from "./accounts.ts";
import {
  loadUnsafeLocalArtifact,
  PortalArtifactResolver,
  resolveVerifiedArtifact,
} from "./artifacts.ts";
import { BlossomCache } from "./blossom_cache.ts";
import { ConnectionRegistry } from "./connections.ts";
import { createEventRuntime, type EventRuntime } from "./event_runtime.ts";
import { TracerRelayAdapter } from "./relay_adapter.ts";
import type { RuntimeSettingsService } from "./settings.ts";
import type { CatalogService } from "./catalog.ts";
import { decodeArchetypeDeclarations } from "./catalog.ts";
import { IntentService } from "./intent.ts";
import type {
  CatalogCommand,
  IntentCommand,
  IntentNavigationMessage,
} from "./transport.ts";
import { isExactWindowAuthority } from "./nap_dispatcher.ts";
import type {
  DispatcherMessage,
  NapDispatcher,
  NapOwner,
  WindowCapabilityContext,
} from "./nap_dispatcher.ts";

export function isCurrentTransferRecipient(
  candidate: {
    readonly connectionId: string;
    readonly windowId: string;
    readonly generation?: number;
    readonly account?: string;
    readonly napplet?: string;
  },
  current: WindowCapabilityContext | undefined,
): boolean {
  if (
    !current || candidate.connectionId !== current.connectionId ||
    candidate.windowId !== current.windowId ||
    (candidate.generation !== undefined &&
      candidate.generation !== current.generation) ||
    (candidate.account !== undefined &&
      candidate.account !== current.accountPubkey)
  ) return false;
  if (candidate.napplet === undefined) return true;
  return candidate.napplet === `${current.dTag}@${current.aggregateHash}` ||
    candidate.napplet === `${current.coordinate}@${current.manifestEventId}`;
}

const debug = rootDebug.extend("runtime");

interface Fixture {
  readonly coordinate: string;
  readonly identity: { readonly aggregateHash: string };
  readonly manifestEvent: NostrEvent;
  readonly artifact: { readonly servers: readonly string[] };
  readonly events: { readonly initial: NostrEvent };
}

export interface RuntimeEvent {
  readonly type: string;
  readonly message?: Record<string, unknown>;
}

class RuntimeEvents {
  readonly #listeners = new Set<(event: RuntimeEvent) => void>();

  subscribe(listener: (event: RuntimeEvent) => void): () => void {
    this.#listeners.add(listener);
    debug("event listener subscribed count=%d", this.#listeners.size);
    return () => this.#listeners.delete(listener);
  }

  emit(event: RuntimeEvent): void {
    debug(
      "event emitted type=%s listeners=%d",
      event.type,
      this.#listeners.size,
    );
    for (const listener of this.#listeners) listener(event);
  }
}

interface PortalRuntimeOptions {
  readonly fixture: Fixture;
  readonly settings?: RuntimeSettingsService;
  readonly eventRuntime?: EventRuntime;
  readonly unsafeLocalArtifactPath?: string;
}

export interface ProductionCatalogResolverOptions {
  readonly eventRuntime: EventRuntime;
  readonly blossomServers: () => readonly string[];
  readonly fetchBytes?: (url: string) => Promise<Uint8Array>;
}

export function createProductionCatalogResolver(
  options: ProductionCatalogResolverOptions,
) {
  return async (
    coordinate: string,
    manifestEventId: string | undefined,
    relays: readonly string[],
  ) => {
    const match = /^35129:([0-9a-f]{64}):([^:\s]+)$/.exec(coordinate);
    if (!match) throw new Error("invalid named manifest coordinate");
    const event = await options.eventRuntime.loadManifest(
      coordinate,
      relays,
      manifestEventId,
    );
    if (!event) throw new Error("manifest event unavailable");
    const dTags = event.tags.filter((tag) => tag[0] === "d");
    if (
      event.kind !== 35129 || event.pubkey !== match[1] ||
      dTags.length !== 1 || dTags[0].length !== 2 || dTags[0][1] !== match[2] ||
      (manifestEventId !== undefined && event.id !== manifestEventId) ||
      !verifyEvent(event)
    ) throw new Error("manifest identity mismatch");
    const resolver = new PortalArtifactResolver({
      coordinate,
      manifestEventId,
      relays,
      blossomServers: options.blossomServers(),
      resolveManifest: () => Promise.resolve(event),
      fetchBytes: options.fetchBytes,
    });
    const resolved = await resolver.resolve();
    if (resolved.state !== "ready") throw new Error("manifest unavailable");
    return Object.freeze({
      manifestEventId: event.id,
      title: event.tags.find((tag) => tag[0] === "title")?.[1] ??
        resolved.identity.dTag,
      version: String(event.created_at),
      capabilities: Object.freeze([...resolved.resolved.manifest.requires]),
      declarations: decodeArchetypeDeclarations(event.tags),
      launch: Object.freeze({
        dTag: resolved.identity.dTag,
        aggregateHash: resolved.identity.aggregateHash,
        srcdoc: injectNappletNamespacePrelude(resolved.srcdoc, {
          domains: [...resolved.grantedDomains],
        }),
      }),
    });
  };
}

export function createPortalRuntime(
  {
    fixture,
    settings,
    eventRuntime = createEventRuntime(),
    unsafeLocalArtifactPath,
  }: PortalRuntimeOptions,
) {
  debug(
    "create portal runtime fixture=%s",
    shortId(fixture.identity.aggregateHash),
  );
  const accounts = new AccountRuntime();
  const connections = new ConnectionRegistry();
  const relay = new TracerRelayAdapter(fixture.events.initial);
  const events = new RuntimeEvents();
  const blossomCache = new BlossomCache();
  const productionCatalogResolver = settings
    ? createProductionCatalogResolver({
      eventRuntime,
      blossomServers: () => settings.settings.blossomServers,
    })
    : undefined;
  let destroyed = false;
  let catalog: CatalogService | undefined;
  let intents: IntentService | undefined;
  let dispatcher: NapDispatcher | undefined;
  const windowAuthorities = new Map<string, WindowCapabilityContext>();
  const windowAuthorityGenerations = new Map<string, number>();
  const transferSends = new Map<
    string,
    (
      message: Record<string, unknown>,
      bytes?: readonly Uint8Array[],
    ) => void
  >();
  const media = new MediaSessionCoordinator({
    deliver: (recipient, message) => {
      const send = transferSends.get(recipient.windowId);
      if (!send) return false;
      send(message as unknown as Record<string, unknown>);
      return true;
    },
  });
  let mediaAccountEpoch = 0;

  return {
    events,
    relay,
    media,
    get mediaAccountEpoch() {
      return mediaAccountEpoch;
    },
    eventRuntime,
    configureCatalog(service: CatalogService): IntentService {
      intents?.destroy();
      catalog = service;
      intents = new IntentService(service, {
        account: () => accounts.active?.pubkey ?? null,
        sendNavigation: (message, owner) => {
          transferSends.get(owner.windowId)?.(
            message as unknown as Record<string, unknown>,
          );
        },
      });
      return intents;
    },
    configureTransfers(service: NapDispatcher): void {
      dispatcher = service;
      service.setAuthorityValidator((candidate) => {
        const generationIsCurrent =
          windowAuthorityGenerations.get(candidate.windowId) ===
            candidate.generation;
        return generationIsCurrent && isExactWindowAuthority(
          windowAuthorities.get(candidate.windowId),
          candidate,
          accounts.active?.pubkey,
          (coordinate, manifestEventId) =>
            (catalog as { acceptsManifest?: CatalogService["acceptsManifest"] })
              ?.acceptsManifest?.(coordinate, manifestEventId) ?? true,
        );
      });
    },
    deliverTransfer(
      owner: NapOwner,
      message: Record<string, unknown>,
      bytes?: readonly Uint8Array[],
    ): void {
      if (
        !isCurrentTransferRecipient(
          owner,
          windowAuthorities.get(owner.windowId),
        )
      ) return;
      transferSends.get(owner.windowId)?.(message, bytes);
    },
    detachMediaConnection(connectionId: string, windowId: string): void {
      media.detach({ connectionId, windowId });
    },
    expireMediaOrigin(connectionId: string, windowId: string): void {
      media.expireOrigin({ connectionId, windowId });
    },
    destroyWindow(windowId: string): void {
      transferSends.delete(windowId);
      windowAuthorities.delete(windowId);
      dispatcher?.abortWindow(windowId);
      intents?.abortWindow(windowId);
      connections.remove(windowId);
    },
    get activeAccount() {
      return accounts.active;
    },
    signIn: (pubkey: string) => {
      const previous = accounts.active?.pubkey;
      if (previous !== pubkey) {
        if (previous) media.changeAccount(previous);
        mediaAccountEpoch++;
      }
      return accounts.signIn(pubkey);
    },
    signOut: () => {
      const previous = accounts.active?.pubkey;
      if (previous) media.changeAccount(previous);
      mediaAccountEpoch++;
      for (const windowId of transferSends.keys()) {
        dispatcher?.abortWindow(windowId);
      }
      windowAuthorities.clear();
      for (const windowId of transferSends.keys()) {
        intents?.abortWindow(windowId);
      }
      return accounts.signOut();
    },
    loadEvent: (id: string) => {
      if (!settings) throw new Error("runtime settings unavailable");
      return eventRuntime.loadEvent(id, settings.settings.relays);
    },
    resolveArtifact: async () => {
      debug(
        "resolve artifact started verification=%s",
        unsafeLocalArtifactPath ? "unsafe-local" : "verified",
      );
      const resolved = unsafeLocalArtifactPath
        ? await loadUnsafeLocalArtifact(fixture, unsafeLocalArtifactPath)
        : {
          ...await resolveVerifiedArtifact(
            fixture,
            fetch,
            settings?.settings.blossomServers ?? fixture.artifact.servers,
            blossomCache,
          ),
          verification: "verified" as const,
        };
      debug(
        "resolve artifact complete dTag=%s aggregate=%s",
        resolved.dTag,
        shortId(resolved.aggregateHash),
      );
      return {
        ...resolved,
        indexHtml: injectNappletNamespacePrelude(resolved.indexHtml, {
          domains: ["identity", "relay"],
        }),
      };
    },
    resolveCatalogArtifact: async (
      coordinate: string,
      manifestEventId: string,
    ) => {
      if (productionCatalogResolver && /^35129:/.test(coordinate)) {
        return await productionCatalogResolver(
          coordinate,
          manifestEventId,
          settings!.settings.relays,
        );
      }
      if (
        coordinate !== fixture.coordinate ||
        manifestEventId !== fixture.manifestEvent.id
      ) throw new Error("catalog artifact is unavailable");
      const resolved = await resolveVerifiedArtifact(
        fixture,
        fetch,
        settings?.settings.blossomServers ?? fixture.artifact.servers,
        blossomCache,
      );
      const title = fixture.manifestEvent.tags.find((tag) => tag[0] === "title")
        ?.[1] ?? resolved.dTag;
      return {
        manifestEventId,
        title,
        version: String(fixture.manifestEvent.created_at),
        capabilities: Object.freeze([...resolved.manifest.requires]),
        declarations: decodeArchetypeDeclarations(fixture.manifestEvent.tags),
        launch: Object.freeze({
          dTag: resolved.dTag,
          aggregateHash: resolved.aggregateHash,
          srcdoc: injectNappletNamespacePrelude(resolved.indexHtml, {
            domains: ["identity", "relay"],
          }),
        }),
      };
    },
    resolveCatalogPreview: (
      coordinate: string,
      relays: readonly string[],
    ) => {
      if (!productionCatalogResolver) {
        throw new Error("production catalog resolver unavailable");
      }
      return productionCatalogResolver(coordinate, undefined, relays);
    },
    openWindow(
      connectionId: string,
      windowId: string,
      source: object,
      sendTransfer?: (
        message: Record<string, unknown>,
        bytes?: readonly Uint8Array[],
      ) => void,
    ) {
      debug(
        "open tracer window connection=%s window=%s",
        shortId(connectionId),
        shortId(windowId),
      );
      connections.register(connectionId, windowId, source);
      if (sendTransfer) transferSends.set(windowId, sendTransfer);
      const activeMediaAccount = accounts.active?.pubkey;
      if (activeMediaAccount) {
        media.connect(activeMediaAccount, { connectionId, windowId });
      }
      let initialized = false;
      let verifiedNapplet: string | undefined;
      let authority: WindowCapabilityContext | undefined;
      const registerLaunchAuthority = (value: {
        readonly coordinate: string;
        readonly manifestEventId: string;
        readonly dTag: string;
        readonly aggregateHash: string;
        readonly capabilities: readonly string[];
      }): boolean => {
        const accountPubkey = accounts.active?.pubkey;
        if (!accountPubkey) return false;
        const generation = (windowAuthorityGenerations.get(windowId) ?? 0) + 1;
        windowAuthorityGenerations.set(windowId, generation);
        authority = Object.freeze({
          connectionId,
          windowId,
          accountPubkey,
          coordinate: value.coordinate,
          manifestEventId: value.manifestEventId,
          dTag: value.dTag,
          aggregateHash: value.aggregateHash,
          grantedDomains: Object.freeze([
            ...new Set(
              value.capabilities.map((capability) => capability.split(".")[0]),
            ),
          ]),
          grantedCapabilities: Object.freeze([...value.capabilities]),
          instanceId: crypto.randomUUID(),
          generation,
        });
        windowAuthorities.set(windowId, authority);
        dispatcher?.authorizeWindow(windowId);
        return true;
      };
      return {
        replayIdentity() {
          const active = accounts.active;
          transferSends.get(windowId)?.({
            type: "identity.changed",
            identity: active
              ? {
                accountId: active.pubkey,
                pubkey: active.pubkey,
                status: active.status,
              }
              : { accountId: null, pubkey: null, status: "unavailable" },
          });
        },
        media(message: unknown, generation?: number) {
          const accountId = accounts.active?.pubkey;
          if (!accountId) {
            return { accepted: false, reason: "no-active-account" } as const;
          }
          media.connect(accountId, { connectionId, windowId });
          return media.receive(accountId, { connectionId, windowId }, message, {
            generation,
          });
        },
        mediaSnapshot() {
          const accountId = accounts.active?.pubkey;
          if (!accountId) {
            return { accountEpoch: mediaAccountEpoch, session: null } as const;
          }
          media.connect(accountId, { connectionId, windowId });
          const current = media.current(accountId);
          if (!current) {
            return { accountEpoch: mediaAccountEpoch, session: null } as const;
          }
          const { accountId: _accountId, type: _type, ...session } = current;
          return { accountEpoch: mediaAccountEpoch, session } as const;
        },
        mediaTransfer(
          sessionId: string,
          generation: number,
          requestId: string,
        ) {
          const accountId = accounts.active?.pubkey;
          if (!accountId) {
            return { accepted: false, reason: "no-active-account" };
          }
          media.connect(accountId, { connectionId, windowId });
          return media.transfer(
            accountId,
            { connectionId, windowId },
            sessionId,
            generation,
            requestId,
          );
        },
        mediaStop(sessionId: string, generation: number, requestId: string) {
          const accountId = accounts.active?.pubkey;
          if (!accountId) {
            return { accepted: false, reason: "no-active-account" };
          }
          media.connect(accountId, { connectionId, windowId });
          return media.stop(
            accountId,
            { connectionId, windowId },
            sessionId,
            generation,
            requestId,
          );
        },
        intentQuery(command: IntentCommand) {
          if (!intents) return;
          if (command.type === "intent.available") {
            transferSends.get(windowId)?.({
              type: "intent.available.result",
              id: command.id,
              availability: intents.available(command.archetype),
            });
          } else if (command.type === "intent.handlers") {
            transferSends.get(windowId)?.({
              type: "intent.handlers.result",
              id: command.id,
              handlers: [...intents.handlers()],
            });
          }
        },
        reserveIntent(
          reservation: Extract<
            IntentNavigationMessage,
            { type: "intent.navigation.reserve" }
          >,
          command: Extract<IntentCommand, { type: "intent.invoke" }>,
        ) {
          return intents?.reserve(
            { connectionId, windowId },
            reservation,
            command,
            (message) =>
              transferSends.get(windowId)?.(
                message as unknown as Record<string, unknown>,
              ),
          );
        },
        acknowledgeIntent(
          ack: Extract<
            IntentNavigationMessage,
            { type: "intent.navigation.ack" }
          >,
        ) {
          return intents?.acknowledge({ connectionId, windowId }, ack) ?? false;
        },
        claimIntentTicket(
          claim: Extract<
            IntentNavigationMessage,
            { type: "intent.ticket.claim" }
          >,
        ) {
          return intents?.claim({ connectionId, windowId }, claim) ?? null;
        },
        verifyNapplet(identity: { dTag: string; aggregateHash: string }) {
          verifiedNapplet = `${identity.dTag}@${identity.aggregateHash}`;
        },
        registerVerifiedLaunch(value: {
          readonly coordinate: string;
          readonly manifestEventId: string;
          readonly dTag: string;
          readonly aggregateHash: string;
          readonly capabilities: readonly string[];
        }) {
          return registerLaunchAuthority(value);
        },
        dispatchTransfer(message: DispatcherMessage): Promise<void> {
          const account = accounts.active?.pubkey;
          if (!dispatcher || !account) {
            return Promise.resolve();
          }
          if (
            message.type.startsWith("common.") ||
            message.type.startsWith("storage.")
          ) {
            if (!authority) {
              const id = "id" in message && typeof message.id === "string"
                ? message.id
                : "invalid";
              const type = `${message.type}.result`;
              transferSends.get(windowId)?.({
                type,
                id,
                error: "not-authorized",
                ...(message.type === "storage.get" ? { value: null } : {}),
              });
              return Promise.resolve();
            }
            return dispatcher.dispatch(authority, message);
          }
          if (!verifiedNapplet) return Promise.resolve();
          return dispatcher.dispatch({
            connectionId,
            windowId,
            napplet: verifiedNapplet,
            account,
          }, message);
        },
        catalog: () =>
          catalog?.project() ??
            Promise.resolve({
              catalogEventId: null,
              entries: [],
              status: "idle",
            }),
        catalogCommand: async (command: CatalogCommand) => {
          if (!catalog) throw new Error("catalog service unavailable");
          switch (command.type) {
            case "catalog.preview":
              return catalog.previewInstall(command.naddr);
            case "catalog.approve": {
              const result = await catalog.approveManifestUpdate(
                command.id,
                command.coordinate,
                command.manifestEventId,
                command.sourceCatalogEventId,
              );
              if (result.ok) revokeObsoleteAuthorities(command.coordinate);
              return result;
            }
            case "catalog.uninstall": {
              const result = await catalog.uninstallNapplet(
                command.id,
                command.coordinate,
              );
              if (result.ok) revokeObsoleteAuthorities(command.coordinate);
              return result;
            }
            case "catalog.launch": {
              const result = await catalog.launch(
                command.catalogEventId,
                command.coordinate,
                command.manifestEventId,
              );
              if (result.ok) {
                const value = result.value;
                registerLaunchAuthority({
                  coordinate: command.coordinate,
                  manifestEventId: value.manifestEventId,
                  dTag: value.launch.dTag,
                  aggregateHash: value.launch.aggregateHash,
                  capabilities: value.capabilities,
                });
              }
              return result;
            }
          }
        },
        subscribeCatalog: (listener: () => void) =>
          catalog?.subscribe(listener) ?? (() => undefined),
        receive(candidate: object, message: { readonly type?: unknown }) {
          if (!connections.owns(connectionId, windowId, candidate)) {
            debug(
              "ignored foreign tracer message connection=%s window=%s type=%s",
              shortId(connectionId),
              shortId(windowId),
              String(message.type),
            );
            return;
          }
          if (message.type !== "shell.ready" || initialized) {
            debug(
              "ignored tracer message connection=%s window=%s type=%s initialized=%s",
              shortId(connectionId),
              shortId(windowId),
              String(message.type),
              initialized,
            );
            return;
          }
          initialized = true;
          debug(
            "tracer shell initialized connection=%s window=%s",
            shortId(connectionId),
            shortId(windowId),
          );
          events.emit({
            type: "shell.init",
            message: {
              type: "shell.init",
              capabilities: { domains: ["identity", "relay"] },
              services: ["identity", "relay"],
            },
          });
        },
        subscribeRelay(
          message: RelaySubscribeMessage,
          listener: Parameters<TracerRelayAdapter["subscribe"]>[1],
        ) {
          debug(
            "tracer relay subscribe connection=%s window=%s sub=%s",
            shortId(connectionId),
            shortId(windowId),
            message.subId,
          );
          return relay.subscribe(message, listener);
        },
      };

      function revokeObsoleteAuthorities(coordinate: string): void {
        for (const [authorityWindowId, candidate] of windowAuthorities) {
          if (
            candidate.coordinate !== coordinate ||
            (catalog as { acceptsManifest?: CatalogService["acceptsManifest"] })
                ?.acceptsManifest?.(coordinate, candidate.manifestEventId) ===
              true
          ) continue;
          windowAuthorities.delete(authorityWindowId);
          dispatcher?.abortWindow(authorityWindowId);
        }
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      media.destroy();
      dispatcher?.destroy();
      intents?.destroy();
      windowAuthorities.clear();
      transferSends.clear();
      eventRuntime.destroy();
      settings?.destroy();
    },
  };
}
