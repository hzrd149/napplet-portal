import fixture from "../../tests/fixtures/supplied_napplet_contract.json" with {
  type: "json",
};
import type {
  RelayQueryMessage,
  RelaySubscribeMessage,
} from "@napplet/nap/relay";
import { ConnectionRegistry } from "../../runtime/connections.ts";
import type { createPortalRuntime } from "../../runtime/portal_runtime.ts";
import {
  decodeCatalogCommand,
  decodeClientMessage,
  decodeIntentCommand,
  decodeIntentNavigationMessage,
  decodeNapControlMessage,
  type IntentNavigationMessage,
} from "../../runtime/transport.ts";
import {
  BinaryFrameKind,
  decodeBinaryFrames,
  decodeUploadPayload,
  encodeBinaryFrame,
  FIXED_RESOURCE_ID,
} from "../../runtime/binary_transport.ts";
import { define } from "../../utils.ts";
import { debug as rootDebug, shortId } from "../../debug.ts";

const debug = rootDebug.extend("runtime-endpoint");

export { FIXED_RESOURCE_ID };
export const FIXED_RESOURCE_BYTES = new TextEncoder().encode(
  "Napplet Portal binary resource tracer\n",
);

export function handleFixedResourceFrame(
  bytes: Uint8Array,
  owner: { readonly connectionId: string; readonly windowId: string },
  _dependencies: { readonly fetch?: typeof fetch } = {},
): Uint8Array | null {
  const decoded = decodeBinaryFrames(bytes, owner);
  if (!decoded.ok || decoded.frames.length !== 1) return null;
  const frame = decoded.frames[0];
  if (
    frame.kind !== BinaryFrameKind.ResourceRequest ||
    frame.payload.length !== 0
  ) return null;
  return encodeBinaryFrame({
    kind: BinaryFrameKind.ResourceResult,
    id: frame.id,
    payload: FIXED_RESOURCE_BYTES,
  });
}

type PortalRuntime = ReturnType<typeof createPortalRuntime>;
const sessions = new Map<
  string,
  {
    readonly windowId: string;
    readonly source: object;
    readonly runtime: PortalRuntime;
    readonly bridge: ReturnType<PortalRuntime["openWindow"]>;
  }
>();
const connections = new ConnectionRegistry({
  destroyWindow: (windowId) => {
    let ownerRuntime: PortalRuntime | undefined;
    for (const [connectionId, session] of sessions) {
      if (session.windowId !== windowId) continue;
      ownerRuntime = session.runtime;
      sessions.delete(connectionId);
    }
    ownerRuntime?.destroyWindow(windowId);
  },
});

export function isSameOriginRuntimeRequest(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const requestUrl = new URL(req.url);
    const originUrl = new URL(origin);
    return originUrl.protocol === requestUrl.protocol &&
      originUrl.host === requestUrl.host;
  } catch {
    return false;
  }
}

