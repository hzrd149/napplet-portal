import { define } from "../../../utils.ts";
import { debug as rootDebug, shortId } from "../../../debug.ts";

const debug = rootDebug.extend("signin-connect");

export const handler = define.handlers({
  GET(ctx) {
    const signer = ctx.state.signer;
    const { socket, response } = ctx.upgrade();
    let projection: { unsubscribe(): void } | undefined;
    socket.addEventListener("open", () => {
      debug("socket open");
      projection = signer.state$.subscribe((state) => {
        if (socket.readyState !== WebSocket.OPEN) return;
        if (state.status === "idle" || state.status === "preparing") {
          socket.send(JSON.stringify({ type: `signer.${state.status}` }));
          return;
        }
        if (state.status === "awaiting") {
          socket.send(
            JSON.stringify({ type: "signer.pending", uri: state.uri }),
          );
          return;
        }
        if (state.status === "error") {
          socket.send(
            JSON.stringify({ type: "signer.error", message: state.message }),
          );
          return;
        }
        if (state.status === "active" && state.identity.pubkey) {
          debug(
            "project active signer pubkey=%s",
            shortId(state.identity.pubkey),
          );
          socket.send(JSON.stringify({
            type: "signer.active",
            pubkey: state.identity.pubkey,
          }));
        }
      });
    });
    socket.addEventListener("message", (event) => {
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(String(event.data)) as Record<string, unknown>;
      } catch {
        return;
      }
      if (message.type === "signer.start") {
        signer.start();
        return;
      }
      if (message.type === "signer.cancel") signer.cancel();
    });
    socket.addEventListener("close", () => {
      debug("socket close");
      projection?.unsubscribe();
    });
    return response;
  },
});
