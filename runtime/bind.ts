import { loadBindAddress } from "./config.ts";

// `deno serve` only accepts its bind address on the command line, so the
// `start:server` task substitutes this program's output. A rejected
// `PORTAL_BIND` warns on stderr and falls back to loopback, keeping the address
// that is actually served and the one reported by the startup summary equal.
console.log(loadBindAddress());
