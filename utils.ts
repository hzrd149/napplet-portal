import { createDefine } from "fresh";
import type { RuntimeConfig } from "./runtime/config.ts";
import type { createPortalRuntime } from "./runtime/portal_runtime.ts";
import type { SignerConnectionService } from "./runtime/signer_service.ts";

/** Browser-safe request state. Runtime authority remains process-owned. */
export interface State {
  config: RuntimeConfig;
  runtime: ReturnType<typeof createPortalRuntime>;
  signer: SignerConnectionService;
}

export const define = createDefine<State>();
