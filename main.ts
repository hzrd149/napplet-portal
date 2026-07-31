import { App, staticFiles } from "fresh";
import { RelayPool } from "applesauce-relay";
import { AccountStore } from "./runtime/account_store.ts";
import { type IdentitySnapshot, PortalAccounts } from "./runtime/accounts.ts";
import { loadRuntimeConfig, type RuntimeConfig } from "./runtime/config.ts";
import { runtime as portalRuntime } from "./routes/api/runtime.ts";
import { SignerConnectionService } from "./runtime/signer_service.ts";
import { type State } from "./utils.ts";
import { debug as rootDebug } from "./debug.ts";
import { RuntimeSettingsService } from "./runtime/settings.ts";
import { SettingsStore } from "./runtime/settings_store.ts";
import { discoverLocalBlossom } from "./runtime/blossom_cache.ts";
import type { CacheHealthState } from "./utils.ts";
import { CatalogSyncOwner } from "./runtime/event_runtime.ts";
import { CatalogService } from "./runtime/catalog.ts";
import { RelayPolicy } from "./runtime/relay_policy.ts";
import { map } from "npm:rxjs@7.8.2";
import { ResourceService } from "./runtime/resource_service.ts";
import {
  BlossomTransferAdapter,
  BlossomTransferService,
} from "./runtime/blossom_transfer.ts";
import { NapDispatcher } from "./runtime/nap_dispatcher.ts";

const debug = rootDebug.extend("backend");

