import { renderToString } from "npm:preact-render-to-string@^6.6.3";
import {
  ConnectionConstellation,
  connectionCopy,
} from "../components/ConnectionConstellation.tsx";
import { ConnectionSheet } from "../components/ConnectionSheet.tsx";
import { AccountSheet } from "../components/AccountSheet.tsx";
import { HomeHeader } from "../components/HomeHeader.tsx";
import { createVerifiedIdentityPublisher } from "../components/NappletFrame.tsx";
import type { ConnectionSnapshot } from "../shell/connection.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("identity-first header exposes compact and wide signer truth", () => {
  const html = renderToString(
    <HomeHeader
      profile={{
        pubkey: "f".repeat(64),
        displayName: "Ada",
        status: "offline",
      }}
      onOpenAccount={() => undefined}
    />,
  );
  assert(html.includes("Ada"), "identity name must be visible");
  assert(
    html.includes("Signer offline"),
    "offline truth must not rely on color",
  );
  assert(
    html.includes("header-wide-identity"),
    "wide disclosure must be available",
  );
  assert(
    html.includes("ffffffffffff…ffffffffffff"),
    "wide identity must shorten pubkey",
  );
});

Deno.test("account sheet distinguishes identity signer and backend state", () => {
  const signedOut = renderToString(
    <AccountSheet
      open
      profile={null}
      backendConnected
      onClose={() => undefined}
      onSignOut={() => undefined}
    />,
  );
  assert(
    signedOut.includes("Sign in"),
    "signed-out sheet needs primary sign-in action",
  );
  const offline = renderToString(
    <AccountSheet
      open
      profile={{ pubkey: "a".repeat(64), status: "offline" }}
      backendConnected
      onClose={() => undefined}
      onSignOut={() => undefined}
    />,
  );
  assert(offline.includes("Signer offline"), "signer offline must be explicit");
  assert(
    offline.includes("Backend connected"),
    "transport truth must stay separate",
  );
  const disconnected = renderToString(
    <AccountSheet
      open
      profile={{ pubkey: "a".repeat(64), status: "active" }}
      backendConnected={false}
      onClose={() => undefined}
      onSignOut={() => undefined}
    />,
  );
  assert(
    disconnected.includes("Signer connected"),
    "signer truth must survive transport loss",
  );
  assert(
    disconnected.includes("Backend disconnected"),
    "backend loss must be explicit",
  );
});

Deno.test("canonical identity publisher accepts only the current verified frame", () => {
  const trusted = {} as Window;
  const foreign = {} as Window;
  const sent: unknown[] = [];
  const publish = createVerifiedIdentityPublisher({
    source: () => trusted,
    registered: () => ({
      source: trusted,
      identity: { dTag: "app", aggregateHash: "hash" },
    }),
    post: (message) => sent.push(message),
  });
  assert(
    publish(foreign, { type: "identity.changed", identity: { pubkey: "" } }) ===
      false,
    "foreign frame must be rejected",
  );
  assert(
    publish(trusted, { type: "identity.changed", identity: { pubkey: "" } }),
    "verified frame must receive identity",
  );
  assert(sent.length === 1, "canonical identity must deliver exactly once");
  assert(
    JSON.stringify(sent[0]) ===
      '{"type":"identity.changed","identity":{"pubkey":""}}',
    "pinned envelope must be exact",
  );
});

