import { App, staticFiles } from "fresh";
import { loadRuntimeConfig, type RuntimeConfig } from "./runtime/config.ts";
import { runtime as portalRuntime } from "./routes/api/runtime.ts";
import { type State } from "./utils.ts";

export const runtimeConfig = loadRuntimeConfig();
export const processRuntime = portalRuntime;

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
  return ctx.next();
});
app.fsRoutes();

console.info(startupSummary(runtimeConfig, "unavailable"));
