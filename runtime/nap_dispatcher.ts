import type { UploadRequest } from "@napplet/core";
import type { StorageRequestMessage } from "@napplet/nap/storage";
import { type CommonService, encodePublicNip19 } from "./common.ts";
import type { BlossomTransferService } from "./blossom_transfer.ts";
import type { ResourceBatchItem, ResourceService } from "./resource_service.ts";
import { ResourceServiceError } from "./resource_service.ts";
import { RESOURCE_INFO, TRANSFER_POLICY, UPLOAD_INFO } from "./transport.ts";
import type { StorageNamespaceIdentity } from "./storage.ts";
import { StorageServiceError } from "./storage.ts";

export interface NapOwner {
  readonly connectionId: string;
  readonly windowId: string;
  readonly napplet: string;
  readonly account: string;
}

export interface WindowCapabilityContext {
  readonly connectionId: string;
  readonly windowId: string;
  readonly accountPubkey: string;
  readonly coordinate: string;
  readonly manifestEventId: string;
  readonly dTag: string;
  readonly aggregateHash: string;
  readonly grantedDomains: readonly string[];
  readonly instanceId: string;
}

type CommonMessage = Record<string, unknown> & {
  readonly type: `common.${string}`;
  readonly id: string;
};

type CommonStorageMessage = CommonMessage | StorageRequestMessage;

export type DispatcherMessage =
  | CommonStorageMessage
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

interface ResourcePort {
  bytes: ResourceService["bytes"];
  bytesMany: ResourceService["bytesMany"];
}

interface TransferPort {
  upload: BlossomTransferService["upload"];
  status: BlossomTransferService["status"];
  clearOwner?(owner: string): void;
}

interface StoragePort {
  get(
    identity: StorageNamespaceIdentity,
    key: string,
  ): string | null | Promise<string | null>;
  set(
    identity: StorageNamespaceIdentity,
    key: string,
    value: string,
  ): void | Promise<void>;
  remove(identity: StorageNamespaceIdentity, key: string): void | Promise<void>;
  keys(
    identity: StorageNamespaceIdentity,
  ): readonly string[] | Promise<readonly string[]>;
}

interface NapDispatcherOptions {
  readonly resource: ResourcePort;
  readonly transfer: TransferPort;
  readonly settings: () => {
    readonly blossomServers: readonly string[];
    readonly localBlossom?: string;
  };
  readonly storage?: StoragePort;
  readonly common?: CommonService;
  readonly isCurrent?: (context: WindowCapabilityContext) => boolean;
  readonly send: (
    owner: NapOwner,
    message: Record<string, unknown>,
    bytes?: readonly Uint8Array[],
  ) => void;
}

interface ActiveOperation {
  readonly owner: NapOwner;
  readonly ownerKey: string;
  readonly controller: AbortController;
  readonly generation: number;
}

const MAX_ACTIVE_COMMON_PER_WINDOW = 8;

function authorityKey(owner: NapOwner): string {
  return JSON.stringify([
    owner.connectionId,
    owner.windowId,
    owner.napplet,
    owner.account,
  ]);
}

function operationKey(ownerKey: string, id: string): string {
  return `${ownerKey}:${id}`;
}

function resourceError(error: unknown): string {
  return error instanceof ResourceServiceError ? error.code : "network-error";
}

export class NapDispatcher {
  readonly #resource: ResourcePort;
  readonly #transfer: TransferPort;
  readonly #settings: NapDispatcherOptions["settings"];
  readonly #send: NapDispatcherOptions["send"];
  readonly #storage?: StoragePort;
  readonly #common?: CommonService;
  #isCurrent?: NapDispatcherOptions["isCurrent"];
  readonly #active = new Map<string, ActiveOperation>();
  readonly #windowGenerations = new Map<string, number>();
  readonly #knownOwners = new Map<string, NapOwner>();
  readonly #revokedWindows = new Set<string>();
  #destroyed = false;

  constructor(options: NapDispatcherOptions) {
    this.#resource = options.resource;
    this.#transfer = options.transfer;
    this.#settings = options.settings;
    this.#send = options.send;
    this.#storage = options.storage;
    this.#common = options.common;
    this.#isCurrent = options.isCurrent;
  }

  setAuthorityValidator(
    validate: (context: WindowCapabilityContext) => boolean,
  ): void {
    this.#isCurrent = validate;
  }

  authorizeWindow(windowId: string): void {
    this.#revokedWindows.delete(windowId);
    this.#windowGenerations.set(
      windowId,
      (this.#windowGenerations.get(windowId) ?? 0) + 1,
    );
  }

