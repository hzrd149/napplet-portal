/**
 * Shared skeleton for atomic snapshot writes: derive a temp path next to
 * the target file, write the payload, chmod it, rename it over the
 * target, and best-effort clean up the temp file on any failure. This
 * module writes an already-serialized string and performs no JSON
 * parsing or schema work — snapshot parsing and canonical serialization
 * stay in each owning store.
 */

export interface TemporaryPath {
  readonly directory: string;
  readonly name: string;
  readonly temporary: string;
}

export function resolveTemporaryPath(path: string): TemporaryPath {
  const separator = path.lastIndexOf("/");
  const directory = separator < 0 ? "." : path.slice(0, separator) || "/";
  const name = separator < 0 ? path : path.slice(separator + 1);
  const temporary = `${directory}/.${name}.${crypto.randomUUID()}.tmp`;
  return { directory, name, temporary };
}

export interface WriteFileAtomicallyOptions {
  readonly path: string;
  readonly serialized: string;
  /** Thrown verbatim as `new Error(failureMessage)` on any failure. */
  readonly failureMessage: string;
  /**
   * When false or absent, write with a single `Deno.writeTextFile` call.
   * When true, open the file with `createNew`, write incrementally,
   * `sync()` it, and after a successful rename also open and `sync()`
   * the containing directory on non-Windows.
   */
  readonly durable?: boolean;
  /** Awaited immediately before the rename. */
  readonly beforeRename?: () => void | Promise<void>;
  /**
   * Checked immediately before the rename. When it returns false, the
   * write throws so the standard failure path (cleanup + failureMessage)
   * runs.
   */
  readonly isCurrent?: () => boolean;
  /**
   * Invoked when best-effort temp removal fails with anything other than
   * `Deno.errors.NotFound`, so each store can keep its own debug
   * namespace and message.
   */
  readonly onCleanupFailure?: () => void;
  readonly onStart?: () => void;
  readonly onComplete?: () => void;
}

export async function writeFileAtomically(
  options: WriteFileAtomicallyOptions,
): Promise<void> {
  options.onStart?.();
  const { directory, temporary } = resolveTemporaryPath(options.path);
  await Deno.mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    if (options.durable) {
      {
        using file = await Deno.open(temporary, {
          write: true,
          createNew: true,
          mode: 0o600,
        });
        const bytes = new TextEncoder().encode(options.serialized);
        let offset = 0;
        while (offset < bytes.length) {
          offset += await file.write(bytes.subarray(offset));
        }
        await file.sync();
      }
    } else {
      await Deno.writeTextFile(temporary, options.serialized, {
        create: true,
        mode: 0o600,
      });
    }
    if (Deno.build.os !== "windows") await Deno.chmod(temporary, 0o600);
    await options.beforeRename?.();
    if (options.isCurrent && !options.isCurrent()) {
      throw new Error("stale write target");
    }
    await Deno.rename(temporary, options.path);
    if (options.durable && Deno.build.os !== "windows") {
      using directoryHandle = await Deno.open(directory, { read: true });
      await directoryHandle.sync();
    }
    options.onComplete?.();
  } catch {
    try {
      await Deno.remove(temporary);
    } catch (cleanupError) {
      if (!(cleanupError instanceof Deno.errors.NotFound)) {
        options.onCleanupFailure?.();
      }
    }
    throw new Error(options.failureMessage);
  }
}