export const handler = define.handlers({
  GET(ctx) {
    if (!isSameOriginRuntimeRequest(ctx.req)) {
      debug("rejected websocket origin");
      return new Response("Forbidden", { status: 403 });
    }
    const runtime = ctx.state.runtime;
    const signer = ctx.state.signer;
    const requestedToken = new URL(ctx.req.url).searchParams.get("reconnect");
    const requestedWindowId = new URL(ctx.req.url).searchParams.get("window");
    if (requestedToken && requestedToken.length > 256) {
      debug("rejected reconnect token length=%d", requestedToken.length);
      return new Response("Invalid reconnect token", { status: 400 });
    }
    if (
      requestedWindowId &&
      (!/^[0-9a-f-]{36}$/.test(requestedWindowId) || requestedToken)
    ) {
      return new Response("Invalid target window", { status: 400 });
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
      const { windowId } = connections.createWindow(
        connection.connectionId,
        requestedWindowId ?? undefined,
      );
      const source = {};
      session = {
        windowId,
        source,
        runtime,
        bridge: runtime.openWindow(
          connection.connectionId,
          windowId,
          source,
          (message, payloads) => {
            if (
              !connections.send(
                connection.connectionId,
                JSON.stringify({
                  type: "runtime.event",
                  connectionId: connection.connectionId,
                  windowId,
                  message,
                }),
              )
            ) return;
            payloads?.forEach((payload, index) => {
              const id = payloads.length === 1
                ? String(message.id)
                : `${String(message.id)}:${index}`;
              connections.send(
                connection.connectionId,
                encodeBinaryFrame({
                  kind: BinaryFrameKind.ResourceResult,
                  id,
                  payload,
                }).slice().buffer as ArrayBuffer,
              );
            });
          },
        ),
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
    const sendCatalog = async () => {
      try {
        const catalog = await bridge.catalog();
        socket.send(JSON.stringify({
          type: "runtime.catalog",
          status: catalog.status === "refreshing" || catalog.status === "idle"
            ? "loading"
            : catalog.status ?? "ready",
          catalog: {
            catalogEventId: catalog.catalogEventId,
            entries: catalog.entries,
          },
        }));
      } catch {
        socket.send(JSON.stringify({
          type: "runtime.catalog",
          status: "error",
        }));
      }
    };
    const unsubscribeCatalog = bridge.subscribeCatalog(() => {
      if (socket.readyState === WebSocket.OPEN) void sendCatalog();
    });
    const pendingIntentReservations = new Map<
      string,
      Extract<
        IntentNavigationMessage,
        { type: "intent.navigation.reserve" }
      >
    >();
    const pendingIntentAcks = new Map<
      string,
      Extract<IntentNavigationMessage, { type: "intent.navigation.ack" }>
    >();
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
      void sendCatalog();
    });
    socket.addEventListener("close", () => {
      debug(
        "socket close connection=%s window=%s",
        shortId(connection.connectionId),
        shortId(windowId),
      );
      connections.detach(connection.connectionId);
      unsubscribeCatalog();
    });
    socket.addEventListener("message", async (event) => {
      if (event.data instanceof ArrayBuffer) {
        const incoming = new Uint8Array(event.data);
        const decoded = decodeBinaryFrames(incoming, {
          connectionId: connection.connectionId,
          windowId,
        });
        const frame = decoded.ok && decoded.frames.length === 1
          ? decoded.frames[0]
          : undefined;
        if (frame?.kind === BinaryFrameKind.UploadRequest) {
          const upload = decodeUploadPayload(frame.payload);
          const control = upload && decodeNapControlMessage({
            type: "upload.upload",
            id: frame.id,
            request: {
              ...upload.metadata,
              data: upload.data.slice().buffer as ArrayBuffer,
            },
          });
          if (!control || control.type !== "upload.upload") {
            socket.close(1008, "invalid upload message");
            return;
          }
          await bridge.dispatchTransfer(control);
        } else {
          const result = await handleFixedResourceFrame(incoming, {
            connectionId: connection.connectionId,
            windowId,
          });
          if (result) socket.send(result.slice().buffer as ArrayBuffer);
          else socket.close(1008, "invalid binary message");
        }
        return;
      }
      if (ArrayBuffer.isView(event.data)) {
        const view = event.data as ArrayBufferView;
        const result = await handleFixedResourceFrame(
          new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
          { connectionId: connection.connectionId, windowId },
        );
        if (result) socket.send(result.slice().buffer as ArrayBuffer);
        else socket.close(1008, "invalid binary message");
        return;
      }
      if (typeof event.data !== "string") {
        socket.close(1003, "unsupported message data");
        return;
      }
      const raw = event.data;
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
        if (message.type === "runtime.start") {
          if (message.coordinate !== fixture.coordinate) {
            debug(
              "rejected runtime start connection=%s coordinate=unsupported",
              shortId(connection.connectionId),
            );
            socket.send(JSON.stringify({
              type: "runtime.error",
              error: "Configured napplet is not available in this tracer",
            }));
            return;
          }
          await signer.restore();
          const signerState = signer.state;
          if (signerState.status !== "active" || !signerState.identity.pubkey) {
            debug(
              "rejected runtime start connection=%s signer=%s",
              shortId(connection.connectionId),
              signerState.status,
            );
            socket.send(JSON.stringify({
              type: "runtime.auth.required",
              error: "Sign in before opening this napplet",
            }));
            return;
          }
          debug(
            "runtime start command connection=%s coordinate=matched signer=active",
            shortId(connection.connectionId),
          );
          await sendActiveSigner(signerState.identity.pubkey);
          return;
        }
        if (message.type === "runtime.signout") {
          debug(
            "runtime signout command connection=%s",
            shortId(connection.connectionId),
          );
          runtime.signOut();
          await signer.signOut();
          socket.send(JSON.stringify({
            type: "runtime.event",
            connectionId: connection.connectionId,
            windowId,
            message: { type: "identity.changed", identity: { pubkey: "" } },
          }));
          return;
        }

        const catalogCommand = decodeCatalogCommand(message);
        if (catalogCommand) {
          const result = await bridge.catalogCommand(catalogCommand);
          socket.send(JSON.stringify({
            type: "runtime.catalog.result",
            id: catalogCommand.id,
            ok: result.ok,
            ...(result.ok
              ? { value: "value" in result ? result.value : undefined }
              : {
                error: result.error,
                retryable: "retryable" in result ? result.retryable : true,
              }),
          }));
          if (result.ok) await sendCatalog();
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
        const transfer = decodeNapControlMessage(napMessage);
        if (transfer) {
          await bridge.dispatchTransfer(transfer);
          return;
        }
        const intentNavigation = decodeIntentNavigationMessage(napMessage);
        if (intentNavigation?.type === "intent.navigation.reserve") {
          pendingIntentReservations.set(
            intentNavigation.invocationId,
            intentNavigation,
          );
          return;
        }
        if (intentNavigation?.type === "intent.navigation.ack") {
          if (!bridge.acknowledgeIntent(intentNavigation)) {
            pendingIntentAcks.set(
              intentNavigation.reservationId,
              intentNavigation,
            );
          }
          return;
        }
        if (intentNavigation?.type === "intent.ticket.claim") {
          const claimed = bridge.claimIntentTicket(intentNavigation);
          socket.send(JSON.stringify({
            type: "runtime.intent.ticket",
            reservationId: intentNavigation.reservationId,
            ok: claimed !== null,
            ...(claimed ? { claim: claimed } : {}),
          }));
          return;
        }
        const intentCommand = decodeIntentCommand(napMessage);
        if (intentCommand?.type === "intent.invoke") {
          const reservation = pendingIntentReservations.get(intentCommand.id);
          if (reservation) {
            pendingIntentReservations.delete(intentCommand.id);
            await bridge.reserveIntent(reservation, intentCommand);
            const pendingAck = pendingIntentAcks.get(
              reservation.reservationId,
            );
            if (pendingAck) {
              pendingIntentAcks.delete(reservation.reservationId);
              bridge.acknowledgeIntent(pendingAck);
            }
          }
          return;
        }
        if (intentCommand) {
          bridge.intentQuery(intentCommand);
          return;
        }
        if (/^(common|storage)\./.test(napMessage.type)) {
          await bridge.dispatchTransfer(napMessage as never);
          return;
        }
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
        bridge.verifyNapplet({
          dTag: artifact.dTag,
          aggregateHash: artifact.aggregateHash,
        });
        bridge.registerVerifiedLaunch({
          coordinate: fixture.coordinate,
          manifestEventId: fixture.manifestEvent.id,
          dTag: artifact.dTag,
          aggregateHash: artifact.aggregateHash,
          capabilities: artifact.manifest.requires,
        });
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
