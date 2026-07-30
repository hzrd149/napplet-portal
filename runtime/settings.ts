import { BehaviorSubject } from "npm:rxjs@7.8.2";
import type { RuntimeConfig } from "./config.ts";
import {
  type RuntimeSettingsSnapshot,
  SettingsStore,
} from "./settings_store.ts";

export type RuntimeSettings = Omit<RuntimeSettingsSnapshot, "version">;

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
  });
}

function defaults(config: RuntimeConfig): RuntimeSettings {
  return normalize({
    relays: config.relays,
    remoteSignerRelays: config.remoteSignerRelays,
    blossomServers: config.blossomServers,
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
    const initial = snapshot ? normalize(snapshot) : defaults(config);
    return new RuntimeSettingsService(store, initial);
  }

  get settings(): RuntimeSettings {
    return this.settings$.value;
  }

  save(settings: RuntimeSettings): Promise<void> {
    if (this.destroyed) {
      return Promise.reject(new Error("Settings service is destroyed"));
    }
    const next = normalize(settings);
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
