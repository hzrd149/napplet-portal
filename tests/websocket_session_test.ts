import {
  ConnectionRegistry,
  PendingCorrelations,
} from "../runtime/connections.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class FakeClock {
  now = 0;
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

Deno.test("reconnect reattaches namespace without duplicating subscriptions", () => {
  const clock = new FakeClock();
  let sequence = 0;
  const registry = new ConnectionRegistry({
    graceMs: 5_000,
    createId: () => `server-${++sequence}`,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
  });
  const firstMessages: string[] = [];
  const first = registry.attach((message) => firstMessages.push(message));
  const window = registry.createWindow(first.connectionId);
  let unsubscribeCount = 0;
  registry.trackSubscription(
    first.connectionId,
    window.windowId,
    "shared-sub",
    {
      unsubscribe: () => unsubscribeCount++,
    },
  );

  registry.detach(first.connectionId);
  const secondMessages: string[] = [];
  const resumed = registry.attach(
    (message) => secondMessages.push(message),
    first.reconnectToken,
  );
  assert(
    resumed.connectionId === first.connectionId,
    "token must resume connection",
  );
  assert(
    registry.subscriptionCount === 1,
    "resume must not duplicate subscription",
  );
  registry.send(first.connectionId, "live");
  assert(firstMessages.length === 0, "detached socket must not receive data");
  assert(secondMessages[0] === "live", "replacement socket must receive data");
  clock.flush();
  assert(unsubscribeCount === 0, "cancelled grace timer must not clean up");
});

Deno.test("ownership is connection-scoped and expiry deletes before unsubscribe", () => {
  const clock = new FakeClock();
  let sequence = 0;
  const destroyed: string[] = [];
  const registry = new ConnectionRegistry({
    graceMs: 5_000,
    createId: () => `server-${++sequence}`,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    destroyWindow: (windowId) => destroyed.push(windowId),
  });
  const one = registry.attach(() => {});
  const two = registry.attach(() => {});
  const oneWindow = registry.createWindow(one.connectionId);
  const twoWindow = registry.createWindow(two.connectionId);
  let ownedDuringUnsubscribe = true;
  registry.trackSubscription(one.connectionId, oneWindow.windowId, "same", {
    unsubscribe: () => {
      ownedDuringUnsubscribe = registry.ownsWindow(
        one.connectionId,
        oneWindow.windowId,
      );
    },
  });
  registry.trackSubscription(two.connectionId, twoWindow.windowId, "same", {
    unsubscribe: () => {},
  });

  assert(
    !registry.ownsWindow(one.connectionId, twoWindow.windowId),
    "cross-tab namespace claim must fail",
  );
  registry.detach(one.connectionId);
  clock.flush();
  assert(
    !ownedDuringUnsubscribe,
    "ownership must be deleted before unsubscribe",
  );
  assert(
    destroyed.length === 1 && destroyed[0] === oneWindow.windowId,
    "expiry must destroy only detached windows",
  );
  assert(
    registry.ownsWindow(two.connectionId, twoWindow.windowId),
    "other connection must survive",
  );
  assert(registry.subscriptionCount === 1, "other subscription must survive");
});

Deno.test("recognized timeout preserves original correlation ID", () => {
  const clock = new FakeClock();
  const replies: Array<{ id: string; error: string }> = [];
  const pending = new PendingCorrelations({
    timeoutMs: 1_000,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    onTimeout: (id) => replies.push({ id, error: "request timed out" }),
  });
  pending.register("opaque-request-id");
  clock.flush();
  assert(
    replies[0]?.id === "opaque-request-id",
    "timeout must retain request ID",
  );
});
