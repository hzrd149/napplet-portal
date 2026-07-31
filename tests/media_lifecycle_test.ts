import { ConnectionRegistry } from "../runtime/connections.ts";
import type { MediaActorRef } from "../runtime/media_reducer.ts";
import { MediaSessionCoordinator } from "../runtime/media_sessions.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class FakeClock {
  readonly timers = new Map<number, () => void>();
  #next = 1;
  setTimeout = (callback: () => void): number => {
    const id = this.#next++;
    this.timers.set(id, callback);
    return id;
  };
  clearTimeout = (id: number): void => {
    this.timers.delete(id);
  };
  flush(): void {
    const pending = [...this.timers.values()];
    this.timers.clear();
    pending.forEach((callback) => callback());
  }
}

Deno.test("detach revokes immediately while origin expires after grace", () => {
  const effects: Array<
    { recipient: MediaActorRef; message: { type: string } }
  > = [];
  const coordinator = new MediaSessionCoordinator({
    createId: () => "session",
    deliver: (recipient, message) => {
      effects.push({ recipient, message });
      return true;
    },
  });
  const clock = new FakeClock();
  let sequence = 0;
  const lifecycle: { actor?: MediaActorRef } = {};
  const registry = new ConnectionRegistry({
    createId: () => `id-${++sequence}`,
    graceMs: 100,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    detachConnection: (connectionId) =>
      coordinator.detach({ ...lifecycle.actor!, connectionId }),
    destroyWindow: () => coordinator.expireOrigin(lifecycle.actor!),
  });
  const attached = registry.attach(() => {});
  const window = registry.createWindow(attached.connectionId);
  const actor = {
    connectionId: attached.connectionId,
    windowId: window.windowId,
  };
  lifecycle.actor = actor;
  coordinator.connect("account", actor);
  coordinator.connect("foreign", { connectionId: "foreign", windowId: "wf" });
  coordinator.receive("account", actor, {
    type: "media.session.create",
    id: "create",
    owner: "napplet",
  });
  assert(
    effects.every((effect) => effect.recipient.connectionId !== "foreign"),
    "foreign-account recipients receive no canonical or portal media",
  );
  effects.length = 0;
  registry.detach(attached.connectionId);
  assert(
    coordinator.current("account")?.owner === null,
    "detach revokes owner now",
  );
  assert(
    !coordinator.current("account")?.terminal,
    "origin remains during grace",
  );
  const resumed = registry.attach(() => {}, attached.reconnectToken);
  assert(resumed.resumed, "connection resumes inside grace");
  assert(
    coordinator.current("account")?.owner === null,
    "resume never restores ownership",
  );
  registry.detach(attached.connectionId);
  clock.flush();
  assert(
    coordinator.current("account") === null,
    "origin expiry removes active session",
  );
});

Deno.test("account change and shutdown stop before terminal snapshot", () => {
  const messages: Array<{ type: string }> = [];
  const actor = { connectionId: "c1", windowId: "w1" };
  const coordinator = new MediaSessionCoordinator({
    deliver: (_recipient, message) => {
      messages.push(message);
      return true;
    },
  });
  coordinator.connect("old", actor);
  coordinator.receive("old", actor, {
    type: "media.session.create",
    id: "create",
    owner: "napplet",
    sessionId: "one",
  });
  messages.length = 0;
  coordinator.changeAccount("old");
  assert(
    messages[0]?.type === "media.command",
    "account change sends stop first",
  );
  assert(
    messages[1]?.type === "runtime.media.snapshot",
    "terminal snapshot follows stop",
  );

  coordinator.connect("new", actor);
  coordinator.receive("new", actor, {
    type: "media.session.create",
    id: "create-new",
    owner: "napplet",
    sessionId: "two",
  });
  messages.length = 0;
  coordinator.destroy();
  assert(messages[0]?.type === "media.command", "shutdown sends stop first");
  assert(
    messages[1]?.type === "runtime.media.snapshot",
    "shutdown terminalizes after stop",
  );
});

Deno.test("owner send failure commits newer ownerless generation", () => {
  const actor = { connectionId: "c1", windowId: "w1" };
  let failCommand = false;
  const coordinator = new MediaSessionCoordinator({
    deliver: (_recipient, message) =>
      !(failCommand && message.type === "media.command"),
  });
  coordinator.connect("account", actor);
  const created = coordinator.receive("account", actor, {
    type: "media.session.create",
    id: "create",
    owner: "napplet",
    sessionId: "one",
  });
  failCommand = true;
  coordinator.receive("account", actor, {
    type: "media.command",
    sessionId: "one",
    action: "play",
  }, { generation: created.session?.generation });
  const current = coordinator.current("account");
  assert(current?.owner === null, "failed owner delivery revokes ownership");
  assert(
    current!.generation > created.session!.generation,
    "failure advances generation",
  );
});
