import { debug as rootDebug } from "../debug.ts";

const debug = rootDebug.extend("storage-store");
const FORBIDDEN_MAP_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export interface NappletStorageSnapshot {
  readonly version: 1;
  readonly namespaces: Readonly<
    Record<string, Readonly<Record<string, string>>>
  >;
}

interface StorageStoreHooks {
  readonly beforeRename?: () => void | Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function parseSnapshot(text: string): NappletStorageSnapshot {
  try {
    const value: unknown = JSON.parse(text);
    if (
      !isRecord(value) || !exactKeys(value, ["version", "namespaces"]) ||
      value.version !== 1 || !isRecord(value.namespaces)
    ) throw new Error();
    const namespaces: Record<string, Readonly<Record<string, string>>> = Object
      .create(null);
    for (const namespace of Object.keys(value.namespaces).sort()) {
      if (FORBIDDEN_MAP_KEYS.has(namespace)) throw new Error();
      const entries = value.namespaces[namespace];
      if (!isRecord(entries)) throw new Error();
      const copy: Record<string, string> = Object.create(null);
      for (const key of Object.keys(entries).sort()) {
        if (FORBIDDEN_MAP_KEYS.has(key) || typeof entries[key] !== "string") {
          throw new Error();
        }
        copy[key] = entries[key] as string;
      }
      namespaces[namespace] = Object.freeze(copy);
    }
    return Object.freeze({ version: 1, namespaces: Object.freeze(namespaces) });
  } catch {
    throw new Error("Napplet storage snapshot is invalid");
  }
}

function canonicalSerialize(snapshot: NappletStorageSnapshot): string {
  const namespaces: Record<string, Record<string, string>> = Object.create(
    null,
  );
  for (const namespace of Object.keys(snapshot.namespaces).sort()) {
    if (FORBIDDEN_MAP_KEYS.has(namespace)) {
      throw new Error("Napplet storage snapshot is invalid");
    }
    const source = snapshot.namespaces[namespace];
    if (!isRecord(source)) {
      throw new Error("Napplet storage snapshot is invalid");
    }
    const entries: Record<string, string> = Object.create(null);
    for (const key of Object.keys(source).sort()) {
      if (FORBIDDEN_MAP_KEYS.has(key) || typeof source[key] !== "string") {
        throw new Error("Napplet storage snapshot is invalid");
      }
      entries[key] = source[key];
    }
    namespaces[namespace] = entries;
  }
  return JSON.stringify({ version: 1, namespaces });
}

export class NappletStorageStore {
  readonly #path: string;
  readonly #hooks: StorageStoreHooks;
  #writeTail: Promise<void> = Promise.resolve();

  constructor(path: string, hooks: StorageStoreHooks = {}) {
    this.#path = path;
    this.#hooks = hooks;
  }

  async read(): Promise<NappletStorageSnapshot> {
    try {
      return parseSnapshot(await Deno.readTextFile(this.#path));
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return Object.freeze({
          version: 1,
          namespaces: Object.freeze(Object.create(null)),
        });
      }
      if (
        error instanceof Error &&
        error.message === "Napplet storage snapshot is invalid"
      ) throw error;
      throw new Error("Napplet storage snapshot could not be read");
    }
  }

  write(snapshot: NappletStorageSnapshot): Promise<void> {
    const serialized = canonicalSerialize(snapshot);
    const operation = this.#writeTail.then(() =>
      this.#writeAtomically(serialized)
    );
    this.#writeTail = operation.catch(() => undefined);
    return operation;
  }

  async #writeAtomically(serialized: string): Promise<void> {
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
      await this.#hooks.beforeRename?.();
      await Deno.rename(temporary, this.#path);
    } catch {
      try {
        await Deno.remove(temporary);
      } catch (cleanupError) {
        if (!(cleanupError instanceof Deno.errors.NotFound)) {
          debug("temporary storage cleanup failed");
        }
      }
      throw new Error("Napplet storage snapshot could not be written");
    }
  }
}
