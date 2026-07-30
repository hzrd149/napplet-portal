import type {
  RelayClosedMessage,
  RelayCloseMessage,
  RelayEoseMessage,
  RelayEventMessage,
  RelayQueryResultMessage,
  RelaySubscribeMessage,
} from "@napplet/nap/relay";
import type {
  OutboxClosedMessage,
  OutboxEventMessage,
  OutboxSubscribeMessage,
} from "@napplet/nap/outbox";
import type { RuntimeAdapter } from "@kehto/runtime";
import fixture from "./fixtures/supplied_napplet_contract.json" with {
  type: "json",
};
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

Deno.test("pinned Kehto and NAP types compile across portal adapter boundaries", () => {
  const adapter = {} as RuntimeAdapter;
  const subscribe = fixture.envelopes.relaySubscribe as RelaySubscribeMessage;
  const close = fixture.envelopes.relayClose as RelayCloseMessage;
  const outbox = fixture.envelopes.outboxSubscribe as OutboxSubscribeMessage;
  assert(adapter !== null, "pinned Kehto RuntimeAdapter must be importable");
  assert(subscribe.id === fixture.correlation.success, "relay id must compile");
  assert(close.subId === subscribe.subId, "close must retain stream identity");
  assert(outbox.id === fixture.correlation.outbox, "outbox id must compile");
});

Deno.test("serialized pinned fixtures round-trip correlation, errors, and terminal stream frames", () => {
  const frames: Array<
    | RelayQueryResultMessage
    | RelayEoseMessage
    | RelayClosedMessage
    | OutboxEventMessage
    | OutboxClosedMessage
  > = fixture.lifecycleFrames as typeof frames;
  const roundTrip = JSON.parse(JSON.stringify(frames)) as typeof frames;

  assert(
    roundTrip[0]?.type === "relay.query.result",
    "success must round-trip",
  );
  assert(
    roundTrip[0]?.id === fixture.correlation.success,
    "success correlation must survive serialization",
  );
  assert(
    roundTrip[1]?.type === "relay.query.result" &&
      roundTrip[1].error === fixture.typedError,
    "typed error must retain correlation and reason",
  );
  assert(roundTrip[2]?.type === "relay.eose", "EOSE must be explicit");
  assert(roundTrip[3]?.type === "relay.closed", "relay close must be terminal");
  assert(
    roundTrip[5]?.type === "outbox.closed",
    "outbox close must be terminal",
  );
});
