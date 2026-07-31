import type { MediaActorRef } from "../runtime/media_reducer.ts";
import { MediaSessionCoordinator } from "../runtime/media_sessions.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const origin = Object.freeze({ connectionId: "c1", windowId: "w1" });

Deno.test("media create tracer crosses coordinator and delivery", () => {
  const delivered: Array<{ recipient: MediaActorRef; message: unknown }> = [];
  const coordinator = new MediaSessionCoordinator({
    createId: () => "server-session",
    deliver: (recipient, message) => {
      delivered.push({ recipient, message });
      return true;
    },
  });
  coordinator.connect("account", origin);
  const outcome = coordinator.receive("account", origin, {
    type: "media.session.create",
    id: "create-1",
    owner: "napplet",
    sessionId: "safe-hint",
    metadata: { title: "Track" },
  });
  assert(outcome.accepted, "create should be accepted");
  assert(outcome.session?.sessionId === "safe-hint", "safe hint should win");
  assert(delivered.length === 2, "result and projection should be delivered");
  assert(
    (delivered[0].message as { type: string }).type ===
      "media.session.create.result",
    "canonical result should be first",
  );
  assert(
    (delivered[1].message as { type: string }).type ===
      "runtime.media.snapshot",
    "portal projection should be separate",
  );
});

Deno.test("media create tracer rejects invalid input without effects", () => {
  let deliveries = 0;
  const coordinator = new MediaSessionCoordinator({
    deliver: () => {
      deliveries++;
      return true;
    },
  });
  coordinator.connect("account", origin);
  const outcome = coordinator.receive("account", origin, {
    type: "media.session.create",
    id: "create-1",
    owner: "shell",
  });
  assert(!outcome.accepted, "invalid create should fail closed");
  assert(deliveries === 0, "invalid input must produce no effects");
});

Deno.test("replacement stops old owner before result and all projections", () => {
  const deliveries: Array<{ recipient: MediaActorRef; message: unknown }> = [];
  const coordinator = new MediaSessionCoordinator({
    createId: () => "replacement",
    deliver: (recipient, message) => {
      deliveries.push({ recipient, message });
      return false;
    },
  });
  coordinator.connect("account", origin);
  coordinator.connect("account", { connectionId: "c2", windowId: "w2" });
  coordinator.receive("account", origin, {
    type: "media.session.create",
    id: "first",
    owner: "napplet",
    sessionId: "first",
  });
  deliveries.length = 0;
  const result = coordinator.receive("account", origin, {
    type: "media.session.create",
    id: "second",
    owner: "napplet",
  });
  assert(result.accepted, "replacement remains committed despite failed sends");
  assert(
    (deliveries[0].message as { type: string }).type === "media.command",
    "old owner stop is first",
  );
  assert(
    (deliveries[1].message as { type: string }).type ===
      "media.session.create.result",
    "replacement result follows revoke",
  );
});
