import fixture from "../../tests/fixtures/supplied_napplet_contract.json" with {
  type: "json",
};
import type {
  RelayQueryMessage,
  RelaySubscribeMessage,
} from "@napplet/nap/relay";
import { ConnectionRegistry } from "../../runtime/connections.ts";
import { createPortalRuntime } from "../../runtime/portal_runtime.ts";
import { decodeClientMessage } from "../../runtime/transport.ts";
import { define } from "../../utils.ts";
import { debug as rootDebug, shortId } from "../../debug.ts";

const debug = rootDebug.extend("runtime-endpoint");

export const runtime = createPortalRuntime({ fixture });
const sessions = new Map<
  string,
  {
    readonly windowId: string;
    readonly source: object;
    readonly bridge: ReturnType<typeof runtime.openWindow>;
  }
>();
const connections = new ConnectionRegistry({
  destroyWindow: (windowId) => {
    for (const [connectionId, session] of sessions) {
      if (session.windowId === windowId) sessions.delete(connectionId);
    }
  },
});

export const handler = define.handlers({
  GET(ctx) {
    const runtime = ctx.state.runtime;
    const signer = ctx.state.signer;
    const requestedToken = new URL(ctx.req.url).searchParams.get("reconnect");
    if (requestedToken && requestedToken.length > 256) {
      debug("rejected reconnect token length=%d", requestedToken.length);
      return new Response("Invalid reconnect token", { status: 400 });
    }
    // Bare mode: the session owns reconnect identity and per-socket teardown,
    // so events are wired here rather than handed to Fresh's managed handlers.
    const { socket, response } = ctx.upgrade();
    debug("websocket upgrade requested reconnect=%s", Boolean(requestedToken));
    const connection = connections.attach(
      (message) => socket.send(message),
      requestedToken ?? undefined,
    );
    let session = sessions.get(connection.connectionId);
    if (!session) {
      const { windowId } = connections.createWindow(connection.connectionId);
      const source = {};
      session = {
        windowId,
        source,
        bridge: runtime.openWindow(connection.connectionId, windowId, source),
      };
      sessions.set(connection.connectionId, session);
      debug(
        "created runtime session connection=%s window=%s",
        shortId(connection.connectionId),
        shortId(windowId),
      );
    } else {
      debug(
        "resumed runtime session connection=%s window=%s",
        shortId(connection.connectionId),
        shortId(session.windowId),
      );
    }
    const { windowId, bridge } = session;
    let signerProjection: { unsubscribe(): void } | undefined;
    socket.addEventListener("open", () => {
      debug(
        "socket open connection=%s window=%s resumed=%s",
        shortId(connection.connectionId),
        shortId(windowId),
        connection.resumed,
      );
      socket.send(JSON.stringify({
        type: "runtime.connected",
        connectionId: connection.connectionId,
        reconnectToken: connection.reconnectToken,
        windowId,
        resumed: connection.resumed,
      }));
      signerProjection = signer.state$.subscribe((state) => {
        if (socket.readyState !== WebSocket.OPEN) return;
        debug(
          "project signer state connection=%s status=%s",
          shortId(connection.connectionId),
          state.status,
        );
        if (state.status === "idle" || state.status === "preparing") {
          socket.send(JSON.stringify({
            type: `runtime.signer.${state.status}`,
          }));
          return;
        }
        if (state.status === "awaiting") {
          socket.send(JSON.stringify({
            type: "runtime.signer.pending",
            uri: state.uri,
          }));
          return;
        }
        if (state.status === "error") {
          socket.send(JSON.stringify({
            type: "runtime.signer.error",
            error: state.message,
          }));
          return;
        }
        if (state.status === "active" && state.identity.pubkey) {
          void sendActiveSigner(state.identity.pubkey);
        }
      });
    });
    socket.addEventListener("close", () => {
      debug(
        "socket close connection=%s window=%s",
        shortId(connection.connectionId),
        shortId(windowId),
      );
      signerProjection?.unsubscribe();
      connections.detach(connection.connectionId);
    });
    socket.addEventListener("message", async (event) => {
      const raw = String(event.data);
      if (raw.length > 256_000) {
        debug(
          "closing oversized message connection=%s bytes=%d",
          shortId(connection.connectionId),
          raw.length,
        );
        socket.close(1009, "message too large");
        return;
      }
      try {
        const message = JSON.parse(raw) as Record<
          string,
          unknown
        >;
        debug(
          "received socket message connection=%s type=%s bytes=%d",
          shortId(connection.connectionId),
          String(message.type),
          raw.length,
        );
        if (
          message.type === "runtime.start" &&
          message.coordinate === fixture.coordinate
        ) {
          if (message.method !== "connect") {
            debug("rejected runtime start method=%s", String(message.method));
            socket.send(JSON.stringify({
              type: "runtime.signer.error",
              error: "This sign-in method is not available in the tracer",
            }));
            return;
          }
          debug(
            "runtime start command connection=%s coordinate=matched method=%s",
            shortId(connection.connectionId),
            String(message.method),
          );
          signer.start();
          return;
        }
        if (message.type === "runtime.signer.cancel") {
          debug(
            "runtime signer cancel command connection=%s",
            shortId(connection.connectionId),
          );
          signer.cancel();
          return;
        }
        if (message.type === "runtime.signout") {
          debug(
            "runtime signout command connection=%s",
            shortId(connection.connectionId),
          );
          runtime.signOut();
          await signer.signOut();
          socket.send(
            JSON.stringify({ type: "runtime.identity", account: null }),
          );
          return;
        }

        const decoded = decodeClientMessage(raw, {
          connectionId: connection.connectionId,
          windowId,
        });
        if (!decoded.ok) {
          debug(
            "ignored client message connection=%s error=%s",
            shortId(connection.connectionId),
            decoded.error,
          );
          return;
        }
        const napMessage = decoded.value.message;
        debug(
          "forwarded client message connection=%s window=%s type=%s",
          shortId(connection.connectionId),
          shortId(windowId),
          napMessage.type,
        );
        if (napMessage.type === "shell.ready") {
          bridge.receive(session.source, napMessage);
          return;
        }
        if (napMessage.type === "relay.query") {
          const query = napMessage as RelayQueryMessage;
          debug(
            "relay query connection=%s window=%s id=%s",
            shortId(connection.connectionId),
            shortId(windowId),
            shortId(query.id),
          );
          socket.send(JSON.stringify({
            type: "runtime.event",
            connectionId: connection.connectionId,
            windowId,
            message: {
              type: "relay.query.result",
              id: query.id,
              events: [{ event: fixture.events.initial }],
            },
          }));
          return;
        }
        if (napMessage.type === "relay.subscribe") {
          debug(
            "relay subscribe connection=%s window=%s sub=%s",
            shortId(connection.connectionId),
            shortId(windowId),
            (napMessage as RelaySubscribeMessage).subId,
          );
          bridge.subscribeRelay(
            napMessage as RelaySubscribeMessage,
            (relayMessage) => {
              debug(
                "send relay message connection=%s window=%s type=%s",
                shortId(connection.connectionId),
                shortId(windowId),
                relayMessage.type,
              );
              socket.send(JSON.stringify({
                type: "runtime.event",
                connectionId: connection.connectionId,
                windowId,
                message: relayMessage,
              }));
            },
          );
          queueMicrotask(() => runtime.relay.emitLive(fixture.events.live));
        }
      } catch {
        debug(
          "socket message handling failed connection=%s",
          shortId(connection.connectionId),
        );
        socket.send(
          JSON.stringify({
            type: "runtime.signer.error",
            error: "Remote signer connection failed or timed out",
          }),
        );
      }
    });

    async function sendActiveSigner(pubkey: string): Promise<void> {
      try {
        debug(
          "send active signer started connection=%s pubkey=%s",
          shortId(connection.connectionId),
          shortId(pubkey),
        );
        const account = runtime.signIn(pubkey);
        const artifact = await runtime.resolveArtifact();
        if (socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({
          type: "runtime.artifact",
          srcdoc: artifact.indexHtml,
          identity: {
            dTag: artifact.dTag,
            aggregateHash: artifact.aggregateHash,
          },
          account,
        }));
        debug(
          "send artifact complete connection=%s aggregate=%s",
          shortId(connection.connectionId),
          shortId(artifact.aggregateHash),
        );
      } catch {
        if (socket.readyState !== WebSocket.OPEN) return;
        debug(
          "send active signer failed connection=%s",
          shortId(connection.connectionId),
        );
        socket.send(JSON.stringify({
          type: "runtime.signer.error",
          error: "Verified napplet could not be opened",
        }));
      }
    }
    return response;
  },
});
