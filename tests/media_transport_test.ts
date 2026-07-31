import { decodeMediaMessage } from "../runtime/media_contract.ts";
import {
  decodeClientMessage,
  decodePortalMediaCommand,
} from "../runtime/transport.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("snapshot-first two socket tracer validates disjoint portal controls", () => {
  const owner = { connectionId: "c1", windowId: "w1" };
  const transfer = decodePortalMediaCommand({
    type: "runtime.media.transfer",
    id: "transfer-1",
    sessionId: "session-1",
    generation: 3,
  });
  assert(transfer?.type === "runtime.media.transfer", "transfer is decoded");
  assert(
    decodePortalMediaCommand({ ...transfer, accountId: "spoofed" }) === null,
    "portal controls reject server-owned account identity",
  );
  assert(
    !decodeMediaMessage(transfer).ok,
    "portal transfer cannot enter canonical MEDIA decoding",
  );
  const forwarded = decodeClientMessage(JSON.stringify({
    type: "runtime.forward",
    connectionId: "c1",
    windowId: "w1",
    generation: 3,
    message: {
      type: "media.state",
      sessionId: "session-1",
      status: "playing",
    },
  }), owner);
  assert(forwarded.ok && forwarded.value.generation === 3, "outer generation retained");
});

Deno.test("snapshot-first two socket tracer rejects malformed and nested portal messages", () => {
  const owner = { connectionId: "c1", windowId: "w1" };
  assert(
    decodePortalMediaCommand({
      type: "runtime.media.stop",
      id: "stop-1",
      sessionId: "session-1",
      generation: -1,
    }) === null,
    "negative generations fail closed",
  );
  assert(
    !decodeClientMessage(JSON.stringify({
      type: "runtime.forward",
      connectionId: "c1",
      windowId: "w1",
      message: {
        type: "runtime.media.stop",
        id: "stop-1",
        sessionId: "session-1",
        generation: 1,
      },
    }), owner).ok,
    "portal controls are never forwarded to an iframe",
  );
});
