import { renderToString } from "npm:preact-render-to-string@^6.6.3";
import {
  ConnectionConstellation,
  connectionCopy,
} from "../components/ConnectionConstellation.tsx";
import { ConnectionSheet } from "../components/ConnectionSheet.tsx";
import type { ConnectionSnapshot } from "../shell/connection.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function snapshot(
  phase: ConnectionSnapshot["phase"],
  mode: ConnectionSnapshot["mode"] = "cold",
  canRetry = false,
): ConnectionSnapshot {
  return {
    phase,
    mode,
    failures: canRetry ? 3 : 0,
    canRetry,
    nextRetryMs: null,
    online: phase !== "dormant",
  };
}

Deno.test("constellation exposes non-color geometry for every truth state", () => {
  for (const phase of [
    "pending",
    "connected",
    "bootstrapping",
    "ready",
    "retrying",
    "dormant",
    "failed",
  ] as const) {
    const html = renderToString(
      <ConnectionConstellation state={snapshot(phase)} compact={false} />,
    );
    assert(html.includes(`data-state="${phase}"`), `${phase} state is explicit`);
    assert(html.includes("constellation-node"), `${phase} has nodes`);
    assert(html.includes("constellation-link"), `${phase} has links`);
    assert(html.includes("aria-hidden="), "graphic does not duplicate live copy");
  }
});

Deno.test("cold and reconnect modes retain distinct visual grammar", () => {
  const cold = renderToString(
    <ConnectionConstellation state={snapshot("pending", "cold")} compact={false} />,
  );
  const reconnect = renderToString(
    <ConnectionConstellation state={snapshot("retrying", "reconnect")} compact={false} />,
  );
  assert(cold.includes('data-ritual="cold"'), "cold uses full ritual");
  assert(reconnect.includes('data-ritual="reconnect"'), "retry uses rebuild ritual");
  assert(reconnect.includes("constellation-fracture"), "reconnect shows fracture");
});

Deno.test("status sheet has one sentence, no operational disclosure, and contextual Retry", () => {
  const early = renderToString(
    <ConnectionSheet state={snapshot("retrying")} open onClose={() => {}} onRetry={() => {}} />,
  );
  assert(!early.includes(">Retry<"), "early recovery stays quiet");
  const failed = renderToString(
    <ConnectionSheet state={snapshot("failed", "reconnect", true)} open onClose={() => {}} onRetry={() => {}} />,
  );
  assert(failed.includes(">Retry<"), "repeated failure exposes Retry");
  for (const forbidden of ["token", "connectionId", "windowId", "milliseconds", "attempt 3"]) {
    assert(!failed.includes(forbidden), `sheet excludes ${forbidden}`);
  }
  assert((failed.match(/<p/g) ?? []).length === 1, "sheet contains one sentence");
});

Deno.test("plain status language distinguishes all connection truth", () => {
  const copies = new Set([
    "pending",
    "connected",
    "bootstrapping",
    "ready",
    "retrying",
    "dormant",
    "failed",
  ].map((phase) => connectionCopy(snapshot(phase as ConnectionSnapshot["phase"]))));
  assert(copies.size === 7, "each truth state has distinct plain language");
});

Deno.test("shell implements bounded cold ritual and slow-start escape", async () => {
  const shell = await Deno.readTextFile("islands/NappletShell.tsx");
  assert(shell.includes("RITUAL_READY_CEILING_MS = 1_000"), "ready reveal caps at one second");
  assert(shell.includes("SLOW_START_ESCAPE_MS = 3_000"), "slow startup reveals controls");
  assert(shell.includes('aria-live="polite"'), "ordinary updates use polite live status");
  assert(shell.includes("ConnectionSheet"), "status target opens the sheet");
  assert(!shell.includes(">Skip<"), "ritual has no ordinary Skip control");
});

Deno.test("reduced motion disables continuous constellation motion", async () => {
  const styles = await Deno.readTextFile("assets/styles.css");
  const reduced = styles.slice(styles.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert(reduced.includes("animation: none"), "animation is disabled");
  assert(reduced.includes("transition: none"), "transitions are disabled");
});
