import type {
  NappletMessage,
  ResourceInfo,
  UploadInfo,
  UploadRequest,
} from "@napplet/core";
import type {
  IntentAvailableMessage,
  IntentHandlersMessage,
  IntentInvokeMessage,
} from "@napplet/nap/intent";
import { MAX_BINARY_PAYLOAD_BYTES } from "./binary_transport.ts";

export const TRANSFER_POLICY = Object.freeze({
  maxBytes: MAX_BINARY_PAYLOAD_BYTES,
  maxUrls: 8,
  maxActivePerWindow: 2,
  maxRedirects: 3,
  maxUrlChars: 2_048,
  resourceDeadlineMs: 10_000,
  uploadDeadlineMs: 30_000,
  mimeTypes: Object.freeze([
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/avif",
    "text/plain",
    "application/json",
    "application/pdf",
  ]),
});

const resourceInfo: ResourceInfo = {
  schemes: [
    { scheme: "https", enabled: true },
    { scheme: "blossom", enabled: true },
  ],
  maxBytes: TRANSFER_POLICY.maxBytes,
  maxUrls: TRANSFER_POLICY.maxUrls,
};
resourceInfo.schemes.forEach(Object.freeze);
Object.freeze(resourceInfo.schemes);
export const RESOURCE_INFO: Readonly<ResourceInfo> = Object.freeze(
  resourceInfo,
);

const uploadInfo: UploadInfo = {
  rails: [
    {
      rail: "blossom",
      enabled: true,
      returns: [
        "url",
        "fallbackUrls",
        "sha256",
        "size",
        "mimeType",
        "nip94",
      ],
    },
  ],
  maxBytes: TRANSFER_POLICY.maxBytes,
  mimeTypes: [...TRANSFER_POLICY.mimeTypes],
};
uploadInfo.rails.forEach((rail) => {
  if (rail.returns) Object.freeze(rail.returns);
  Object.freeze(rail);
});
Object.freeze(uploadInfo.rails);
if (uploadInfo.mimeTypes) Object.freeze(uploadInfo.mimeTypes);
export const UPLOAD_INFO: Readonly<UploadInfo> = Object.freeze(uploadInfo);

export interface MessageOwner {
  readonly connectionId: string;
  readonly windowId: string;
  readonly generation?: number;
}

export interface RuntimeForwardMessage extends MessageOwner {
  readonly type: "runtime.forward";
  readonly generation?: number;
  readonly message: NappletMessage;
}

export type PortalMediaCommand =
  | {
    readonly type: "runtime.media.transfer";
    readonly id: string;
    readonly sessionId: string;
    readonly generation: number;
  }
  | {
    readonly type: "runtime.media.stop";
    readonly id: string;
    readonly sessionId: string;
    readonly generation: number;
  };

export interface PortalMediaResult {
  readonly type: "runtime.media.result";
  readonly id: string;
  readonly ok: boolean;
  readonly sessionId?: string;
  readonly generation?: number;
  readonly error?: string;
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

export function decodePortalMediaCommand(
  value: unknown,
): PortalMediaCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const message = value as Record<string, unknown>;
  if (
    (message.type !== "runtime.media.transfer" &&
      message.type !== "runtime.media.stop") ||
    !exactKeys(message, ["type", "id", "sessionId", "generation"]) ||
    !boundedId(message.id) || !boundedId(message.sessionId) ||
    !Number.isSafeInteger(message.generation) || Number(message.generation) < 0
  ) return null;
  return message as unknown as PortalMediaCommand;
}

export type IntentCommand =
  | IntentInvokeMessage
  | IntentAvailableMessage
  | IntentHandlersMessage;

export type IntentNavigationMode = "reuse" | "new-tab" | "stack";
export type IntentNavigationMessage =
  | {
    readonly type: "intent.navigation.reserve";
    readonly reservationId: string;
    readonly invocationId: string;
    readonly callerWindowId: string;
    readonly mode: IntentNavigationMode;
  }
  | {
    readonly type: "intent.navigation.authorized";
    readonly reservationId: string;
    readonly invocationId: string;
    readonly targetWindowId: string;
    readonly ticket: string;
    readonly launchPath: string;
    readonly generation: number;
  }
  | {
    readonly type: "intent.navigation.ack";
    readonly reservationId: string;
    readonly invocationId: string;
    readonly state: "committed" | "blocked" | "closed" | "failed";
  }
  | {
    readonly type: "intent.ticket.claim";
    readonly reservationId: string;
    readonly ticket: string;
    readonly targetWindowId: string;
    readonly generation: number;
  };

const RESERVED_INTENT_PATH = "/intent/reserved";

export function createReservedIntentLaunchPath(input: {
  readonly reservationId: string;
  readonly ticket: string;
  readonly targetWindowId: string;
  readonly generation: number;
}): string {
  return `${RESERVED_INTENT_PATH}#${new URLSearchParams({
    reservationId: input.reservationId,
    ticket: input.ticket,
    targetWindowId: input.targetWindowId,
    generation: String(input.generation),
  })}`;
}

