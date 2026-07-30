import { createDefine } from "fresh";
import type { RuntimeConfig } from "./runtime/config.ts";
import type { createPortalRuntime } from "./runtime/portal_runtime.ts";
import type { SignerConnectionService } from "./runtime/signer_service.ts";
import type { RuntimeSettingsService } from "./runtime/settings.ts";

export interface CacheHealthState {
  readonly relay: "checking" | "healthy" | "degraded";
  readonly blossom: "checking" | "healthy" | "degraded";
}

/** Browser-safe request state. Runtime authority remains process-owned. */
export interface State {
  config: RuntimeConfig;
  runtime: ReturnType<typeof createPortalRuntime>;
  signer: SignerConnectionService;
  settings: RuntimeSettingsService;
  cacheHealth: CacheHealthState;
}

export const define = createDefine<State>();
