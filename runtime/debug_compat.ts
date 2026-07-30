import { createDebug, type DebugFn } from "@grammyjs/debug";

type CompatDebug = DebugFn & {
  extend(namespace: string, delimiter?: string): CompatDebug;
};

function createCompatDebug(namespace: string): CompatDebug {
  const logger = createDebug(namespace) as CompatDebug;
  logger.extend = (child, delimiter = ":") => {
    return createCompatDebug(`${namespace}${delimiter}${child}`);
  };
  return logger;
}

export default createCompatDebug;
