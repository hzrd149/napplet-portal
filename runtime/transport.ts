import type { NappletMessage } from "@napplet/core";

export interface MessageOwner {
  readonly connectionId: string;
  readonly windowId: string;
}

export interface RuntimeForwardMessage extends MessageOwner {
  readonly type: "runtime.forward";
  readonly message: NappletMessage;
}

export type CatalogCommand =
  | {
    readonly type: "catalog.preview";
    readonly id: string;
    readonly naddr: string;
  }
  | {
    readonly type: "catalog.approve";
    readonly id: string;
    readonly coordinate: string;
    readonly manifestEventId: string;
    readonly sourceCatalogEventId: string | null;
  }
  | {
    readonly type: "catalog.uninstall";
    readonly id: string;
    readonly coordinate: string;
  }
  | {
    readonly type: "catalog.launch";
    readonly id: string;
    readonly catalogEventId: string;
    readonly coordinate: string;
    readonly manifestEventId: string;
  };

const HEX_64 = /^[0-9a-f]{64}$/;
const COORDINATE = /^\d+:[0-9a-f]{64}:[^:\s]+$/;

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function boundedId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

function coordinate(value: unknown): value is string {
  return typeof value === "string" && value.length <= 512 &&
    COORDINATE.test(value);
}

export function decodeCatalogCommand(value: unknown): CatalogCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const command = value as Record<string, unknown>;
  if (
    command.type === "catalog.preview" &&
    exactKeys(command, ["type", "id", "naddr"]) && boundedId(command.id) &&
    typeof command.naddr === "string" && command.naddr.length > 0 &&
    command.naddr.length <= 5000
  ) return command as unknown as CatalogCommand;
  if (
    command.type === "catalog.approve" &&
    exactKeys(command, [
      "type",
      "id",
      "coordinate",
      "manifestEventId",
      "sourceCatalogEventId",
    ]) && boundedId(command.id) && coordinate(command.coordinate) &&
    typeof command.manifestEventId === "string" &&
    HEX_64.test(command.manifestEventId) &&
    (command.sourceCatalogEventId === null ||
      (typeof command.sourceCatalogEventId === "string" &&
        HEX_64.test(command.sourceCatalogEventId)))
  ) {
    return command as unknown as CatalogCommand;
  }
  if (
    command.type === "catalog.uninstall" &&
    exactKeys(command, ["type", "id", "coordinate"]) &&
    boundedId(command.id) && coordinate(command.coordinate)
  ) return command as unknown as CatalogCommand;
  if (
    command.type === "catalog.launch" &&
    exactKeys(command, [
      "type",
      "id",
      "catalogEventId",
      "coordinate",
      "manifestEventId",
    ]) && boundedId(command.id) &&
    typeof command.catalogEventId === "string" &&
    HEX_64.test(command.catalogEventId) && coordinate(command.coordinate) &&
    typeof command.manifestEventId === "string" &&
    HEX_64.test(command.manifestEventId)
  ) return command as unknown as CatalogCommand;
  return null;
}

export type DecodeResult =
  | { readonly ok: true; readonly value: RuntimeForwardMessage }
  | { readonly ok: false; readonly error: string };

export function decodeClientMessage(
  raw: string,
  owner: MessageOwner,
): DecodeResult {
  if (raw.length > 256_000) return { ok: false, error: "message too large" };
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const message = value.message as Record<string, unknown> | undefined;
    if (
      value.type !== "runtime.forward" ||
      value.connectionId !== owner.connectionId ||
      value.windowId !== owner.windowId ||
      !message || typeof message.type !== "string"
    ) {
      return { ok: false, error: "invalid or foreign runtime message" };
    }
    return { ok: true, value: value as unknown as RuntimeForwardMessage };
  } catch {
    return { ok: false, error: "invalid JSON" };
  }
}

export function encodeServerMessage(
  connectionId: string,
  windowId: string,
  message: NappletMessage,
): string {
  return JSON.stringify({
    type: "runtime.event",
    connectionId,
    windowId,
    message,
  });
}
