import fixture from "../../tests/fixtures/supplied_napplet_contract.json" with {
  type: "json",
};
import type {
  RelayQueryMessage,
  RelaySubscribeMessage,
} from "@napplet/nap/relay";
import { RelayPool } from "applesauce-relay";
import { AccountStore } from "../../runtime/account_store.ts";
import { PortalAccounts } from "../../runtime/accounts.ts";
import type { RuntimeConfig } from "../../runtime/config.ts";
import { ConnectionRegistry } from "../../runtime/connections.ts";
import { createPortalRuntime } from "../../runtime/portal_runtime.ts";
import { decodeClientMessage } from "../../runtime/transport.ts";
import { define } from "../../utils.ts";

export const runtime = createPortalRuntime({ fixture });
const signerPool = new RelayPool();
let signerAccounts: PortalAccounts | undefined;
let restoreAccounts: Promise<unknown> | undefined;

async function accountAuthority(
  config: RuntimeConfig,
): Promise<PortalAccounts> {
  if (!signerAccounts) {
    signerAccounts = new PortalAccounts(
      new AccountStore(".data/accounts.json"),
      {
        remoteSignerRelays: config.remoteSignerRelays,
        pool: signerPool,
      },
    );
    restoreAccounts = signerAccounts.restore();
  }
  await restoreAccounts;
  return signerAccounts;
}

const sessions = new Map<
  string,
  {
    readonly windowId: string;
    readonly source: object;
    readonly bridge: ReturnType<typeof runtime.openWindow>;
    signerAbort?: AbortController;
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
    if (ctx.req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    const requestedToken = new URL(ctx.req.url).searchParams.get("reconnect");
    if (requestedToken && requestedToken.length > 256) {
      return new Response("Invalid reconnect token", { status: 400 });
    }
    const { socket, response } = Deno.upgradeWebSocket(ctx.req);
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
    }
    const { windowId, bridge } = session;
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({
        type: "runtime.connected",
        connectionId: connection.connectionId,
        reconnectToken: connection.reconnectToken,
        windowId,
        resumed: connection.resumed,
      }));
    });
    socket.addEventListener("close", () => {
      session?.signerAbort?.abort();
      connections.detach(connection.connectionId);
    });
    socket.addEventListener("message", async (event) => {
      const raw = String(event.data);
      if (raw.length > 256_000) {
        socket.close(1009, "message too large");
        return;
      }
      try {
        const message = JSON.parse(raw) as Record<
          string,
          unknown
        >;
        if (
          message.type === "runtime.start" &&
          message.coordinate === fixture.coordinate
        ) {
          if (message.method !== "connect") {
            socket.send(JSON.stringify({
              type: "runtime.signer.error",
              error: "This sign-in method is not available in the tracer",
            }));
            return;
          }
          session.signerAbort?.abort();
          const controller = new AbortController();
          session.signerAbort = controller;
          const abort = AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(120_000),
          ]);
          const accounts = await accountAuthority(ctx.state.config);
          const pending = await accounts.startNostrConnect(abort);
          socket.send(JSON.stringify({
            type: "runtime.signer.pending",
            uri: pending.uri,
          }));
          const identity = await pending.connected;
          if (!identity.pubkey) {
            throw new Error("Remote signer has no public key");
          }
          const account = runtime.signIn(identity.pubkey);
          const artifact = await runtime.resolveArtifact();
          socket.send(JSON.stringify({
            type: "runtime.artifact",
            srcdoc: artifact.indexHtml,
            identity: {
              dTag: artifact.dTag,
              aggregateHash: artifact.aggregateHash,
            },
            account,
          }));
          session.signerAbort = undefined;
          return;
        }
        if (message.type === "runtime.signout") {
          runtime.signOut();
          socket.send(
            JSON.stringify({ type: "runtime.identity", account: null }),
          );
          return;
        }

        const decoded = decodeClientMessage(raw, {
          connectionId: connection.connectionId,
          windowId,
        });
        if (!decoded.ok) return;
        const napMessage = decoded.value.message;
        if (napMessage.type === "shell.ready") {
          bridge.receive(session.source, napMessage);
          return;
        }
        if (napMessage.type === "relay.query") {
          const query = napMessage as RelayQueryMessage;
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
          bridge.subscribeRelay(
            napMessage as RelaySubscribeMessage,
            (relayMessage) => {
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
        socket.send(
          JSON.stringify({
            type: "runtime.signer.error",
            error: "Remote signer connection failed or timed out",
          }),
        );
      }
    });
    return response;
  },
});
