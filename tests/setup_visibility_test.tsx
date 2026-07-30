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

Deno.test("unconfigured portal shows setup guidance instead of a dead sign-in", () => {
  const html = renderToString(<NappletShell coordinate="" />);
  assert(
    !enclosingViewClass(html, "No napplet configured").includes(
      "shell-view-hidden",
    ),
    "setup guidance must be visible without a coordinate",
  );
  assert(
    !html.includes('id="sign-in-title"'),
    "sign-in cannot be offered when there is nothing to sign in to",
  );
});

Deno.test("configured portal offers sign-in and defers Home until signed in", () => {
  const html = renderToString(<NappletShell coordinate="naddr1example" />);
  assert(
    html.includes('id="sign-in-title"'),
    "a configured portal must offer sign-in",
  );
  assert(
    enclosingViewClass(html, 'aria-label="Home"').includes("shell-view-hidden"),
    "Home stays hidden until an account is connected",
  );
});

Deno.test("runtime transport upgrades through Fresh and cannot hang silently", async () => {
  const route = await Deno.readTextFile("routes/api/runtime.ts");
  const shell = await Deno.readTextFile("islands/NappletShell.tsx");
  assert(
    route.includes("ctx.upgrade()"),
    "upgrades must go through Fresh's documented context API",
  );
  assert(
    !route.includes("Deno.upgradeWebSocket"),
    "route must not bypass Fresh with a raw Deno upgrade",
  );
  assert(
    shell.includes("CONNECT_TIMEOUT_MS"),
    "a transport that never opens must still time out",
  );
  const timeoutBranch = shell.slice(
    shell.indexOf("connectTimer.current = setTimeout"),
    shell.indexOf('ws.addEventListener("open"'),
  );
  assert(
    timeoutBranch.includes("setSignInError(CONNECT_FAILED)"),
    "a timed-out transport must report failure to the operator",
  );
});
