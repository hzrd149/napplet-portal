import fixture from "../../tests/fixtures/supplied_napplet_contract.json" with {
  type: "json",
};
import { createPortalRuntime } from "../../runtime/portal_runtime.ts";
import { define } from "../../utils.ts";

const runtime = createPortalRuntime({ fixture });

export const handler = define.handlers({
  GET(ctx) {
    if (ctx.req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    const { socket, response } = Deno.upgradeWebSocket(ctx.req);
    socket.addEventListener("message", async (event) => {
      try {
        const message = JSON.parse(String(event.data)) as Record<
          string,
          unknown
        >;
        if (
          message.type !== "runtime.start" ||
          message.coordinate !== fixture.coordinate
        ) return;
        runtime.signIn(fixture.identity.pubkey);
        const artifact = await runtime.resolveArtifact();
        socket.send(JSON.stringify({
          type: "runtime.artifact",
          srcdoc: artifact.indexHtml,
          identity: fixture.identity,
        }));
      } catch {
        socket.send(
          JSON.stringify({
            type: "runtime.error",
            error: "artifact verification failed",
          }),
        );
      }
    });
    return response;
  },
});
