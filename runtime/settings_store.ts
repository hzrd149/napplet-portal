import { debug as rootDebug } from "../debug.ts";

const debug = rootDebug.extend("settings-store");

export interface RuntimeSettingsSnapshot {
  readonly version: 1;
  readonly relays: readonly string[];
  readonly remoteSignerRelays: readonly string[];
  readonly blossomServers: readonly string[];
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
      !stringArray(candidate.blossomServers)
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

  async #write(serialized: string): Promise<void> {
    const separator = this.#path.lastIndexOf("/");
    const directory = separator < 0
      ? "."
      : this.#path.slice(0, separator) || "/";
    const name = separator < 0 ? this.#path : this.#path.slice(separator + 1);
    const temporary = `${directory}/.${name}.${crypto.randomUUID()}.tmp`;

    await Deno.mkdir(directory, { recursive: true, mode: 0o700 });
    try {
      await Deno.writeTextFile(temporary, serialized, {
        create: true,
        mode: 0o600,
      });
      if (Deno.build.os !== "windows") await Deno.chmod(temporary, 0o600);
      await Deno.rename(temporary, this.#path);
    } catch {
      try {
        await Deno.remove(temporary);
      } catch (cleanupError) {
        if (!(cleanupError instanceof Deno.errors.NotFound)) {
          debug("temporary settings cleanup failed");
        }
      }
      throw new Error("Runtime settings snapshot could not be written");
    }
  }
}
