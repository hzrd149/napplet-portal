import type { NostrEvent } from "@napplet/core";
import type {
  RelayEoseMessage,
  RelayEventMessage,
  RelaySubscribeMessage,
} from "@napplet/nap/relay";

type RelayEnvelope = RelayEventMessage | RelayEoseMessage;
type RelayListener = (message: RelayEnvelope) => void;

export interface RelaySubscription {
  readonly closed: boolean;
  close(): void;
}

export class TracerRelayAdapter {
  readonly #stored: NostrEvent;
  readonly #listeners = new Map<string, Set<RelayListener>>();

  constructor(stored: NostrEvent) {
    this.#stored = stored;
  }

  subscribe(
    message: RelaySubscribeMessage,
    listener: RelayListener,
  ): RelaySubscription {
    const listeners = this.#listeners.get(message.subId) ??
      new Set<RelayListener>();
    listeners.add(listener);
    this.#listeners.set(message.subId, listeners);
    listener({
      type: "relay.event",
      subId: message.subId,
      result: { event: this.#stored },
    });
    listener({ type: "relay.eose", subId: message.subId });
    let closed = false;
    return {
      get closed() {
        return closed;
      },
      close: () => {
        closed = true;
        listeners.delete(listener);
      },
    };
  }

  emitLive(event: NostrEvent): void {
    for (const [subId, listeners] of this.#listeners) {
      for (const listener of listeners) {
        listener({ type: "relay.event", subId, result: { event } });
      }
    }
  }
}
