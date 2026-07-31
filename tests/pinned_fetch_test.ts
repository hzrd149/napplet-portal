import { pinnedFetch } from "../runtime/pinned_fetch.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("pinned fetch returns a readable body before closing its agent", async () => {
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen() {} },
    () => new Response("verified body"),
  );
  try {
    const port = (server.addr as Deno.NetAddr).port;
    const response = await pinnedFetch(
      new URL(`http://127.0.0.1:${port}/artifact`),
      {},
      ["127.0.0.1"],
    );
    assert(await response.text() === "verified body", "body remains readable");
  } finally {
    await server.shutdown();
  }
});
