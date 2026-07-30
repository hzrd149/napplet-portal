import fixture from "../../tests/fixtures/supplied_napplet_contract.json" with {
  type: "json",
};
import type {
  RelayQueryMessage,
  RelaySubscribeMessage,
} from "@napplet/nap/relay";
import { createPortalRuntime } from "../../runtime/portal_runtime.ts";
import { decodeClientMessage } from "../../runtime/transport.ts";
import { define } from "../../utils.ts";

const runtime = createPortalRuntime({ fixture });

export const handler = define.handlers({
  GET(ctx) {
    if (ctx.req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    const { socket, response } = Deno.upgradeWebSocket(ctx.req);
    const bridge = runtime.openWindow("browser-tab", "security-lab", socket);
    socket.addEventListener("message", async (event) => {
      try {
        const message = JSON.parse(String(event.data)) as Record<
          string,
          unknown
        >;
        if (
          message.type === "runtime.start" &&
          message.coordinate === fixture.coordinate
        ) {
          runtime.signIn(fixture.identity.pubkey);
          const artifact = await runtime.resolveArtifact();
          socket.send(JSON.stringify({
            type: "runtime.artifact",
            srcdoc: artifact.indexHtml,
            identity: fixture.identity,
          }));
          return;
        }

        const decoded = decodeClientMessage(String(event.data), {
          connectionId: "browser-tab",
          windowId: "security-lab",
        });
        if (!decoded.ok) return;
        const napMessage = decoded.value.message;
        if (napMessage.type === "relay.query") {
          const query = napMessage as RelayQueryMessage;
          socket.send(JSON.stringify({
            type: "runtime.event",
            connectionId: "browser-tab",
            windowId: "security-lab",
            message: {
              type: "relay.query.result",
              id: query.id,
              events: [{ event: fixture.events.initial }],
            },
          }));
          return;
        }
        if (napMessage.type === "relay.subscribe") {
          bridge.subscribeRelay(
            napMessage as RelaySubscribeMessage,
            (relayMessage) => {
              socket.send(JSON.stringify({
                type: "runtime.event",
                connectionId: "browser-tab",
                windowId: "security-lab",
                message: relayMessage,
              }));
            },
          );
          queueMicrotask(() => runtime.relay.emitLive(fixture.events.live));
        }
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
