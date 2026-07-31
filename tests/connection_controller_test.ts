import {
  computeRetryDelay,
  ConnectionController,
  type ConnectionSnapshot,
  type SocketLike,
} from "../shell/connection.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class FakeSocket extends EventTarget implements SocketLike {
  readyState = 0;
  sent: string[] = [];
  closed = false;

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    this.readyState = 3;
  }

  open(): void {
    this.readyState = 1;
    this.dispatchEvent(new Event("open"));
  }

  message(value: unknown): void {
    this.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify(value),
      }),
    );
  }

  fail(): void {
    this.dispatchEvent(new Event("error"));
    this.dispatchEvent(new CloseEvent("close"));
  }
}

function harness() {
  const sockets: FakeSocket[] = [];
  const timers = new Map<number, () => void>();
  let timerId = 0;
  let visible = true;
  let online = true;
  const snapshots: ConnectionSnapshot[] = [];
  const controller = new ConnectionController({
    coordinate: "naddr1test",
    createSocket: (url) => {
      assert(url.startsWith("ws://portal.test/api/runtime"), "same endpoint");
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    socketBaseUrl: "ws://portal.test/api/runtime",
    setTimer: (callback) => {
      const id = ++timerId;
      timers.set(id, callback);
      return id;
    },
    clearTimer: (id) => timers.delete(id),
    random: () => 0.5,
    isVisible: () => visible,
    isOnline: () => online,
    onSnapshot: (snapshot) => snapshots.push(snapshot),
  });
  return {
    controller,
    sockets,
    timers,
    snapshots,
    setVisible(value: boolean) {
      visible = value;
      controller.visibilityChanged();
    },
    setOnline(value: boolean) {
      online = value;
      controller.onlineChanged();
    },
    runTimer() {
      const entry = timers.entries().next().value as
        | [number, () => void]
        | undefined;
      assert(entry, "expected timer");
      timers.delete(entry[0]);
      entry[1]();
    },
  };
}

Deno.test("full jitter is deterministic, exponential, and capped", () => {
  assert(computeRetryDelay(1, () => 0.5) === 250, "first window is 500ms");
  assert(computeRetryDelay(4, () => 0.5) === 2_000, "window doubles");
  assert(computeRetryDelay(20, () => 1) === 30_000, "window caps at 30s");
});

Deno.test("unexpected close reconnects once with the opaque token", () => {
  const h = harness();
  h.controller.start();
  const first = h.sockets[0];
  first.open();
  first.message({
    type: "runtime.connected",
    connectionId: "connection-a",
    windowId: "window-a",
    reconnectToken: "opaque+/token",
  });
  assert(first.sent.length === 1, "connected sends one runtime.start");
  first.fail();
  assert(h.timers.size === 1, "error plus close schedules one timer");
  h.runTimer();
  assert(h.sockets.length === 2, "one reconnect socket is created");
  assert(
    h.controller.snapshot.phase === "retrying",
    "reconnect uses retrying truth",
  );
  h.sockets[1].open();
  h.sockets[1].message({
    type: "runtime.connected",
    connectionId: "connection-a",
    windowId: "window-a",
    reconnectToken: "opaque+/token",
  });
  assert(h.sockets[1].sent.length === 1, "resume sends runtime.start once");
});

Deno.test("stale callbacks and simultaneous triggers cannot create two attempts", () => {
  const h = harness();
  h.controller.start();
  const old = h.sockets[0];
  h.controller.retryNow();
  assert(old.closed, "manual replacement supersedes before close");
  assert(h.sockets.length === 2, "manual retry creates one replacement");
  old.dispatchEvent(new CloseEvent("close"));
  h.controller.onlineChanged();
  h.controller.visibilityChanged();
  assert(h.sockets.length === 2, "stale and lifecycle callbacks are guarded");
  assert(h.timers.size === 1, "only the active attempt owns its timeout");
});

Deno.test("hidden and offline states cancel timers then resume promptly", () => {
  const h = harness();
  h.controller.start();
  h.sockets[0].fail();
  h.setVisible(false);
  assert(h.timers.size === 0, "hidden tab owns no retry timer");
  assert(h.controller.snapshot.phase === "dormant", "hidden is dormant");
  h.setVisible(true);
  assert(h.sockets.length === 2, "visible resumes one prompt attempt");
  h.sockets[1].fail();
  h.setOnline(false);
  assert(h.timers.size === 0, "offline tab owns no timer");
  h.setOnline(true);
  assert(Number(h.sockets.length) === 3, "online resumes one prompt attempt");
});

Deno.test("repeated failure exposes Retry and continues quiet recovery", () => {
  const h = harness();
  h.controller.start();
  for (let failure = 0; failure < 3; failure++) {
    h.sockets.at(-1)!.fail();
    h.runTimer();
  }
  h.sockets.at(-1)!.fail();
  assert(h.controller.snapshot.canRetry, "Retry appears after three failures");
  assert(h.controller.snapshot.phase === "failed", "fracture becomes stable");
  assert(h.timers.size === 1, "automatic recovery remains scheduled");
  assert(
    h.controller.snapshot.nextRetryMs === 60_000,
    "quiet recovery uses low frequency cadence",
  );
});

Deno.test("only a verified artifact resets failure count; stop cannot reopen", () => {
  const h = harness();
  h.controller.start();
  h.sockets[0].fail();
  h.runTimer();
  const active = h.sockets[1];
  active.open();
  active.message({
    type: "runtime.connected",
    connectionId: "c",
    windowId: "w",
    reconnectToken: "secret",
  });
  assert(
    h.controller.snapshot.failures === 1,
    "connected does not reset failures",
  );
  active.message({
    type: "runtime.artifact",
    srcdoc: "<p>ok</p>",
    identity: { dTag: "test", aggregateHash: "hash" },
  });
  assert(h.controller.snapshot.phase === "ready", "artifact proves ready");
  assert(Number(h.controller.snapshot.failures) === 0, "ready resets failures");
  h.controller.stop();
  active.dispatchEvent(new CloseEvent("close"));
  h.controller.retryNow();
  assert(h.timers.size === 0 && h.sockets.length === 2, "stop is terminal");
});
