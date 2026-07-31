import {
  type IntentSurface,
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
  assert(stack.surfaces.length === 1, "Back must remove only the top surface");
  assert(stack.active?.surfaceId === "root", "prior frame must be revealed");
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
  assert(!frame.includes("allow-same-origin"), "frames must remain opaque-origin");
  assert(shell.includes("event.source"), "messages must be source-bound");
  assert(shell.includes("Back") && shell.includes("Close"), "stack controls required");
});
