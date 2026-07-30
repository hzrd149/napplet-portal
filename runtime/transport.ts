import type { NappletMessage } from "@napplet/core";

export interface MessageOwner {
  readonly connectionId: string;
  readonly windowId: string;
}

export interface RuntimeForwardMessage extends MessageOwner {
  readonly type: "runtime.forward";
  readonly message: NappletMessage;
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