export function isReservedIntentLaunchPath(path: string): boolean {
  if (!path.startsWith(`${RESERVED_INTENT_PATH}#`)) return false;
  const params = new URLSearchParams(path.slice(path.indexOf("#") + 1));
  return boundedId(params.get("reservationId")) &&
    boundedId(params.get("ticket")) &&
    boundedId(params.get("targetWindowId")) &&
    Number.isSafeInteger(Number(params.get("generation"))) &&
    Number(params.get("generation")) >= 0;
}

const INTENT_SLUG = /^[a-z][a-z0-9-]{0,127}$/;

export function decodeIntentCommand(value: unknown): IntentCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const message = value as Record<string, unknown>;
  if (!boundedId(message.id)) return null;
  if (
    message.type === "intent.handlers" && exactKeys(message, ["type", "id"])
  ) return message as unknown as IntentHandlersMessage;
  if (
    message.type === "intent.available" &&
    exactKeys(message, ["type", "id", "archetype"]) &&
    typeof message.archetype === "string" && INTENT_SLUG.test(message.archetype)
  ) return message as unknown as IntentAvailableMessage;
  if (
    message.type === "intent.invoke" &&
    exactKeys(message, ["type", "id", "request"]) &&
    decodeIntentRequest(message.request)
  ) return message as unknown as IntentInvokeMessage;
  return null;
}

export function decodeIntentNavigationMessage(
  value: unknown,
): IntentNavigationMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const message = value as Record<string, unknown>;
  if (!boundedId(message.reservationId)) return null;
  if (
    message.type === "intent.navigation.reserve" &&
    exactKeys(message, [
      "type",
      "reservationId",
      "invocationId",
      "callerWindowId",
      "mode",
    ]) && boundedId(message.invocationId) &&
    boundedId(message.callerWindowId) &&
    ["reuse", "new-tab", "stack"].includes(String(message.mode))
  ) return message as unknown as IntentNavigationMessage;
  if (
    message.type === "intent.navigation.authorized" &&
    exactKeys(message, [
      "type",
      "reservationId",
      "invocationId",
      "targetWindowId",
      "ticket",
      "launchPath",
      "generation",
    ]) && boundedId(message.invocationId) &&
    boundedId(message.targetWindowId) &&
    boundedId(message.ticket) && typeof message.launchPath === "string" &&
    message.launchPath.startsWith("/intent/reserved#") &&
    Number.isSafeInteger(message.generation) && Number(message.generation) >= 0
  ) return message as unknown as IntentNavigationMessage;
  if (
    message.type === "intent.navigation.ack" &&
    exactKeys(message, [
      "type",
      "reservationId",
      "invocationId",
      "state",
    ]) && boundedId(message.invocationId) &&
    ["committed", "blocked", "closed", "failed"].includes(String(message.state))
  ) return message as unknown as IntentNavigationMessage;
  if (
    message.type === "intent.ticket.claim" &&
    exactKeys(message, [
      "type",
      "reservationId",
      "ticket",
      "targetWindowId",
      "generation",
    ]) && boundedId(message.ticket) && boundedId(message.targetWindowId) &&
    Number.isSafeInteger(message.generation) && Number(message.generation) >= 0
  ) return message as unknown as IntentNavigationMessage;
  return null;
}

function decodeIntentRequest(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  const allowed = [
    "archetype",
    "action",
    "payload",
    "convention",
    "handler",
    "behavior",
  ];
  if (Object.keys(request).some((key) => !allowed.includes(key))) return false;
  if (
    typeof request.archetype !== "string" ||
    !INTENT_SLUG.test(request.archetype)
  ) {
    return false;
  }
  if (
    request.action !== undefined &&
    (typeof request.action !== "string" || !INTENT_SLUG.test(request.action))
  ) return false;
  if (
    request.convention !== undefined &&
    (typeof request.convention !== "string" || request.convention.length > 512)
  ) return false;
  if (
    request.handler !== undefined &&
    (typeof request.handler !== "string" || request.handler.length > 128)
  ) return false;
  if (request.behavior !== undefined) {
    if (
      !request.behavior || typeof request.behavior !== "object" ||
      Array.isArray(request.behavior)
    ) return false;
    const behavior = request.behavior as Record<string, unknown>;
    if (
      Object.keys(behavior).some((key) =>
        !["focus", "newWindow", "reuse"].includes(key)
      ) ||
      Object.values(behavior).some((field) => typeof field !== "boolean")
    ) return false;
  }
  return request.payload === undefined ||
    isStrictIntentPayload(request.payload);
}

