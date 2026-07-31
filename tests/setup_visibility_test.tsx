import { renderToString } from "npm:preact-render-to-string@^6.6.3";
import NappletShell from "../islands/NappletShell.tsx";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Class list of the nearest enclosing shell view, which decides visibility. */
function enclosingViewClass(html: string, needle: string): string {
  const index = html.indexOf(needle);
  assert(index >= 0, `markup must contain: ${needle}`);
  const before = html.slice(0, index);
  const start = before.lastIndexOf('class="shell-view');
  assert(start >= 0, `no enclosing shell view for: ${needle}`);
  return /class="([^"]*)"/.exec(before.slice(start))?.[1] ?? "";
}

Deno.test("unconfigured portal shows setup guidance instead of embedded sign-in", () => {
  const html = renderToString(<NappletShell coordinate="" />);
  assert(
    !enclosingViewClass(html, "No napplet configured").includes(
      "shell-view-hidden",
    ),
    "setup guidance must be visible without a coordinate",
  );
  assert(
    !html.includes('id="sign-in-title"'),
    "sign-in must live on its dedicated route",
  );
});

Deno.test("configured portal links to sign-in and keeps Home independent", () => {
  const html = renderToString(<NappletShell coordinate="naddr1example" />);
  assert(
    html.includes('href="/signin"'),
    "a configured portal must link to dedicated sign-in",
  );
  assert(
    !enclosingViewClass(html, 'aria-label="Home"').includes(
      "shell-view-hidden",
    ),
    "Home remains visible without coupling to runtime startup",
  );
});

Deno.test("runtime transport upgrades through Fresh and cannot hang silently", async () => {
  const route = await Deno.readTextFile("routes/api/runtime.ts");
  const shell = await Deno.readTextFile("islands/NappletShell.tsx");
  const connection = await Deno.readTextFile("shell/connection.ts");
  assert(
    route.includes("ctx.upgrade()"),
    "upgrades must go through Fresh's documented context API",
  );
  assert(
    !route.includes("Deno.upgradeWebSocket"),
    "route must not bypass Fresh with a raw Deno upgrade",
  );
  assert(
    connection.includes("connectTimeoutMs"),
    "a transport that never opens must still time out",
  );
  assert(
    connection.includes("#terminateAttempt(socket, generation)") &&
      shell.includes('snapshot.phase === "failed"') &&
      shell.includes("setRuntimeError(CONNECT_FAILED)"),
    "a timed-out transport must enter visible recovery policy",
  );
});
