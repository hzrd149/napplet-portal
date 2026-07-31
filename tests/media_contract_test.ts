import { decodeMediaMessage } from "../runtime/media_contract.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("media create tracer validates the exact pinned envelope", () => {
  const decoded = decodeMediaMessage({
    type: "media.session.create",
    id: "create-1",
    owner: "napplet",
    metadata: { title: "Track" },
  });
  assert(decoded.ok, "exact napplet-owned create should decode");
  assert(Object.isFrozen(decoded.value), "decoded message should be immutable");

  assert(
    !decodeMediaMessage({
      type: "media.session.create",
      id: "create-2",
      owner: "shell",
    }).ok,
    "shell-owned create requires a source",
  );
  assert(
    !decodeMediaMessage({
      type: "media.session.create",
      id: "create-3",
      owner: "napplet",
      generation: 1,
    }).ok,
    "portal fields must fail exact validation",
  );
});

Deno.test("all eight pinned media envelopes validate exact keys and values", () => {
  const valid = [
    { type: "media.session.create", id: "1", owner: "napplet" },
    {
      type: "media.session.create.result",
      id: "1",
      sessionId: "s",
      owner: "napplet",
    },
    { type: "media.session.update", sessionId: "s", metadata: {} },
    { type: "media.session.destroy", sessionId: "s" },
    { type: "media.state", sessionId: "s", status: "playing", position: 0 },
    { type: "media.capabilities", sessionId: "s", actions: ["play", "stop"] },
    { type: "media.command", sessionId: "s", action: "seek", value: 2 },
    { type: "media.controls", sessionId: "s", controls: ["play", "stop"] },
  ];
  for (const message of valid) {
    assert(decodeMediaMessage(message).ok, message.type);
  }
  assert(
    !decodeMediaMessage({
      type: "media.command",
      sessionId: "s",
      action: "play",
      value: 1,
    }).ok,
    "value is absent for non-valued actions",
  );
  assert(
    !decodeMediaMessage({
      type: "media.state",
      sessionId: "s",
      status: "playing",
      position: Number.POSITIVE_INFINITY,
    }).ok,
    "state numbers must be finite",
  );
});
