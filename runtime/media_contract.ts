import type { MediaAction, MediaPlaybackOwner } from "@napplet/core";
import type { MediaNapMessage } from "@napplet/nap/media";

export type MediaDecodeResult =
  | { readonly ok: true; readonly value: MediaNapMessage }
  | { readonly ok: false; readonly error: "invalid-media-message" };

const ACTIONS = new Set<MediaAction>([
  "play",
  "pause",
  "stop",
  "next",
  "prev",
  "seek",
  "volume",
]);
const STATUSES = new Set(["playing", "paused", "stopped", "buffering"]);
const OWNERS = new Set<MediaPlaybackOwner>(["shell", "napplet"]);
const TYPES = new Set([
  "media.session.create",
  "media.session.create.result",
  "media.session.update",
  "media.session.destroy",
  "media.state",
  "media.capabilities",
  "media.command",
  "media.controls",
]);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function text(value: unknown, max = 512): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function optionalText(value: unknown, max = 512): value is string | undefined {
  return value === undefined || text(value, max);
}

function finite(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return typeof value === "number" && Number.isFinite(value) && value >= min &&
    value <= max;
}

function optionalFinite(
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
) {
  return value === undefined || finite(value, min, max);
}

function actions(value: unknown): value is MediaAction[] {
  return Array.isArray(value) && value.length <= 16 &&
    value.every((item) => ACTIONS.has(item as MediaAction)) &&
    new Set(value).size === value.length;
}

function nostr(value: unknown): boolean {
  if (!record(value) || !exact(value, ["eventId", "address", "relays"])) {
    return false;
  }
  if (!optionalText(value.eventId) || !optionalText(value.address)) {
    return false;
  }
  return value.relays === undefined ||
    (Array.isArray(value.relays) && value.relays.length <= 16 &&
      value.relays.every((relay) => text(relay, 2048)));
}

function source(value: unknown): boolean {
  return record(value) &&
    exact(value, ["url", "blossomHash", "nostr", "mimeType"]) &&
    optionalText(value.url, 4096) && optionalText(value.blossomHash, 128) &&
    optionalText(value.mimeType, 128) &&
    (value.nostr === undefined || nostr(value.nostr)) &&
    Object.values(value).some((item) => item !== undefined);
}

function artwork(value: unknown): boolean {
  return record(value) && exact(value, ["url", "hash"]) &&
    optionalText(value.url, 4096) && optionalText(value.hash, 128) &&
    Object.values(value).some((item) => item !== undefined);
}

function metadata(value: unknown): boolean {
  return record(value) &&
    exact(value, [
      "title",
      "artist",
      "album",
      "artwork",
      "duration",
      "mediaType",
    ]) &&
    optionalText(value.title) && optionalText(value.artist) &&
    optionalText(value.album) &&
    (value.artwork === undefined || artwork(value.artwork)) &&
    optionalFinite(value.duration) &&
    (value.mediaType === undefined || value.mediaType === "audio" ||
      value.mediaType === "video");
}

function context(value: unknown): boolean {
  if (
    !record(value) ||
    !exact(value, ["label", "detail", "index", "total", "links"]) ||
    !optionalText(value.label) || !optionalText(value.detail, 2048) ||
    !optionalFinite(value.index) || !optionalFinite(value.total)
  ) return false;
  return value.links === undefined ||
    (Array.isArray(value.links) && value.links.length <= 32 &&
      value.links.every((link) =>
        record(link) && exact(link, ["rel", "title", "nostr"]) &&
        text(link.rel, 64) && /^[a-z][a-z0-9-]*$/.test(link.rel) &&
        optionalText(link.title) &&
        (link.nostr === undefined || nostr(link.nostr))
      ));
}

function valid(value: Record<string, unknown>): boolean {
  switch (value.type) {
    case "media.session.create":
      return exact(value, [
        "type",
        "id",
        "owner",
        "sessionId",
        "source",
        "metadata",
        "context",
        "capabilities",
        "autoplay",
        "live",
      ]) && text(value.id, 128) &&
        OWNERS.has(value.owner as MediaPlaybackOwner) &&
        optionalText(value.sessionId, 128) &&
        (value.owner === "shell"
          ? source(value.source)
          : value.source === undefined || source(value.source)) &&
        (value.metadata === undefined || metadata(value.metadata)) &&
        (value.context === undefined || context(value.context)) &&
        (value.capabilities === undefined || actions(value.capabilities)) &&
        (value.autoplay === undefined || typeof value.autoplay === "boolean") &&
        (value.live === undefined || typeof value.live === "boolean");
    case "media.session.create.result": {
      if (
        !exact(value, ["type", "id", "sessionId", "owner", "error"]) ||
        !text(value.id, 128)
      ) return false;
      const success = text(value.sessionId, 128) &&
        OWNERS.has(value.owner as MediaPlaybackOwner) &&
        value.error === undefined;
      const failure = text(value.error, 256) && value.sessionId === undefined &&
        value.owner === undefined;
      return success || failure;
    }
    case "media.session.update":
      return exact(value, ["type", "sessionId", "metadata"]) &&
        text(value.sessionId, 128) && metadata(value.metadata);
    case "media.session.destroy":
      return exact(value, ["type", "sessionId"]) && text(value.sessionId, 128);
    case "media.state":
      return exact(value, [
        "type",
        "sessionId",
        "status",
        "position",
        "duration",
        "volume",
      ]) &&
        text(value.sessionId, 128) && STATUSES.has(value.status as string) &&
        optionalFinite(value.position) && optionalFinite(value.duration) &&
        optionalFinite(value.volume, 0, 1);
    case "media.capabilities":
      return exact(value, ["type", "sessionId", "actions"]) &&
        text(value.sessionId, 128) && actions(value.actions);
    case "media.command": {
      if (
        !exact(value, ["type", "sessionId", "action", "value"]) ||
        !text(value.sessionId, 128) || !ACTIONS.has(value.action as MediaAction)
      ) {
        return false;
      }
      return value.action === "seek"
        ? finite(value.value)
        : value.action === "volume"
        ? finite(value.value, 0, 1)
        : value.value === undefined;
    }
    case "media.controls":
      return exact(value, ["type", "sessionId", "controls"]) &&
        text(value.sessionId, 128) && actions(value.controls);
    default:
      return false;
  }
}

function freeze(value: unknown): unknown {
  if (!record(value) && !Array.isArray(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

export function decodeMediaMessage(input: unknown): MediaDecodeResult {
  if (!record(input) || !TYPES.has(input.type as string) || !valid(input)) {
    return { ok: false, error: "invalid-media-message" };
  }
  return { ok: true, value: freeze(structuredClone(input)) as MediaNapMessage };
}
