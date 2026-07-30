import type { NostrEvent, NostrFilter } from "@napplet/core";
import {
  BehaviorSubject,
  catchError,
  concat,
  EMPTY,
  filter,
  type Observable,
  tap,
} from "npm:rxjs@7.8.2";
import type { RawRelayItem } from "./relay_adapter.ts";

export const LOCAL_RELAY_REQUEST_TIMEOUT_MS = 1_500;

export type RelayCacheHealth =
  | { readonly status: "healthy"; readonly endpoint: string }
  | {
    readonly status: "degraded";
    readonly endpoint: string;
    readonly reason: "read-failed" | "write-failed";
  };

export interface LocalRelayPort {
  readonly url: string;
  request(
    filters: readonly NostrFilter[],
    options: { readonly timeout: number },
  ): Observable<RawRelayItem>;
  publish(event: NostrEvent): Promise<unknown>;
}

export class RelayCache {
  readonly relayCacheHealth$: BehaviorSubject<RelayCacheHealth>;
  readonly #local: LocalRelayPort;
  #writeQueue: Promise<void> = Promise.resolve();

  constructor(local: LocalRelayPort) {
    this.#local = local;
    this.relayCacheHealth$ = new BehaviorSubject<RelayCacheHealth>({
      status: "healthy",
      endpoint: local.url,
    });
  }

  readThrough(
    filters: readonly NostrFilter[],
    upstream$: Observable<RawRelayItem>,
  ): Observable<RawRelayItem> {
    const local$ = this.#local.request(filters, {
      timeout: LOCAL_RELAY_REQUEST_TIMEOUT_MS,
    }).pipe(
      filter((item) => item.type === "EVENT"),
      catchError(() => {
        this.#degrade("read-failed");
        return EMPTY;
      }),
    );
    return concat(
      local$,
      upstream$.pipe(tap((item) => {
        if (item.type === "EVENT") this.#enqueue(item.event);
      })),
    );
  }

  destroy(): void {
    this.relayCacheHealth$.complete();
  }

  #enqueue(event: NostrEvent): void {
    this.#writeQueue = this.#writeQueue.then(async () => {
      try {
        await this.#local.publish(event);
      } catch {
        this.#degrade("write-failed");
      }
    });
  }

  #degrade(reason: "read-failed" | "write-failed"): void {
    this.relayCacheHealth$.next({
      status: "degraded",
      endpoint: this.#local.url,
      reason,
    });
  }
}
