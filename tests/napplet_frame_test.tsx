import {
  createIframeBridge,
  mountVerifiedFrame,
} from "../components/NappletFrame.tsx";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("napplet frame locks sandbox and registers source before bytes", async () => {
  const source = await Deno.readTextFile("components/NappletFrame.tsx");
  assert(source.includes('sandbox="allow-scripts"'), "scripts stay enabled");
  assert(!source.includes("allow-same-origin"), "same-origin stays denied");

  const order: string[] = [];
  const frame = {
    contentWindow: {},
    set srcdoc(_value: string) {
      order.push("bytes");
    },
  } as unknown as HTMLIFrameElement;
  mountVerifiedFrame(
    frame,
    { dTag: "exact", aggregateHash: "a".repeat(64) },
    "<main>verified</main>",
    { register: () => order.push("source") },
  );
  assert(order.join(",") === "source,bytes", "source binds before bytes");
});

Deno.test("napplet frame accepts only its opaque WindowProxy", () => {
  const trusted = {} as Window;
  const forwarded: unknown[] = [];
  const bridge = createIframeBridge({
    source: () => trusted,
    post: () => undefined,
    forward: (message) => forwarded.push(message),
  });
  bridge.receive({
    source: trusted,
    origin: "https://evil.example",
    data: { type: "relay.query", id: "foreign-origin" },
  });
  bridge.receive({
    source: {} as Window,
    origin: "null",
    data: { type: "relay.query", id: "foreign-source" },
  });
  bridge.receive({
    source: trusted,
    origin: "null",
    data: { type: "relay.query", id: "trusted" },
  });
  assert(forwarded.length === 1, "only exact opaque frame dispatches");
});
