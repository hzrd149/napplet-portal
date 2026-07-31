import type { NostrFilter } from "@napplet/core";
import type { Observable } from "npm:rxjs@7.8.2";
import { map } from "npm:rxjs@7.8.2";

export interface RelayMailboxSnapshot {
  readonly inboxes: readonly string[];
  readonly outboxes: readonly string[];
}

export interface RelayPolicySnapshot {
  readonly defaults: readonly string[];
  readonly fallbacks?: readonly string[];
  readonly blocked?: readonly string[];
  readonly auth?: readonly string[];
}

export function canonicalRelay(value: string): string | undefined {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "ws:" && url.protocol !== "wss:") return undefined;
    url.username = "";
    url.password = "";
    return url.href;
  } catch {
    return undefined;
  }
}

function canonicalSet(values: readonly string[] = []): Set<string> {
  return new Set(
    values.map(canonicalRelay).filter((url): url is string => !!url),
  );
}

function eligible(
  preferred: readonly string[],
  settings: RelayPolicySnapshot,
): readonly string[] {
  const blocked = canonicalSet(settings.blocked);
  const result: string[] = [];
  for (
    const group of [preferred, settings.defaults, settings.fallbacks ?? []]
  ) {
    for (const relay of group) {
      const canonical = canonicalRelay(relay);
      if (canonical && !blocked.has(canonical) && !result.includes(canonical)) {
        result.push(canonical);
      }
    }
    if (result.length > 0) break;
  }
  return result;
}

export function resolveReadRelays(
  mailboxes: RelayMailboxSnapshot | undefined,
  settings: RelayPolicySnapshot,
): readonly string[] {
  return eligible(mailboxes?.inboxes ?? [], settings);
}

export function resolveWriteRelays(
  mailboxes: RelayMailboxSnapshot | undefined,
  settings: RelayPolicySnapshot,
): readonly string[] {
  return eligible(mailboxes?.outboxes ?? [], settings);
}

export function resolveAuthPermission(
  relay: string,
  settings: RelayPolicySnapshot,
): boolean {
  const canonical = canonicalRelay(relay);
  if (!canonical || canonicalSet(settings.blocked).has(canonical)) return false;
  return canonicalSet(settings.auth).has(canonical);
}

export class RelayPolicy {
  constructor(readonly snapshot: RelayPolicySnapshot) {}

  read(mailboxes?: RelayMailboxSnapshot): readonly string[] {
    return resolveReadRelays(mailboxes, this.snapshot);
  }

  write(mailboxes?: RelayMailboxSnapshot): readonly string[] {
    return resolveWriteRelays(mailboxes, this.snapshot);
  }

  auth(relay: string): boolean {
    return resolveAuthPermission(relay, this.snapshot);
  }

  previewReads(
    hints: readonly string[],
    configuredReads: readonly string[],
    limit = 8,
  ): readonly string[] {
    const blocked = canonicalSet(this.snapshot.blocked);
    const result: string[] = [];
    const cap = Math.max(0, Math.min(8, Math.floor(limit)));
    for (const relay of [...hints, ...configuredReads]) {
      const canonical = canonicalRelay(relay);
      if (
        canonical && !blocked.has(canonical) && !result.includes(canonical)
      ) result.push(canonical);
      if (result.length === cap) break;
    }
    return Object.freeze(result);
  }

  filterMap<T extends Record<string, NostrFilter | readonly NostrFilter[]>>(
    source: Observable<T>,
  ): Observable<T> {
    const blocked = canonicalSet(this.snapshot.blocked);
    return source.pipe(map((value) => {
      const filtered: Record<string, NostrFilter | readonly NostrFilter[]> = {};
      for (const [relay, filters] of Object.entries(value)) {
        const canonical = canonicalRelay(relay);
        if (canonical && !blocked.has(canonical)) filtered[canonical] = filters;
      }
      return filtered as T;
    }));
  }
}
