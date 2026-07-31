import { renderToString } from "npm:preact-render-to-string@^6.6.3";
import {
  PORTAL_GATE_GEOMETRY_ID,
  PORTAL_GATE_LINK_ID,
  PORTAL_GATE_NODE_ID,
  PortalMark,
} from "../components/PortalMark.tsx";
import { ConnectionConstellation } from "../components/ConnectionConstellation.tsx";
import type { ConnectionSnapshot } from "../shell/connection.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const ready: ConnectionSnapshot = {
  phase: "ready",
  mode: "cold",
  failures: 0,
  canRetry: false,
  nextRetryMs: null,
  online: true,
};

Deno.test("portal mark is the canonical ready constellation geometry", () => {
  const mark = renderToString(<PortalMark />);
  const readyRitual = renderToString(
    <ConnectionConstellation state={ready} compact={false} />,
  );

  for (
    const identifier of [
      PORTAL_GATE_GEOMETRY_ID,
      PORTAL_GATE_LINK_ID,
      PORTAL_GATE_NODE_ID,
    ]
  ) {
    assert(mark.includes(identifier), `inline mark contains ${identifier}`);
    assert(
      readyRitual.includes(identifier),
      `ready ritual derives from canonical ${identifier}`,
    );
  }
  assert(
    readyRitual.includes("portal-mark"),
    "ready ritual renders the shared portal mark",
  );
});

Deno.test("canonical logo matches component geometry and supports both themes", async () => {
  const logo = await Deno.readTextFile("static/logo.svg");
  const styles = await Deno.readTextFile("assets/styles.css");

  for (
    const identifier of [
      PORTAL_GATE_GEOMETRY_ID,
      PORTAL_GATE_LINK_ID,
      PORTAL_GATE_NODE_ID,
    ]
  ) {
    assert(logo.includes(identifier), `logo contains ${identifier}`);
  }
  assert(
    logo.includes('viewBox="0 0 120 120"'),
    "logo uses the canonical square coordinate system",
  );
  assert(
    logo.includes("currentColor"),
    "logo remains palette-compatible without fixed starter colors",
  );
  assert(
    styles.includes('html[data-theme="dark"]') &&
      styles.includes("--shell-accent"),
    "both themes provide the mark's semantic accent",
  );
});

Deno.test("document metadata names only the canonical SVG icon", async () => {
  const app = await Deno.readTextFile("routes/_app.tsx");
  const iconLinks = app.match(/<link\b[^>]*rel="icon"[^>]*>/g) ?? [];

  assert(iconLinks.length === 1, "document has exactly one icon link");
  assert(iconLinks[0].includes('href="/logo.svg"'), "icon uses portal logo");
  assert(
    iconLinks[0].includes('type="image/svg+xml"'),
    "icon declares SVG MIME type",
  );
  assert(!app.toLowerCase().includes("fresh"), "metadata has no Fresh brand");
});
