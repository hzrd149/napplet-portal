const processEnv = (globalThis as unknown as {
  process?: { env?: Record<string, string | undefined> };
}).process?.env;

if (processEnv) {
  // Fresh's server bundle currently wraps npm debug's ms import as a namespace
  // object. Disabling colors avoids the formatter path that calls it directly.
  processEnv.DEBUG_COLORS = "0";
}
