import { createDebug, type DebugFn } from "@grammyjs/debug";

export type AppDebug = DebugFn & {
  extend(namespace: string): AppDebug;
};

function createAppDebug(namespace: string): AppDebug {
  const logger = createDebug(namespace) as AppDebug;
  logger.extend = (child) => createAppDebug(`${namespace}:${child}`);
  return logger;
}

export const debug = createAppDebug("napplet");

export function shortId(value: string | null | undefined): string {
  if (!value) return "none";
  return value.length <= 12
    ? value
    : `${value.slice(0, 8)}...${value.slice(-4)}`;
}
