import { renderToString } from "npm:preact-render-to-string@^6.6.3";
import { MediaControls } from "../components/MediaControls.tsx";
import {
  MediaShellController,
  type ShellMediaProjection,
} from "../islands/NappletShell.tsx";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const A = { connectionId: "connection-a", windowId: "window-a" };
const B = { connectionId: "connection-b", windowId: "window-b" };

function projection(
  generation: number,
  owner: typeof A | null = A,
  status: ShellMediaProjection["status"] = "playing",
): ShellMediaProjection {
  return {
    sessionId: "session-1",
    generation,
    playbackOwner: "napplet",
    owner,
    origin: A,
    status,
    capabilities: ["play", "pause", "stop"],
    transferable: true,
    terminal: false,
    metadata: { title: "A very long title".repeat(80), artist: "Artist" },
  };
}

Deno.test("authoritative media shell tracer gates snapshots and stale ownership", () => {
  const sent: Record<string, unknown>[] = [];
  const posted: Record<string, unknown>[] = [];
  let stops = 0;
  const shell = new MediaShellController({
    send: (message) => sent.push(message),
    post: (message) => posted.push(message),
    stopLocal: () => stops++,
  });
  shell.connect(A);
  assert(!shell.ready && shell.projection === null, "generation starts gated");
  assert(!shell.request("transfer"), "controls reject before snapshot");
  assert(shell.snapshot(1, projection(4)), "first snapshot is accepted");
  assert(shell.ready && shell.isOwner, "matching owner becomes authoritative");
  assert(
    shell.forward({
      type: "media.state",
      sessionId: "session-1",
      status: "playing",
    }),
    "current owner may forward canonical state",
  );
  assert(posted.length === 0, "portal fields never cross into iframe commands");
  assert(
    (sent.at(-1)?.message as Record<string, unknown>).type === "media.state" &&
      sent.at(-1)?.generation === 4,
    "trusted generation stays on outer runtime envelope",
  );
  assert(!shell.snapshot(0, projection(3)), "older socket epoch is ignored");
  assert(shell.snapshot(1, projection(5, B)), "new foreign owner is accepted");
  assert(
    stops === 1 && !shell.isOwner,
    "authority loss stops local playback first",
  );
});

Deno.test("authoritative media shell tracer reports hidden owner truth once", () => {
  const sent: Record<string, unknown>[] = [];
  const posted: Record<string, unknown>[] = [];
  const shell = new MediaShellController({
    send: (message) => sent.push(message),
    post: (message) => posted.push(message),
    stopLocal: () => undefined,
  });
  shell.connect(A);
  shell.snapshot(2, projection(8));
  shell.hidden("paused");
  shell.hidden("paused");
  assert(sent.length === 0, "shell does not invent a hidden playback state");
  assert(
    JSON.stringify(posted) ===
      '[{"type":"media.command","sessionId":"session-1","action":"pause"}]',
    "hidden owner receives one canonical pause command",
  );
  assert(
    shell.forward({
      type: "media.state",
      sessionId: "session-1",
      status: "paused",
    }),
    "napplet acknowledgement is forwarded with the trusted generation",
  );
  assert(sent[0].generation === 8, "generation remains unchanged");
  shell.snapshot(2, projection(8, A, "paused"));
  assert(shell.projection?.owner === A, "truthful state preserves ownership");
});

Deno.test("authoritative media shell tracer exposes truthful autoplay retry", async () => {
  const reports: Record<string, unknown>[] = [];
  const shell = new MediaShellController({
    send: (message) => reports.push(message),
    post: () => undefined,
    stopLocal: () => undefined,
  });
  shell.connect(A);
  shell.snapshot(1, projection(2, A, "stopped"));
  assert(
    await shell.play(() => Promise.resolve()),
    "fulfilled play is truthful",
  );
  assert(
    reports.at(-1)?.message &&
      (reports.at(-1)!.message as Record<string, unknown>).status === "playing",
    "playing reports only after fulfillment",
  );
  assert(
    !await shell.play(() =>
      Promise.reject(new DOMException("blocked", "NotAllowedError"))
    ),
    "rejected autoplay remains non-playing",
  );
  assert(shell.retryRequired, "rejection exposes gesture retry");
});

Deno.test("authoritative media shell enacts only current grants", () => {
  const posted: Record<string, unknown>[] = [];
  const shell = new MediaShellController({
    send: () => undefined,
    post: (message) => posted.push(message),
    stopLocal: () => undefined,
  });
  shell.connect(B);
  assert(shell.snapshot(1, projection(4, A, "playing")), "baseline accepted");
  assert(
    !shell.grant({
      type: "runtime.media.grant",
      sessionId: "session-1",
      generation: 5,
      owner: A,
    }),
    "foreign grant is rejected",
  );
  assert(
    shell.grant({
      type: "runtime.media.grant",
      sessionId: "session-1",
      generation: 5,
      owner: B,
    }),
    "current-window grant is queued",
  );
  assert(posted.length === 0, "grant waits for matching projection");
  assert(
    shell.snapshot(1, projection(5, B, "stopped")),
    "grant snapshot accepted",
  );
  assert(
    JSON.stringify(posted) ===
      '[{"type":"media.command","sessionId":"session-1","action":"play"}]',
    "matching grant enacts one canonical play command",
  );
  assert(shell.retryRequired, "non-playing acknowledgement exposes retry");
  assert(
    !shell.grant({
      type: "runtime.media.grant",
      sessionId: "session-1",
      generation: 4,
      owner: B,
    }),
    "stale grant is rejected",
  );
});

Deno.test("authoritative media shell tracer renders bounded accessible controls", () => {
  const html = renderToString(
    <MediaControls
      ready
      projection={projection(3, B)}
      currentOwner={A}
      pending={false}
      retryRequired
      onTransfer={() => undefined}
      onStop={() => undefined}
      onRetry={() => undefined}
    />,
  );
  assert(html.includes("Now playing"), "accessible now-playing label exists");
  assert(html.includes("Transfer here"), "non-owner can transfer");
  assert(html.includes("Stop playback"), "eligible tabs can stop");
  assert(html.length < 4_000, "untrusted metadata is bounded before rendering");
  const retry = renderToString(
    <MediaControls
      ready
      projection={projection(3, A)}
      currentOwner={A}
      pending={false}
      retryRequired
      onTransfer={() => undefined}
      onStop={() => undefined}
      onRetry={() => undefined}
    />,
  );
  assert(retry.includes("Tap to play"), "autoplay retry is explicit");
  const withoutStopCapability = renderToString(
    <MediaControls
      ready
      projection={{ ...projection(3, B), capabilities: [] }}
      currentOwner={A}
      pending={false}
      retryRequired={false}
      onTransfer={() => undefined}
      onStop={() => undefined}
      onRetry={() => undefined}
    />,
  );
  assert(
    withoutStopCapability.includes("Stop playback"),
    "portal stop is independent of optional owner capabilities",
  );
});
