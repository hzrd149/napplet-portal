import {
  ConnectionRegistry,
  PendingCorrelations,
} from "../runtime/connections.ts";
import {
  ExpiringCorrelationRegistry,
  isSameOriginRuntimeRequest,
} from "../routes/api/runtime.ts";

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
  const first = registry.attach((message) => {
    if (typeof message === "string") firstMessages.push(message);
  });
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
    (message) => {
      if (typeof message === "string") secondMessages.push(message);
    },
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

Deno.test("reconnect rebinds connection output to the resumed sender", () => {
  const first: (string | ArrayBuffer)[] = [];
  const resumed: (string | ArrayBuffer)[] = [];
  let sequence = 0;
  const registry = new ConnectionRegistry({
    createId: () => `id-${++sequence}`,
  });
  const initial = registry.attach((message) => first.push(message));
  registry.detach(initial.connectionId);
  const next = registry.attach(
    (message) => resumed.push(message),
    initial.reconnectToken,
  );
  assert(next.resumed, "session must resume");
  assert(registry.send(next.connectionId, "authorized"), "send must succeed");
  assert(first.length === 0, "closed sender must not receive bridge output");
  assert(resumed[0] === "authorized", "resumed sender must receive output");
});

Deno.test("intent correlations are bounded, expiring, and reject duplicates", () => {
  const timers = new Map<number, () => void>();
  let sequence = 0;
  const registry = new ExpiringCorrelationRegistry<string>(
    2,
    10,
    (callback) => {
      const id = ++sequence;
      timers.set(id, callback);
      return id;
    },
    (id) => timers.delete(id),
  );
  assert(registry.add("a", "first"), "first correlation accepted");
  assert(!registry.add("a", "duplicate"), "duplicate rejected");
  assert(registry.add("b", "second"), "capacity accepts second");
  assert(!registry.add("c", "overflow"), "capacity is enforced");
  timers.values().next().value?.();
  assert(registry.size < 2, "expired correlation is removed");
  registry.clear();
  const finalSize = registry.size;
  const finalTimers = timers.size;
  assert(finalSize === 0 && finalTimers === 0, "close clears timers");
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

Deno.test("runtime websocket rejects missing and cross-site origins", () => {
  const sameOrigin = new Request("http://127.0.0.1:8000/api/runtime", {
    headers: { origin: "http://127.0.0.1:8000" },
  });
  const crossOrigin = new Request("http://127.0.0.1:8000/api/runtime", {
    headers: { origin: "https://evil.example" },
  });
  const missingOrigin = new Request("http://127.0.0.1:8000/api/runtime");

  assert(
    isSameOriginRuntimeRequest(sameOrigin),
    "same-origin browser websocket must be allowed",
  );
  assert(
    !isSameOriginRuntimeRequest(crossOrigin),
    "cross-site browser websocket must be rejected",
  );
  assert(
    !isSameOriginRuntimeRequest(missingOrigin),
    "missing origin must fail closed for browser command sockets",
  );
});
