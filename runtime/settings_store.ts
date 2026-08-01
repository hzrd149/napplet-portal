import { debug as rootDebug } from "../debug.ts";
import { writeFileAtomically } from "./atomic_file.ts";

const debug = rootDebug.extend("settings-store");

export interface RuntimeSettingsSnapshot {
  readonly version: 1;
  readonly relays: readonly string[];
  readonly remoteSignerRelays: readonly string[];
  readonly blossomServers: readonly string[];
  readonly indexerRelays?: readonly string[];
  readonly lookupRelays?: readonly string[];
  readonly localRelay?: string;
  readonly authRelays?: readonly string[];
  readonly blockedRelays?: readonly string[];
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.every((entry) => typeof entry === "string");
}

function parseSnapshot(text: string): RuntimeSettingsSnapshot {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error();
    }
    const candidate = value as Record<string, unknown>;
    if (
      candidate.version !== 1 || !stringArray(candidate.relays) ||
      !stringArray(candidate.remoteSignerRelays) ||
      !stringArray(candidate.blossomServers) ||
      (candidate.indexerRelays !== undefined &&
        !stringArray(candidate.indexerRelays)) ||
      (candidate.lookupRelays !== undefined &&
        !stringArray(candidate.lookupRelays)) ||
      (candidate.localRelay !== undefined &&
        typeof candidate.localRelay !== "string") ||
      (candidate.authRelays !== undefined &&
        !stringArray(candidate.authRelays)) ||
      (candidate.blockedRelays !== undefined &&
        !stringArray(candidate.blockedRelays))
    ) throw new Error();
    return candidate as unknown as RuntimeSettingsSnapshot;
  } catch {
    throw new Error("Runtime settings snapshot is invalid");
  }
}

export class SettingsStore {
  readonly #path: string;
  #writeQueue: Promise<void> = Promise.resolve();

  constructor(path: string) {
    this.#path = path;
  }

  async read(): Promise<RuntimeSettingsSnapshot | null> {
    try {
      return parseSnapshot(await Deno.readTextFile(this.#path));
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return null;
      if (
        error instanceof Error &&
        error.message === "Runtime settings snapshot is invalid"
      ) throw error;
      throw new Error("Runtime settings snapshot could not be read");
    }
  }

  write(snapshot: RuntimeSettingsSnapshot): Promise<void> {
    const serialized = JSON.stringify(snapshot);
    const operation = this.#writeQueue.then(() => this.#write(serialized));
    this.#writeQueue = operation.catch(() => undefined);
    return operation;
  }

  #write(serialized: string): Promise<void> {
    return writeFileAtomically({
      path: this.#path,
      serialized,
      failureMessage: "Runtime settings snapshot could not be written",
      onCleanupFailure: () => debug("temporary settings cleanup failed"),
    });
  }
}
