import {
  createIframeBridge,
  mountVerifiedFrame,
} from "../components/NappletFrame.tsx";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("verified identity registers before srcdoc assignment", () => {
  const order: string[] = [];
  const frame = {
    contentWindow: {},
    set srcdoc(_value: string) {
      order.push("srcdoc");
    },
  } as unknown as HTMLIFrameElement;
  mountVerifiedFrame(
    frame,
    { dTag: "security-lab", aggregateHash: "a".repeat(64) },
    "<main>verified</main>",
    { register: () => order.push("identity") },
  );
  assert(order.join(",") === "identity,srcdoc", "identity must precede bytes");
});

Deno.test("bridge is source-bound, silent for unknowns, and initializes once", () => {
  const channel = new MessageChannel();
  const source = channel.port1;
  const posted: unknown[] = [];
  const forwarded: unknown[] = [];
  const bridge = createIframeBridge({
    source: () => source,
    post: (message) => posted.push(message),
    forward: (message) => forwarded.push(message),
  });

  bridge.receive({ source: channel.port2, data: { type: "shell.ready" } });
  bridge.receive({ source, data: { type: "unknown.message" } });
  bridge.receive({ source, data: { type: "shell.ready" } });
  bridge.receive({ source, data: { type: "shell.ready" } });
  bridge.receive({ source, data: { type: "outbox.query", id: "opaque" } });

  assert(posted.length === 1, "shell.init must be sent exactly once");
  const init = posted[0] as { capabilities: { domains: string[] } };
  assert(
    init.capabilities.domains.join(",") === "shell,identity,relay,outbox",
    "only Phase 1 domains may be injected",
  );
  assert(forwarded.length === 1, "only recognized non-shell message forwards");
});
