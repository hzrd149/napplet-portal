import { MediaSessionCoordinator } from "../runtime/media_sessions.ts";
import type { MediaActorRef } from "../runtime/media_reducer.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const a = Object.freeze({ connectionId: "a", windowId: "wa" });
const b = Object.freeze({ connectionId: "b", windowId: "wb" });

function setup() {
  const effects: Array<
    { recipient: MediaActorRef; message: Record<string, unknown> }
  > = [];
  const coordinator = new MediaSessionCoordinator({
    createId: () => "generated",
    deliver: (recipient, message) => {
      effects.push({
        recipient,
        message: message as unknown as Record<string, unknown>,
      });
      return true;
    },
  });
  coordinator.connect("account", a);
  coordinator.connect("account", b);
  const created = coordinator.receive("account", a, {
    type: "media.session.create",
    id: "create",
    owner: "napplet",
    sessionId: "session",
  });
  assert(created.session, "session should exist");
  effects.length = 0;
  return { coordinator, effects, generation: created.session.generation };
}

Deno.test("transfer commits revoke and stop before grant and broadcast", () => {
  const { coordinator, effects, generation } = setup();
  const result = coordinator.transfer(
    "account",
    b,
    "session",
    generation,
    "transfer-1",
  );
  assert(
    result.accepted && result.session?.owner?.windowId === "wb",
    "new owner wins",
  );
  assert(result.session.generation === generation + 1, "generation increments");
  assert(
    effects[0].recipient.windowId === "wa",
    "prior owner is addressed first",
  );
  assert(
    effects[0].message.type === "media.command",
    "prior owner receives canonical stop",
  );
  assert(
    effects[1].recipient.windowId === "wb",
    "new owner grant follows stop",
  );
  assert(
    effects[1].message.type === "runtime.media.grant",
    "grant follows stop",
  );
  assert(
    effects.slice(2).every((effect) =>
      effect.message.type === "runtime.media.snapshot"
    ),
    "broadcast follows grant",
  );
});

Deno.test("owner loss is ownerless stopped and origin expiry terminalizes", () => {
  const { coordinator } = setup();
  const lost = coordinator.detach(a);
  assert(lost[0]?.session?.owner === null, "detach immediately revokes owner");
  assert(
    lost[0]?.session?.status === "stopped",
    "ownerless session is stopped",
  );
  assert(
    lost[0]?.session?.transferable,
    "ownerless session remains transferable",
  );
  const expired = coordinator.expireOrigin(a);
  assert(expired[0]?.session?.terminal, "origin expiry terminalizes session");
  assert(expired[0]?.session?.owner === null, "terminal session has no owner");
});

Deno.test("stale reports fail and every accepted report broadcasts", () => {
  const { coordinator, effects, generation } = setup();
  assert(
    !coordinator.receive("account", b, {
      type: "media.state",
      sessionId: "session",
      status: "playing",
      position: 1,
    }, { generation }).accepted,
    "non-owner report fails",
  );
  assert(effects.length === 0, "rejected report has no effects");
  const accepted = coordinator.receive("account", a, {
    type: "media.state",
    sessionId: "session",
    status: "playing",
    position: 1,
  }, { generation });
  assert(accepted.accepted, "current owner report succeeds");
  assert(
    effects.length === 2,
    "each eligible tab receives accepted transition",
  );
});

Deno.test("duplicate transfer is effect-free and conflicting id fails", () => {
  const { coordinator, effects, generation } = setup();
  const first = coordinator.transfer(
    "account",
    b,
    "session",
    generation,
    "same",
  );
  assert(first.accepted, "first transfer succeeds");
  effects.length = 0;
  assert(
    coordinator.transfer("account", b, "session", generation, "same").accepted,
    "exact retry replays accepted outcome",
  );
  assert(effects.length === 0, "exact retry has no effects");
  assert(
    !coordinator.stop(
      "account",
      b,
      "session",
      first.session!.generation,
      "same",
    ).accepted,
    "same request id with different payload fails",
  );
});