Deno.test("shell reserves safe navigation and keeps one frame across views", async () => {
  const shell = await Deno.readTextFile("islands/NappletShell.tsx");
  const styles = await Deno.readTextFile("assets/styles.css");
  assert(
    shell.match(/<NappletFrame/g)?.length === 1,
    "one iframe must remain mounted",
  );
  const navigation = shell.indexOf("function PrimaryNavigation");
  const home = shell.indexOf("HomeIcon", navigation);
  const status = shell.indexOf("ConnectionConstellation", home);
  const account = shell.indexOf("AccountIcon", status);
  assert(
    home >= 0 && status > home && account > status,
    "targets must be Home Status Account",
  );
  assert(
    styles.includes("env(safe-area-inset-bottom)"),
    "safe area must be reserved",
  );
  assert(
    styles.includes("@media (orientation: landscape)"),
    "landscape navigation must compact",
  );
  assert(
    styles.includes("@media (max-height:"),
    "short viewport navigation must compact",
  );
  assert(
    styles.includes("min-height: 44px"),
    "touch targets must be at least 44px",
  );
});

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
  for (
    const phase of [
      "pending",
      "connected",
      "bootstrapping",
      "ready",
      "retrying",
      "dormant",
      "failed",
    ] as const
  ) {
    const html = renderToString(
      <ConnectionConstellation state={snapshot(phase)} compact={false} />,
    );
    assert(
      html.includes(`data-state="${phase}"`),
      `${phase} state is explicit`,
    );
    assert(html.includes("constellation-node"), `${phase} has nodes`);
    assert(html.includes("constellation-link"), `${phase} has links`);
    assert(
      html.includes("aria-hidden="),
      "graphic does not duplicate live copy",
    );
  }
});

Deno.test("cold and reconnect modes retain distinct visual grammar", () => {
  const cold = renderToString(
    <ConnectionConstellation
      state={snapshot("pending", "cold")}
      compact={false}
    />,
  );
  const reconnect = renderToString(
    <ConnectionConstellation
      state={snapshot("retrying", "reconnect")}
      compact={false}
    />,
  );
  assert(cold.includes('data-ritual="cold"'), "cold uses full ritual");
  assert(
    reconnect.includes('data-ritual="reconnect"'),
    "retry uses rebuild ritual",
  );
  assert(
    reconnect.includes("constellation-fracture"),
    "reconnect shows fracture",
  );
});

Deno.test("status sheet has one sentence, no operational disclosure, and contextual Retry", () => {
  const early = renderToString(
    <ConnectionSheet
      state={snapshot("retrying")}
      open
      onClose={() => {}}
      onRetry={() => {}}
    />,
  );
  assert(!early.includes(">Retry<"), "early recovery stays quiet");
  const failed = renderToString(
    <ConnectionSheet
      state={snapshot("failed", "reconnect", true)}
      open
      onClose={() => {}}
      onRetry={() => {}}
    />,
  );
  assert(failed.includes(">Retry<"), "repeated failure exposes Retry");
  for (
    const forbidden of [
      "token",
      "connectionId",
      "windowId",
      "milliseconds",
      "attempt 3",
    ]
  ) {
    assert(!failed.includes(forbidden), `sheet excludes ${forbidden}`);
  }
  assert(
    (failed.match(/<p/g) ?? []).length === 1,
    "sheet contains one sentence",
  );
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
  ].map((phase) =>
    connectionCopy(snapshot(phase as ConnectionSnapshot["phase"]))
  ));
  assert(copies.size === 7, "each truth state has distinct plain language");
});

Deno.test("shell implements bounded cold ritual and slow-start escape", async () => {
  const shell = await Deno.readTextFile("islands/NappletShell.tsx");
  assert(
    shell.includes("RITUAL_READY_CEILING_MS = 1_000"),
    "ready reveal caps at one second",
  );
  assert(
    shell.includes("SLOW_START_ESCAPE_MS = 3_000"),
    "slow startup reveals controls",
  );
  assert(
    shell.includes('aria-live="polite"'),
    "ordinary updates use polite live status",
  );
  assert(shell.includes("ConnectionSheet"), "status target opens the sheet");
  assert(!shell.includes(">Skip<"), "ritual has no ordinary Skip control");
});

Deno.test("reduced motion disables continuous constellation motion", async () => {
  const styles = await Deno.readTextFile("assets/styles.css");
  const reduced = styles.slice(
    styles.indexOf("@media (prefers-reduced-motion: reduce)"),
  );
  assert(reduced.includes("animation: none"), "animation is disabled");
  assert(reduced.includes("transition: none"), "transitions are disabled");
});
