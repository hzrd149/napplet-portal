import { TRANSFER_POLICY } from "./transport.ts";

export type ResolveDns = (
  hostname: string,
  recordType: "A" | "AAAA",
) => Promise<readonly string[]>;

export type ResourceDestinationClass = "public" | "local-cache";

export interface AuthorizedResourceDestination {
  readonly url: URL;
  readonly addresses: readonly string[];
  readonly destinationClass: ResourceDestinationClass;
}

interface ResourceDestinationPolicyOptions {
  readonly resolveDns?: ResolveDns;
  readonly localCacheUrl?: string;
  readonly maxUrlChars?: number;
}

export class ResourcePolicyError extends Error {
  readonly code = "blocked-by-policy" as const;

  constructor() {
    super("resource destination blocked by policy");
    this.name = "ResourcePolicyError";
  }
}

function parseIpv4(value: string): readonly number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  return octets.every((part) =>
      Number.isInteger(part) && part >= 0 && part <= 255
    )
    ? octets
    : null;
}

function forbiddenIpv4(address: readonly number[]): boolean {
  const [a, b] = address;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0) ||
    (a === 255 && b === 255);
}

function ipv6Words(input: string): readonly number[] | null {
  let value = input.toLowerCase();
  const zone = value.indexOf("%");
  if (zone >= 0) value = value.slice(0, zone);
  const lastColon = value.lastIndexOf(":");
  const dotted = value.slice(lastColon + 1);
  if (dotted.includes(".")) {
    const ipv4 = parseIpv4(dotted);
    if (!ipv4) return null;
    value = `${value.slice(0, lastColon)}:${
      ((ipv4[0] << 8) | ipv4[1]).toString(16)
    }:${((ipv4[2] << 8) | ipv4[3]).toString(16)}`;
  }
  if ((value.match(/::/g) ?? []).length > 1) return null;
  const [leftText, rightText] = value.split("::");
  const left = leftText ? leftText.split(":") : [];
  const right = rightText ? rightText.split(":") : [];
  if (!value.includes("::") && left.length !== 8) return null;
  const missing = 8 - left.length - right.length;
  if (missing < (value.includes("::") ? 1 : 0)) return null;
  const words = [...left, ...Array(missing).fill("0"), ...right].map((part) =>
    /^[0-9a-f]{1,4}$/.test(part) ? Number.parseInt(part, 16) : -1
  );
  return words.length === 8 && words.every((word) => word >= 0) ? words : null;
}

function forbiddenIpv6(words: readonly number[]): boolean {
  if (words.every((word) => word === 0)) return true;
  if (words.slice(0, 7).every((word) => word === 0) && words[7] === 1) {
    return true;
  }
  const first = words[0];
  if ((first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80) return true;
  if ((first & 0xff00) === 0xff00) return true;
  if (first === 0x2001 && words[1] === 0x0db8) return true;
  if (
    words.slice(0, 5).every((word) => word === 0) &&
    (words[5] === 0xffff || words[5] === 0)
  ) {
    const ipv4 = [words[6] >> 8, words[6] & 255, words[7] >> 8, words[7] & 255];
    return forbiddenIpv4(ipv4);
  }
  return false;
}

export function isForbiddenAddress(address: string): boolean {
  const ipv4 = parseIpv4(address);
  if (ipv4) return forbiddenIpv4(ipv4);
  const ipv6 = ipv6Words(address);
  return ipv6 ? forbiddenIpv6(ipv6) : true;
}

async function defaultResolveDns(
  hostname: string,
  recordType: "A" | "AAAA",
): Promise<readonly string[]> {
  try {
    return await Deno.resolveDns(hostname, recordType);
  } catch {
    return [];
  }
}

function canonicalOrigin(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "http:" || url.hostname !== "127.0.0.1" ||
      url.username || url.password || url.hash
    ) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export class ResourceDestinationPolicy {
  readonly #resolveDns: ResolveDns;
  readonly #localCacheOrigin?: string;
  readonly #maxUrlChars: number;

  constructor(options: ResourceDestinationPolicyOptions = {}) {
    this.#resolveDns = options.resolveDns ?? defaultResolveDns;
    this.#localCacheOrigin = canonicalOrigin(options.localCacheUrl);
    this.#maxUrlChars = options.maxUrlChars ?? TRANSFER_POLICY.maxUrlChars;
  }

  async authorize(
    input: string | URL,
    destinationClass: ResourceDestinationClass = "public",
  ): Promise<AuthorizedResourceDestination> {
    const source = String(input);
    if (!source || source.length > this.#maxUrlChars) {
      throw new ResourcePolicyError();
    }
    let url: URL;
    try {
      url = new URL(source);
    } catch {
      throw new ResourcePolicyError();
    }
    if (url.username || url.password || url.hash) {
      throw new ResourcePolicyError();
    }

    if (destinationClass === "local-cache") {
      if (!this.#localCacheOrigin || url.origin !== this.#localCacheOrigin) {
        throw new ResourcePolicyError();
      }
      return Object.freeze({
        url,
        addresses: Object.freeze(["127.0.0.1"]),
        destinationClass,
      });
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new ResourcePolicyError();
    }
    const port = url.port || (url.protocol === "https:" ? "443" : "80");
    if (port !== "80" && port !== "443") throw new ResourcePolicyError();

    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const literalV4 = parseIpv4(hostname);
    const literalV6 = hostname.includes(":") ? ipv6Words(hostname) : null;
    let addresses: readonly string[];
    if (literalV4 || literalV6) {
      addresses = [hostname];
    } else {
      const [a, aaaa] = await Promise.all([
        this.#resolveDns(hostname, "A").catch(() => []),
        this.#resolveDns(hostname, "AAAA").catch(() => []),
      ]);
      addresses = [...a, ...aaaa];
    }
    if (!addresses.length || addresses.some(isForbiddenAddress)) {
      throw new ResourcePolicyError();
    }
    return Object.freeze({
      url,
      addresses: Object.freeze([...addresses]),
      destinationClass,
    });
  }
}
