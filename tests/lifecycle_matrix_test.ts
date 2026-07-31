import {
  ConnectionRegistry,
  PendingCorrelations,
} from "../runtime/connections.ts";

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
    const callbacks = [...this.timers.values()];
    this.timers.clear();
    callbacks.forEach((callback) => callback());
  }
}

Deno.test("lifecycle tracer streams partial truth through reconnect and teardown", () => {
  const clock = new FakeClock();
  const delivered: string[] = [];
  const closed: string[] = [];
  let id = 0;
  const registry = new ConnectionRegistry({
    graceMs: 100,
    createId: () => `id-${++id}`,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
  });
  const first = registry.attach((message) => delivered.push(String(message)));
  const window = registry.createWindow(first.connectionId);
  const stream = (name: string) => ({
    emit: (value: string) => registry.send(first.connectionId, value),
    unsubscribe: () => closed.push(name),
  });

  const partial = stream("partial");
  registry.trackSubscription(
    first.connectionId,
    window.windowId,
    "stream",
    partial,
  );
  partial.emit("partial");
  assert(delivered.join(",") === "partial", "partial truth is immediate");

  registry.detach(first.connectionId, first.generation);
  partial.emit("stale");
  assert(delivered.join(",") === "partial", "detached delivery stays stale");
  const resumed = registry.attach(
    (message) => delivered.push(String(message)),
    first.reconnectToken,
  );
  assert(resumed.resumed, "logical connection resumes inside grace");
  partial.emit("updating");
  assert(
    delivered.join(",") === "partial,updating",
    "updates continue in order after reconnect",
  );

  const replacement = stream("replacement");
  registry.trackSubscription(
    first.connectionId,
    window.windowId,
    "stream",
    replacement,
  );
  assert(closed.join(",") === "partial", "replacement closes stale work");
  registry.detach(first.connectionId, first.generation);
  assert(
    registry.isCurrentAttachment(first.connectionId, resumed.generation),
    "a stale close cannot detach the replacement attachment",
  );
  registry.detach(first.connectionId, resumed.generation);
  clock.flush();
  assert(closed.join(",") === "partial,replacement", "expiry closes work");
  assert(registry.subscriptionCount === 0, "expiry leaves no subscriptions");

  const pending = new PendingCorrelations({
    timeoutMs: 100,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    onTimeout: () => {},
  });
  pending.register("late");
  assert(pending.pendingCount === 1, "correlation is pending");
  pending.destroy();
  assert(pending.pendingCount === 0, "shutdown leaves no pending work");
  assert(clock.timers.size === 0, "shutdown clears deterministic timers");
});
