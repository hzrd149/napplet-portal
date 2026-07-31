import type { UploadRequest } from "@napplet/core";
import type { BlossomTransferService } from "./blossom_transfer.ts";
import type { ResourceBatchItem, ResourceService } from "./resource_service.ts";
import { ResourceServiceError } from "./resource_service.ts";
import { RESOURCE_INFO, TRANSFER_POLICY, UPLOAD_INFO } from "./transport.ts";

export interface NapOwner {
  readonly connectionId: string;
  readonly windowId: string;
  readonly napplet: string;
  readonly account: string;
}

export type DispatcherMessage =
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

interface NapDispatcherOptions {
  readonly resource: ResourcePort;
  readonly transfer: TransferPort;
  readonly settings: () => {
    readonly blossomServers: readonly string[];
    readonly localBlossom?: string;
  };
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
  readonly #active = new Map<string, ActiveOperation>();
  readonly #windowGenerations = new Map<string, number>();
  readonly #knownOwners = new Map<string, NapOwner>();
  #destroyed = false;

  constructor(options: NapDispatcherOptions) {
    this.#resource = options.resource;
    this.#transfer = options.transfer;
    this.#settings = options.settings;
    this.#send = options.send;
  }

  async dispatch(owner: NapOwner, message: DispatcherMessage): Promise<void> {
    if (this.#destroyed) return;
    const ownerKey = authorityKey(owner);
    this.#knownOwners.set(ownerKey, owner);
    if (message.type === "resource.cancel") {
      this.#active.get(operationKey(ownerKey, message.id))?.controller.abort();
      return;
    }
    if (message.type === "resource.info") {
      this.#send(owner, {
        type: "resource.info.result",
        id: message.id,
        info: RESOURCE_INFO,
      });
      return;
    }
    if (message.type === "upload.info") {
      this.#send(owner, {
        type: "upload.info.result",
        id: message.id,
        info: UPLOAD_INFO,
      });
      return;
    }
    if (message.type === "upload.status") {
      const status = this.#transfer.status(ownerKey, message.uploadId);
      this.#send(owner, {
        type: "upload.status.result",
        id: message.id,
        ...(status ? { status } : { error: "unavailable" }),
      });
      return;
    }

    const key = operationKey(ownerKey, message.id);
    const activeForWindow =
      [...this.#active.values()].filter((operation) =>
        operation.owner.windowId === owner.windowId
      ).length;
    if (
      this.#active.has(key) ||
      activeForWindow >= TRANSFER_POLICY.maxActivePerWindow
    ) {
      this.#send(owner, {
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
    const generation = this.#windowGenerations.get(owner.windowId) ?? 0;
    this.#active.set(key, { owner, ownerKey, controller, generation });
    const settings = this.#settings();
    const operation = this.#active.get(key)!;
    try {
      if (message.type === "resource.bytes") {
        const result = await this.#resource.bytes(message.url, {
          signal: controller.signal,
          blossomServers: [...settings.blossomServers],
          authorPubkey: owner.account,
        });
        if (!this.#valid(operation)) return;
        this.#send(owner, {
          type: "resource.bytes.result",
          id: message.id,
          mime: result.mime,
        }, [result.bytes]);
      } else if (message.type === "resource.bytesMany") {
        const results = await this.#resource.bytesMany(message.urls, {
          signal: controller.signal,
          blossomServers: [...settings.blossomServers],
          authorPubkey: owner.account,
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
        this.#send(owner, {
          type: "resource.bytesMany.result",
          id: message.id,
          items,
        }, bytes);
      } else {
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
        this.#send(owner, {
          type: "upload.upload.result",
          id: message.id,
          result,
        });
        const status = this.#transfer.status(ownerKey, result.uploadId);
        if (status) {
          this.#send(owner, { type: "upload.status.changed", status });
        }
      }
    } catch (error) {
      if (!this.#valid(operation) || controller.signal.aborted) return;
      this.#send(owner, {
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
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    for (const operation of this.#active.values()) operation.controller.abort();
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
}
