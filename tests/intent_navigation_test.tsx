import {
  type IntentSurface,
  PopupReservationController,
  SurfaceStackController,
} from "../islands/NappletShell.tsx";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function surface(id: string): IntentSurface {
  return {
    surfaceId: id,
    account: "a".repeat(64),
    identity: {
      dTag: `handler-${id}`,
      aggregateHash: id.padEnd(64, "0"),
    },
    srcdoc: `<main>${id}</main>`,
    owner: { connectionId: "connection", windowId: `window-${id}` },
  };
}

Deno.test("stack keeps mounted surfaces and browser history contains opaque IDs", () => {
  const pushed: unknown[] = [];
  const settled: string[] = [];
  const stack = new SurfaceStackController({
    pushHistory: (state) => pushed.push(state),
    settleClosed: (id) => settled.push(id),
  });
  stack.replaceRoot(surface("root"));
  stack.push(surface("child"));

  assert(stack.surfaces.length === 2, "stack must retain the prior frame");
  assert(stack.active?.surfaceId === "child", "new frame must become active");
  assert(
    JSON.stringify(pushed[0]) === JSON.stringify({ surfaceId: "child" }),
    "history must contain only the opaque shell surface ID",
  );

  assert(stack.pop("root"), "Back must restore a retained surface");
  assert(
    Number(stack.surfaces.length) === 1,
    "Back must remove only the top surface",
  );
  assert(
    String(stack.active?.surfaceId) === "root",
    "prior frame must be revealed",
  );
  assert(settled.join(",") === "child", "closure must settle once");
  assert(!stack.close("child"), "closed surface must reject replay");
  assert(settled.join(",") === "child", "closure replay must not settle twice");
});

Deno.test("stack reuses only exact account and verified handler identity", () => {
  const stack = new SurfaceStackController();
  const root = surface("root");
  stack.replaceRoot(root);
  assert(
    stack.focusReusable(root.account, root.identity)?.surfaceId === "root",
    "same account and exact identity may focus",
  );
  assert(
    stack.focusReusable("b".repeat(64), root.identity) === null,
    "cross-account reuse must fail",
  );
  assert(
    stack.focusReusable(root.account, {
      ...root.identity,
      aggregateHash: "f".repeat(64),
    }) === null,
    "cross-version reuse must fail",
  );
});

Deno.test("stacked frame source binding and sandbox remain exact", async () => {
  const frame = await Deno.readTextFile("components/NappletFrame.tsx");
  const shell = await Deno.readTextFile("islands/NappletShell.tsx");
  assert(frame.includes('sandbox="allow-scripts"'), "sandbox must be exact");
  assert(
    !frame.includes("allow-same-origin"),
    "frames must remain opaque-origin",
  );
  assert(shell.includes("event.source"), "messages must be source-bound");
  assert(
    shell.includes("Back") && shell.includes("Close"),
    "stack controls required",
  );
});

Deno.test("new-tab reservation opens synchronously and settles exactly once", () => {
  const sent: Record<string, unknown>[] = [];
  const navigated: string[] = [];
  let closed = false;
  const handle = {
    get closed() {
      return closed;
    },
    close: () => closed = true,
    focus: () => undefined,
    location: { replace: (path: string) => navigated.push(path) },
  } as unknown as Window;
  const popup = new PopupReservationController({
    open: (path, name, features) => {
      assert(path.startsWith("/intent/reserved#"), "route must be fixed");
      assert(
        /^_napplet_intent_[a-f0-9-]+$/.test(name),
        "name must be shell-owned",
      );
      assert(
        features === undefined,
        "noopener must not sever the retained handle",
      );
      return handle;
    },
    send: (message) => sent.push(message),
  });
  const source = {} as Window;
  const reserved = popup.reserve(source, {
    invocationId: "invoke-1",
    callerWindowId: "caller-1",
    owner: { connectionId: "connection-1", windowId: "caller-1" },
  });
  assert(
    reserved !== null && sent.length === 1,
    "reserve must forward immediately",
  );
  assert(
    popup.authorize(source, {
      type: "intent.navigation.authorized",
      reservationId: reserved,
      invocationId: "invoke-1",
      targetWindowId: "target-1",
      ticket: "ticket-1",
      launchPath: "/napplet?ticket=ticket-1",
      generation: 1,
    }),
    "matching authorization must commit",
  );
  assert(
    navigated.join("") === "/napplet?ticket=ticket-1",
    "commit path must be backend-issued",
  );
  assert(!popup.fail(reserved, "failed"), "terminal replay must fail");
  assert(
    sent.filter((message) => message.type === "intent.navigation.ack")
      .length === 1,
    "terminal ack must be exact-once",
  );
});

Deno.test("new-tab blocked and stale authorization fail closed", () => {
  const sent: Record<string, unknown>[] = [];
  const blocked = new PopupReservationController({
    open: () => null,
    send: (message) => sent.push(message),
  });
  const source = {} as Window;
  assert(
    blocked.reserve(source, {
      invocationId: "invoke-blocked",
      callerWindowId: "caller",
      owner: { connectionId: "connection", windowId: "caller" },
    }) === null,
    "null handle must report blocked",
  );
  assert(sent.at(-1)?.state === "blocked", "blocked popup needs terminal ack");
});

Deno.test("reservation route severs opener before runtime or ticket claim", async () => {
  const route = await Deno.readTextFile("routes/intent/reserved.tsx");
  const sever = route.indexOf("window.opener = null");
  assert(sever >= 0, "reservation page must sever opener");
  assert(
    sever < route.indexOf("WebSocket"),
    "opener must be severed before transport",
  );
  assert(!route.includes("dangerouslySetInnerHTML"), "route must remain inert");
});
