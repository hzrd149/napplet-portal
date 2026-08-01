/**
 * Sensitive at-rest account state. This file contains complete signer records
 * and must never be exposed through a browser transport or diagnostic message.
 */
import { debug as rootDebug } from "../debug.ts";
import { writeFileAtomically } from "./atomic_file.ts";

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

  #writeAtomically(serialized: string): Promise<void> {
    return writeFileAtomically({
      path: this.#path,
      serialized,
      failureMessage: "Account snapshot could not be written",
      onStart: () => debug("atomic write started"),
      onComplete: () => debug("atomic write complete"),
    });
  }
}
