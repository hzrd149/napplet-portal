import { App, staticFiles } from "fresh";
import { RelayPool } from "applesauce-relay";
import { AccountStore } from "./runtime/account_store.ts";
import { type IdentitySnapshot, PortalAccounts } from "./runtime/accounts.ts";
import { loadRuntimeConfig, type RuntimeConfig } from "./runtime/config.ts";
import { runtime as portalRuntime } from "./routes/api/runtime.ts";
import { SignerConnectionService } from "./runtime/signer_service.ts";
import { type State } from "./utils.ts";
import { debug as rootDebug } from "./debug.ts";

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
const signerAccounts = new PortalAccounts(
  new AccountStore(".data/accounts.json"),
  {
    remoteSignerRelays: runtimeConfig.remoteSignerRelays,
    pool: new RelayPool(),
  },
);
let restoredSignerAccounts: Promise<IdentitySnapshot> | undefined;
function restoreSignerAccounts(): Promise<IdentitySnapshot> {
  return restoredSignerAccounts ??= signerAccounts.restore();
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
    return await signerAccounts.startNostrConnect(abort);
  },
  signInBunker: async (uri) => {
    debug("restoring signer accounts before bunker sign-in");
    await restoreSignerAccounts();
    return await signerAccounts.signInBunker(uri);
  },
  signInNsec: async (privateKey) => {
    debug("restoring signer accounts before nsec sign-in");
    await restoreSignerAccounts();
    return await signerAccounts.signInNsec(privateKey);
  },
  signOut: () => {
    debug("signing out signer accounts");
    return signerAccounts.signOut();
  },
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
  return ctx.next();
});
app.fsRoutes();

console.info(startupSummary(runtimeConfig, "unavailable"));
debug("startup complete");