export const runtimeConfig = loadRuntimeConfig();
debug(
  "loaded runtime config bind=%s coordinate=%s relays=%d signerRelays=%d blossom=%d reconnectGraceMs=%d",
  runtimeConfig.bind,
  runtimeConfig.coordinate ? "configured" : "empty",
  runtimeConfig.relays.length,
  runtimeConfig.remoteSignerRelays.length,
  runtimeConfig.blossomServers.length,
  runtimeConfig.reconnectGraceMs,
);
export const processRuntime = portalRuntime;
export const runtimeSettings = await RuntimeSettingsService.create(
  new SettingsStore(".data/settings.json"),
  runtimeConfig,
);
let cacheHealthState: CacheHealthState = {
  relay: runtimeSettings.settings.localRelay ? "checking" : "degraded",
  blossom: "checking",
};
runtimeSettings.settings$.subscribe((settings) => {
  cacheHealthState = {
    ...cacheHealthState,
    relay: settings.localRelay ? "checking" : "degraded",
  };
});
const localBlossom = await discoverLocalBlossom();
cacheHealthState = {
  ...cacheHealthState,
  blossom: localBlossom ? "healthy" : "degraded",
};
const signerAccounts = new PortalAccounts(
  new AccountStore(".data/accounts.json"),
  {
    remoteSignerRelays: runtimeConfig.remoteSignerRelays,
    pool: new RelayPool(),
  },
);
let restoredSignerAccounts: Promise<IdentitySnapshot> | undefined;
function restoreSignerAccounts(): Promise<IdentitySnapshot> {
  return restoredSignerAccounts ??= signerAccounts.restore().catch((error) => {
    restoredSignerAccounts = undefined;
    throw error;
  });
}
function cacheRestoredSignerAccounts(
  identity: IdentitySnapshot,
): IdentitySnapshot {
  restoredSignerAccounts = Promise.resolve(identity);
  return identity;
}
export const signerService = new SignerConnectionService({
  identity$: signerAccounts.identity$,
  restore: async () => {
    debug("restoring signer accounts for runtime state");
    return await restoreSignerAccounts();
  },
  startNostrConnect: async (abort) => {
    debug("restoring signer accounts before nostr connect");
    await restoreSignerAccounts();
    debug("starting signer accounts nostr connect");
    const pending = await signerAccounts.startNostrConnect(abort);
    return {
      uri: pending.uri,
      connected: pending.connected.then(cacheRestoredSignerAccounts),
    };
  },
  signInBunker: async (uri) => {
    debug("restoring signer accounts before bunker sign-in");
    await restoreSignerAccounts();
    return cacheRestoredSignerAccounts(await signerAccounts.signInBunker(uri));
  },
  signInNsec: async (privateKey) => {
    debug("restoring signer accounts before nsec sign-in");
    await restoreSignerAccounts();
    return cacheRestoredSignerAccounts(
      await signerAccounts.signInNsec(
        privateKey,
      ),
    );
  },
  signOut: () => {
    debug("signing out signer accounts");
    restoredSignerAccounts = undefined;
    return signerAccounts.signOut();
  },
});
const catalogService = new CatalogService({
  eventStore: processRuntime.eventRuntime.eventStore,
  identity: () => signerAccounts.identity,
  resolveVerifiedArtifact: (coordinate, manifestEventId) =>
    processRuntime.resolveCatalogArtifact(coordinate, manifestEventId),
  relayPolicy: new RelayPolicy({
    defaults: runtimeSettings.settings.relays,
    blocked: runtimeSettings.settings.blockedRelays,
  }),
  configuredReadRelays: () => runtimeSettings.settings.relays,
  resolvePreviewArtifact: (coordinate, relays) =>
    processRuntime.resolveCatalogPreview(coordinate, relays),
  signEvent: (template) => signerAccounts.signEvent(template),
  publish: async (event) => {
    const relays = runtimeSettings.settings.relays;
    const results = await processRuntime.eventRuntime.relayPool.publish(
      [...relays],
      event,
    );
    return results.map((result, index) => ({
      relay: relays[index] ?? "unknown",
      accepted: result.ok,
    }));
  },
});
processRuntime.configureCatalog(catalogService);
const resourceService = new ResourceService({ localCacheUrl: localBlossom });
const blossomTransfer = new BlossomTransferService({
  uploader: new BlossomTransferAdapter({
    signEvent: (template) => signerAccounts.signEvent(template),
  }),
});
export const napDispatcher = new NapDispatcher({
  resource: resourceService,
  transfer: blossomTransfer,
  settings: () => ({
    blossomServers: runtimeSettings.settings.blossomServers.filter((value) => {
      try {
        const host = new URL(value).hostname;
        return host !== "localhost" && host !== "::1" &&
          !host.startsWith("127.");
      } catch {
        return false;
      }
    }),
    localBlossom,
  }),
  send: (owner, message, bytes) =>
    processRuntime.deliverTransfer(owner, message, bytes),
});
processRuntime.configureTransfers(napDispatcher);
export const catalogSync = new CatalogSyncOwner({
  eventRuntime: processRuntime.eventRuntime,
  catalog: catalogService,
  identity$: signerAccounts.identity$,
  configuredReads$: runtimeSettings.settings$.pipe(
    map((value) => value.relays),
  ),
  relayPolicy: (relays) =>
    new RelayPolicy({
      defaults: relays,
      blocked: runtimeSettings.settings.blockedRelays,
    }),
});
void signerService.restore().catch((error) => {
  debug(
    "startup account restore failed error=%s",
    error instanceof Error ? error.message : "unknown",
  );
});

export function startupSummary(
  config: RuntimeConfig,
  accountRestoration: "active" | "offline" | "unavailable",
): string {
  const coordinate = config.coordinate || "not configured";
  return [
    "Napplet Portal ready",
    `bind=${config.bind}`,
    `coordinate=${coordinate}`,
    `relays=${config.relays.length}`,
    `blossom=${config.blossomServers.length}`,
    `account=${accountRestoration}`,
  ].join(" ");
}

export const app = new App<State>();

app.use(staticFiles());
app.use((ctx) => {
  ctx.state.config = runtimeConfig;
  ctx.state.runtime = portalRuntime;
  ctx.state.signer = signerService;
  ctx.state.settings = runtimeSettings;
  ctx.state.cacheHealth = cacheHealthState;
  return ctx.next();
});
app.fsRoutes();

console.info(startupSummary(runtimeConfig, "unavailable"));
debug("startup complete");