export function isStrictIntentPayload(value: unknown): boolean {
  try {
    const seen = new Set<object>();
    let keys = 0;
    const visit = (candidate: unknown, depth: number): boolean => {
      if (
        candidate === null || typeof candidate === "string" ||
        typeof candidate === "boolean"
      ) return true;
      if (typeof candidate === "number") return Number.isFinite(candidate);
      if (typeof candidate !== "object" || depth > 16 || seen.has(candidate)) {
        return false;
      }
      const object = candidate as object;
      seen.add(object);
      if (Array.isArray(candidate)) {
        if (candidate.length > 1024) return false;
        const valid = candidate.every((entry) => visit(entry, depth + 1));
        seen.delete(object);
        return valid;
      }
      if (Object.getPrototypeOf(candidate) !== Object.prototype) return false;
      const names = Object.keys(candidate as Record<string, unknown>);
      keys += names.length;
      if (keys > 4096 || names.length !== Reflect.ownKeys(candidate).length) {
        return false;
      }
      const valid = names.every((name) =>
        name.length <= 256 &&
        visit((candidate as Record<string, unknown>)[name], depth + 1)
      );
      seen.delete(object);
      return valid;
    };
    return visit(value, 0) &&
      new TextEncoder().encode(JSON.stringify(value)).length <= 65_536;
  } catch {
    return false;
  }
}

export type NapControlMessage =
  | { readonly type: "resource.info"; readonly id: string }
  | {
    readonly type: "resource.bytes";
    readonly id: string;
    readonly url: string;
  }
  | {
    readonly type: "resource.bytesMany";
    readonly id: string;
    readonly urls: readonly string[];
  }
  | { readonly type: "resource.cancel"; readonly id: string }
  | { readonly type: "upload.info"; readonly id: string }
  | {
    readonly type: "upload.upload";
    readonly id: string;
    readonly request: UploadRequest;
  }
  | {
    readonly type: "upload.status";
    readonly id: string;
    readonly uploadId: string;
  };

function decodeUploadRequest(value: unknown): value is UploadRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  const allowed = [
    "rail",
    "data",
    "mimeType",
    "filename",
    "caption",
    "noTransform",
    "metadata",
  ];
  if (Object.keys(request).some((key) => !allowed.includes(key))) return false;
  if (!(request.data instanceof Blob || request.data instanceof ArrayBuffer)) {
    return false;
  }
  if (request.rail !== undefined && request.rail !== "blossom") return false;
  if (
    [request.mimeType, request.filename, request.caption].some((field) =>
      field !== undefined && typeof field !== "string"
    ) ||
    (request.noTransform !== undefined &&
      typeof request.noTransform !== "boolean") ||
    (request.metadata !== undefined &&
      (!request.metadata || typeof request.metadata !== "object" ||
        Array.isArray(request.metadata)))
  ) return false;
  return true;
}

export function decodeNapControlMessage(
  value: unknown,
): NapControlMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const message = value as Record<string, unknown>;
  if (!boundedId(message.id)) return null;
  if (
    message.type === "resource.info" && exactKeys(message, ["type", "id"])
  ) return message as unknown as NapControlMessage;
  if (
    message.type === "resource.bytes" &&
    exactKeys(message, ["type", "id", "url"]) &&
    typeof message.url === "string" && message.url.length > 0 &&
    message.url.length <= TRANSFER_POLICY.maxUrlChars
  ) return message as unknown as NapControlMessage;
  if (
    message.type === "resource.bytesMany" &&
    exactKeys(message, ["type", "id", "urls"]) &&
    Array.isArray(message.urls) && message.urls.length > 0 &&
    message.urls.length <= TRANSFER_POLICY.maxUrls &&
    message.urls.every((url) =>
      typeof url === "string" && url.length > 0 &&
      url.length <= TRANSFER_POLICY.maxUrlChars
    )
  ) return message as unknown as NapControlMessage;
  if (
    message.type === "resource.cancel" &&
    exactKeys(message, ["type", "id"])
  ) return message as unknown as NapControlMessage;
  if (
    message.type === "upload.info" && exactKeys(message, ["type", "id"])
  ) return message as unknown as NapControlMessage;
  if (
    message.type === "upload.upload" &&
    exactKeys(message, ["type", "id", "request"]) &&
    decodeUploadRequest(message.request)
  ) return message as unknown as NapControlMessage;
  if (
    message.type === "upload.status" &&
    exactKeys(message, ["type", "id", "uploadId"]) &&
    boundedId(message.uploadId)
  ) return message as unknown as NapControlMessage;
  return null;
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
      !exactKeys(
        value,
        value.generation === undefined
          ? ["type", "connectionId", "windowId", "message"]
          : ["type", "connectionId", "windowId", "generation", "message"],
      ) ||
      value.type !== "runtime.forward" ||
      value.connectionId !== owner.connectionId ||
      value.windowId !== owner.windowId ||
      !message || typeof message.type !== "string"
    ) {
      return { ok: false, error: "invalid or foreign runtime message" };
    }
    if (message.type.startsWith("runtime.media.")) {
      return { ok: false, error: "portal media message cannot be forwarded" };
    }
    if (
      value.generation !== undefined &&
      (!Number.isSafeInteger(value.generation) || Number(value.generation) < 0)
    ) return { ok: false, error: "invalid media generation" };
    if (
      /^(resource|upload)\./.test(message.type) &&
      !decodeNapControlMessage(message)
    ) return { ok: false, error: "invalid transfer message" };
    if (
      /^intent\./.test(message.type) && !decodeIntentCommand(message) &&
      !decodeIntentNavigationMessage(message)
    ) {
      return { ok: false, error: "invalid intent message" };
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
