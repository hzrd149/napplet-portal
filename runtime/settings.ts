import { BehaviorSubject } from "npm:rxjs@7.8.2";
import type { RuntimeConfig } from "./config.ts";
import { SettingsStore } from "./settings_store.ts";

export interface RuntimeSettings {
  readonly relays: readonly string[];
  readonly remoteSignerRelays: readonly string[];
  readonly blossomServers: readonly string[];
  readonly indexerRelays: readonly string[];
  readonly lookupRelays: readonly string[];
  readonly localRelay: string;
  readonly authRelays: readonly string[];
  readonly blockedRelays: readonly string[];
}

export type RuntimeSettingsInput =
  & Pick<
    RuntimeSettings,
    "relays" | "remoteSignerRelays" | "blossomServers"
  >
  & Partial<
    Pick<
      RuntimeSettings,
      | "indexerRelays"
      | "lookupRelays"
      | "localRelay"
      | "authRelays"
      | "blockedRelays"
    >
  >;

function endpoints(
  values: readonly string[],
  schemes: readonly string[],
  label: string,
): readonly string[] {
  const canonical = new Set<string>();
  for (const value of values) {
    try {
      const url = new URL(value.trim());
      if (!schemes.includes(url.protocol)) throw new Error();
      url.username = "";
      url.password = "";
      canonical.add(url.href);
    } catch {
      throw new Error(`Invalid ${label} endpoint`);
    }
  }
  return Object.freeze([...canonical]);
}

function normalize(settings: RuntimeSettings): RuntimeSettings {
  const localRelay = settings.localRelay.trim();
  return Object.freeze({
    relays: endpoints(settings.relays, ["ws:", "wss:"], "relay"),
    remoteSignerRelays: endpoints(
      settings.remoteSignerRelays,
      ["ws:", "wss:"],
      "remote signer relay",
    ),
    blossomServers: endpoints(
      settings.blossomServers,
      ["http:", "https:"],
      "Blossom",
    ),
    indexerRelays: endpoints(settings.indexerRelays, ["ws:", "wss:"], "relay"),
    lookupRelays: endpoints(settings.lookupRelays, ["ws:", "wss:"], "relay"),
    localRelay: localRelay
      ? endpoints([localRelay], ["ws:", "wss:"], "relay")[0]
      : "",
    authRelays: endpoints(settings.authRelays, ["ws:", "wss:"], "relay"),
    blockedRelays: endpoints(settings.blockedRelays, ["ws:", "wss:"], "relay"),
  });
}

function defaults(config: RuntimeConfig): RuntimeSettings {
  return normalize({
    relays: config.relays,
    remoteSignerRelays: config.remoteSignerRelays,
    blossomServers: config.blossomServers,
    indexerRelays: [],
    lookupRelays: [],
    localRelay: "",
    authRelays: [],
    blockedRelays: [],
  });
}

export class RuntimeSettingsService {
  readonly #store: SettingsStore;
  #saveQueue: Promise<void> = Promise.resolve();
  readonly settings$: BehaviorSubject<RuntimeSettings>;
  destroyed = false;

  private constructor(store: SettingsStore, initial: RuntimeSettings) {
    this.#store = store;
    this.settings$ = new BehaviorSubject(initial);
  }

  static async create(
    store: SettingsStore,
    config: RuntimeConfig,
  ): Promise<RuntimeSettingsService> {
    const snapshot = await store.read();
    const initial = snapshot
      ? normalize({
        ...snapshot,
        indexerRelays: snapshot.indexerRelays ?? [],
        lookupRelays: snapshot.lookupRelays ?? [],
        localRelay: snapshot.localRelay ?? "",
        authRelays: snapshot.authRelays ?? [],
        blockedRelays: snapshot.blockedRelays ?? [],
      })
      : defaults(config);
    return new RuntimeSettingsService(store, initial);
  }

  get settings(): RuntimeSettings {
    return this.settings$.value;
  }

  save(settings: RuntimeSettingsInput): Promise<void> {
    if (this.destroyed) {
      return Promise.reject(new Error("Settings service is destroyed"));
    }
    const current = this.settings;
    const next = normalize({
      ...settings,
      indexerRelays: settings.indexerRelays ?? current.indexerRelays,
      lookupRelays: settings.lookupRelays ?? current.lookupRelays,
      localRelay: settings.localRelay ?? current.localRelay,
      authRelays: settings.authRelays ?? current.authRelays,
      blockedRelays: settings.blockedRelays ?? current.blockedRelays,
    });
    const operation = this.#saveQueue.then(async () => {
      await this.#store.write({ version: 1, ...next });
      this.settings$.next(next);
    });
    this.#saveQueue = operation.catch(() => undefined);
    return operation;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.settings$.complete();
  }
}