  async dispatch(
    owner: NapOwner | WindowCapabilityContext,
    message: DispatcherMessage,
  ): Promise<void> {
    if (this.#destroyed) return;
    if (
      message.type.startsWith("common.") || message.type.startsWith("storage.")
    ) {
      await this.#dispatchCommonStorage(owner, message as CommonStorageMessage);
      return;
    }
    const transferOwner = owner as NapOwner;
    const ownerKey = authorityKey(transferOwner);
    this.#knownOwners.set(ownerKey, transferOwner);
    if (message.type === "resource.cancel") {
      this.#active.get(operationKey(ownerKey, message.id))?.controller.abort();
      return;
    }
    if (message.type === "resource.info") {
      this.#send(transferOwner, {
        type: "resource.info.result",
        id: message.id,
        info: RESOURCE_INFO,
      });
      return;
    }
    if (message.type === "upload.info") {
      this.#send(transferOwner, {
        type: "upload.info.result",
        id: message.id,
        info: UPLOAD_INFO,
      });
      return;
    }
    if (message.type === "upload.status") {
      const status = this.#transfer.status(ownerKey, message.uploadId);
      this.#send(transferOwner, {
        type: "upload.status.result",
        id: message.id,
        ...(status ? { status } : { error: "unavailable" }),
      });
      return;
    }

    const key = operationKey(ownerKey, message.id);
    const activeForWindow =
      [...this.#active.values()].filter((operation) =>
        operation.owner.windowId === transferOwner.windowId
      ).length;
    if (
      this.#active.has(key) ||
      activeForWindow >= TRANSFER_POLICY.maxActivePerWindow
    ) {
      this.#send(transferOwner, {
        type: message.type === "resource.bytesMany"
          ? "resource.bytesMany.error"
          : message.type === "resource.bytes"
          ? "resource.bytes.error"
          : "upload.upload.result",
        id: message.id,
        error: "quota-exceeded",
      });
      return;
    }

    const controller = new AbortController();
    const generation = this.#windowGenerations.get(transferOwner.windowId) ?? 0;
    this.#active.set(key, {
      owner: transferOwner,
      ownerKey,
      controller,
      generation,
    });
    const settings = this.#settings();
    const operation = this.#active.get(key)!;
    try {
      if (message.type === "resource.bytes") {
        const result = await this.#resource.bytes(message.url, {
          signal: controller.signal,
          blossomServers: [...settings.blossomServers],
          authorPubkey: transferOwner.account,
        });
        if (!this.#valid(operation)) return;
        this.#send(transferOwner, {
          type: "resource.bytes.result",
          id: message.id,
          mime: result.mime,
        }, [result.bytes]);
      } else if (message.type === "resource.bytesMany") {
        const results = await this.#resource.bytesMany(message.urls, {
          signal: controller.signal,
          blossomServers: [...settings.blossomServers],
          authorPubkey: transferOwner.account,
        });
        if (!this.#valid(operation)) return;
        const bytes: Uint8Array[] = [];
        const items = results.map((item: ResourceBatchItem, index: number) => {
          if (!item.ok) {
            return {
              url: message.urls[index],
              ok: false,
              error: item.error.code,
            };
          }
          bytes.push(item.value.bytes);
          return {
            url: message.urls[index],
            ok: true,
            mime: item.value.mime,
            binaryIndex: bytes.length - 1,
          };
        });
        this.#send(transferOwner, {
          type: "resource.bytesMany.result",
          id: message.id,
          items,
        }, bytes);
      } else if (message.type === "upload.upload") {
        const data = message.request.data;
        const blob = data instanceof Blob
          ? data
          : new Blob([data], { type: message.request.mimeType });
        const requiredServers = settings.blossomServers.map((value) =>
          new URL(value)
        );
        const result = await this.#transfer.upload({
          owner: ownerKey,
          blob,
          requiredServers,
          localServer: settings.localBlossom
            ? new URL(settings.localBlossom)
            : undefined,
          signal: controller.signal,
        });
        if (!this.#valid(operation)) return;
        this.#send(transferOwner, {
          type: "upload.upload.result",
          id: message.id,
          result,
        });
        const status = this.#transfer.status(ownerKey, result.uploadId);
        if (status) {
          this.#send(transferOwner, { type: "upload.status.changed", status });
        }
      }
    } catch (error) {
      if (!this.#valid(operation) || controller.signal.aborted) return;
      this.#send(transferOwner, {
        type: message.type === "resource.bytesMany"
          ? "resource.bytesMany.error"
          : message.type === "resource.bytes"
          ? "resource.bytes.error"
          : "upload.upload.result",
        id: message.id,
        error: message.type.startsWith("resource.")
          ? resourceError(error)
          : "unavailable",
      });
    } finally {
      this.#active.delete(key);
    }
  }

  abortWindow(windowId: string): void {
    this.#revokedWindows.add(windowId);
    this.#windowGenerations.set(
      windowId,
      (this.#windowGenerations.get(windowId) ?? 0) + 1,
    );
    for (const operation of this.#active.values()) {
      if (operation.owner.windowId === windowId) operation.controller.abort();
    }
    for (const [key, owner] of this.#knownOwners) {
      if (owner.windowId !== windowId) continue;
      this.#transfer.clearOwner?.(key);
      this.#knownOwners.delete(key);
    }
    this.#common?.cancel(windowId);
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    for (const operation of this.#active.values()) operation.controller.abort();
    this.#common?.destroy();
    for (const key of this.#knownOwners.keys()) {
      this.#transfer.clearOwner?.(key);
    }
    this.#knownOwners.clear();
  }

  #valid(operation: ActiveOperation): boolean {
    return !this.#destroyed && !operation.controller.signal.aborted &&
      (this.#windowGenerations.get(operation.owner.windowId) ?? 0) ===
        operation.generation;
  }

  async #dispatchCommonStorage(
    owner: NapOwner | WindowCapabilityContext,
    message: CommonStorageMessage,
  ): Promise<void> {
    const context = owner as WindowCapabilityContext;
    const resultType = `${message.type}.result`;
    const send = (result: Record<string, unknown>) =>
      this.#send(this.#asOwner(context), {
        type: resultType,
        id: message.id,
        ...result,
      });
    const domain = message.type.startsWith("common.") ? "common" : "storage";
    if (
      typeof context.accountPubkey !== "string" ||
      this.#revokedWindows.has(context.windowId) ||
      !context.grantedDomains?.includes(domain) ||
      !this.#isCurrent?.(context)
    ) {
      send({
        error: "not-authorized",
        ...(message.type === "storage.get" ? { value: null } : {}),
      });
      return;
    }
    if (!validId(message.id)) {
      send({
        error: "invalid-request",
        ...(message.type === "storage.get" ? { value: null } : {}),
      });
      return;
    }
    if (message.type.startsWith("common.")) {
      if (!validCommonMessage(message as Record<string, unknown>)) {
        send({ ok: false, error: "invalid-request" });
        return;
      }
      const commonOwner = this.#asOwner(context);
      const ownerKey = authorityKey(commonOwner);
      const key = operationKey(ownerKey, message.id);
      const activeForWindow = [...this.#active.values()].filter((operation) =>
        operation.owner.windowId === context.windowId
      ).length;
      if (
        this.#active.has(key) || activeForWindow >= MAX_ACTIVE_COMMON_PER_WINDOW
      ) {
        send({ ok: false, error: "quota-exceeded" });
        return;
      }
      const controller = new AbortController();
      const operation: ActiveOperation = {
        owner: commonOwner,
        ownerKey,
        controller,
        generation: this.#windowGenerations.get(context.windowId) ?? 0,
      };
      this.#active.set(key, operation);
      let result: Record<string, unknown>;
      try {
        if (!this.#common && message.type === "common.encodeNip19") {
          try {
            result = encodePublicNip19(message.input);
          } catch {
            result = { ok: false, error: "invalid-request" };
          }
        } else if (!this.#common) {
          result = { ok: false, error: "unavailable" };
        } else {
          result = await this.#common.execute(
            message as Record<string, unknown>,
            context.windowId,
          );
        }
        if (this.#valid(operation) && this.#isCurrent?.(context)) {
          send(result);
        }
      } finally {
        this.#active.delete(key);
      }
      return;
    }
    const storageMessage = message as StorageRequestMessage;
    if (!this.#storage || !validStorageMessage(storageMessage)) {
      send({
        error: "invalid-request",
        ...(message.type === "storage.get" ? { value: null } : {}),
      });
      return;
    }
    const scope = storageMessage.scope ?? "shared";
    const identity: StorageNamespaceIdentity = Object.freeze({
      accountPubkey: context.accountPubkey,
      coordinate: context.coordinate,
      manifestEventId: context.manifestEventId,
      dTag: context.dTag,
      aggregateHash: context.aggregateHash,
      scope,
      instanceId: scope === "instance" ? context.instanceId : "",
    });
    try {
      if (storageMessage.type === "storage.set") {
        await this.#storage.set(
          identity,
          storageMessage.key,
          storageMessage.value,
        );
        send({});
      } else if (storageMessage.type === "storage.get") {
        send({ value: await this.#storage.get(identity, storageMessage.key) });
      } else if (storageMessage.type === "storage.remove") {
        await this.#storage.remove(identity, storageMessage.key);
        send({});
      } else if (message.type === "storage.keys") {
        send({ keys: [...await this.#storage.keys(identity)].sort() });
      }
    } catch (error) {
      send({
        error: error instanceof StorageServiceError
          ? error.code
          : "storage-unavailable",
        ...(message.type === "storage.get" ? { value: null } : {}),
        ...(message.type === "storage.keys" ? { keys: [] } : {}),
      });
    }
  }

  #asOwner(context: WindowCapabilityContext): NapOwner {
    return {
      connectionId: context.connectionId,
      windowId: context.windowId,
      napplet: `${context.coordinate}@${context.manifestEventId}`,
      account: context.accountPubkey,
    };
  }
}

function exactKeys(value: object, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length &&
    actual.every((key, index) => key === [...keys].sort()[index]);
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 128;
}

function validCommonMessage(message: Record<string, unknown>): boolean {
  const keys = (...names: string[]) =>
    exactKeys(message, ["type", "id", ...names]);
  switch (message.type) {
    case "common.encodeNip19":
      return keys("input") && validEncodeInput(message.input);
    case "common.decodeNip19":
      return keys("value") && typeof message.value === "string" &&
        message.value.length <= 4096;
    case "common.getProfile":
      return keys("target") && typeof message.target === "string" &&
        message.target.length <= 4096;
    case "common.follows":
      return keys();
    case "common.follow":
    case "common.unfollow":
      return keys("pubkeys") && Array.isArray(message.pubkeys) &&
        message.pubkeys.length >= 1 && message.pubkeys.length <= 64 &&
        message.pubkeys.every((value) =>
          typeof value === "string" && value.length <= 4096
        );
    case "common.react":
      return (keys("targetEventId", "reaction") ||
        keys("targetEventId", "reaction", "customEmojiHref")) &&
        typeof message.targetEventId === "string" &&
        typeof message.reaction === "string";
    case "common.report":
      return keys("target", "reason", "text") &&
        validReportTarget(message.target) &&
        typeof message.reason === "string" &&
        typeof message.text === "string";
    default:
      return false;
  }
}

function validEncodeInput(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  switch (input.type) {
    case "npub":
    case "note":
      return exactKeys(input, ["type", "hex"]);
    case "nprofile":
      return exactKeys(input, ["type", "pubkey", "relays"]);
    case "nevent":
      return [
        ["type", "eventId"],
        ["type", "eventId", "relays"],
        ["type", "eventId", "author", "kind", "relays"],
      ].some((keys) => exactKeys(input, keys));
    case "naddr":
      return exactKeys(input, [
        "type",
        "identifier",
        "pubkey",
        "kind",
        "relays",
      ]);
    case "nrelay":
      return exactKeys(input, ["type", "relay"]);
    default:
      return false;
  }
}

function validReportTarget(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const target = value as Record<string, unknown>;
  return target.type === "pubkey"
    ? (exactKeys(target, ["type", "pubkey"]) ||
      exactKeys(target, ["type", "pubkey", "relay"]))
    : target.type === "event" && [
      ["type", "id"],
      ["type", "id", "relay"],
      ["type", "id", "pubkey"],
      ["type", "id", "pubkey", "relay"],
    ].some((keys) => exactKeys(target, keys));
}

function validStorageMessage(message: StorageRequestMessage): boolean {
  const scope = message.scope;
  if (scope !== undefined && scope !== "shared" && scope !== "instance") {
    return false;
  }
  if (
    "key" in message &&
    (typeof message.key !== "string" || message.key.length < 1)
  ) return false;
  if (message.type === "storage.set" && typeof message.value !== "string") {
    return false;
  }
  const keys = message.type === "storage.set"
    ? ["type", "id", "key", "value", ...(scope ? ["scope"] : [])]
    : message.type === "storage.get" || message.type === "storage.remove"
    ? ["type", "id", "key", ...(scope ? ["scope"] : [])]
    : ["type", "id", ...(scope ? ["scope"] : [])];
  return exactKeys(message, keys);
}
