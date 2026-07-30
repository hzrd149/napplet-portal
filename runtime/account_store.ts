/**
 * Sensitive at-rest account state. This file contains complete signer records
 * and must never be exposed through a browser transport or diagnostic message.
 */
import { debug as rootDebug } from "../debug.ts";

const debug = rootDebug.extend("account-store");

export interface AccountSnapshot {
  readonly version: 1;
  readonly activeAccountId: string | null;
  readonly accounts: readonly Record<string, unknown>[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSnapshot(text: string): AccountSnapshot {
  try {
    const value: unknown = JSON.parse(text);
    if (!isRecord(value) || value.version !== 1) throw new Error();
    if (
      value.activeAccountId !== null &&
      typeof value.activeAccountId !== "string"
    ) throw new Error();
    if (!Array.isArray(value.accounts) || !value.accounts.every(isRecord)) {
      throw new Error();
    }
    return value as unknown as AccountSnapshot;
  } catch {
    throw new Error("Account snapshot is invalid");
  }
}

export class AccountStore {
  readonly #path: string;
  #writeQueue: Promise<void> = Promise.resolve();

  constructor(path: string) {
    this.#path = path;
  }

  async read(): Promise<AccountSnapshot | null> {
    debug("read started");
    try {
      const snapshot = parseSnapshot(await Deno.readTextFile(this.#path));
      debug(
        "read complete accounts=%d active=%s",
        snapshot.accounts.length,
        snapshot.activeAccountId ? "present" : "none",
      );
      return snapshot;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        debug("read skipped snapshot missing");
        return null;
      }
      if (
        error instanceof Error &&
        error.message === "Account snapshot is invalid"
      ) {
        debug("read failed invalid snapshot");
        throw error;
      }
      debug("read failed");
      throw new Error("Account snapshot could not be read");
    }
  }

  write(snapshot: AccountSnapshot): Promise<void> {
    debug(
      "write queued accounts=%d active=%s",
      snapshot.accounts.length,
      snapshot.activeAccountId ? "present" : "none",
    );
    const serialized = JSON.stringify(snapshot);
    const operation = this.#writeQueue.then(() =>
      this.#writeAtomically(serialized)
    );
    this.#writeQueue = operation.catch(() => undefined);
    return operation;
  }

  async #writeAtomically(serialized: string): Promise<void> {
    debug("atomic write started");
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
      debug("atomic write complete");
    } catch {
      try {
        await Deno.remove(temporary);
      } catch (cleanupError) {
        if (!(cleanupError instanceof Deno.errors.NotFound)) {
          // Cleanup is best effort. Never include a sensitive path or payload.
        }
      }
      debug("atomic write failed");
      throw new Error("Account snapshot could not be written");
    }
  }
}
