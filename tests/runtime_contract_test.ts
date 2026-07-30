import type {
  RelayEventMessage,
  RelaySubscribeMessage,
} from "@napplet/nap/relay";
import {
  decodeClientMessage,
  encodeServerMessage,
} from "../runtime/transport.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("canonical NAP 0.31 relay envelopes retain correlation and ownership", () => {
  const subscribe: RelaySubscribeMessage = {
    type: "relay.subscribe",
    id: "request-1",
    subId: "security-stream",
    filters: [{ kinds: [1], limit: 2 }],
  };

  const decoded = decodeClientMessage(
    JSON.stringify({
      type: "runtime.forward",
      connectionId: "connection-1",
      windowId: "window-1",
      message: subscribe,
    }),
    { connectionId: "connection-1", windowId: "window-1" },
  );
  assert(decoded.ok, "owned relay.subscribe should decode");

  const foreign = decodeClientMessage(
    JSON.stringify({
      type: "runtime.forward",
      connectionId: "connection-2",
      windowId: "window-1",
      message: subscribe,
    }),
    { connectionId: "connection-1", windowId: "window-1" },
  );
  assert(!foreign.ok, "foreign connection ownership must be rejected");

  const event: RelayEventMessage = {
    type: "relay.event",
    subId: "security-stream",
    result: {
      event: {
        id: "event-initial",
        pubkey: "0".repeat(64),
        created_at: 1,
        kind: 1,
        tags: [],
        content: "initial",
        sig: "0".repeat(128),
      },
    },
  };
  const encoded = encodeServerMessage("connection-1", "window-1", event);
  assert(
    encoded.includes('"relay.event"'),
    "server envelope should retain canonical type",
  );
});
