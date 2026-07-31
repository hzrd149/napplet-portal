window.opener = null;

const status = document.getElementById("status");
const params = new URLSearchParams(location.hash.slice(1));
const reservationId = params.get("reservationId");
const ticket = params.get("ticket");
const targetWindowId = params.get("targetWindowId");
const generation = Number(params.get("generation"));
const id = /^[0-9a-z-]{1,128}$/;
history.replaceState(null, "", location.pathname);

if (
  !reservationId || !id.test(reservationId) || !ticket || !id.test(ticket) ||
  !targetWindowId || !id.test(targetWindowId) ||
  !Number.isSafeInteger(generation) || generation < 0
) {
  status.textContent = "Invalid navigation reservation.";
} else {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(
    `${protocol}//${location.host}/api/runtime?window=${targetWindowId}`,
  );
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.type === "runtime.connected") {
      socket.send(JSON.stringify({
        type: "runtime.forward",
        connectionId: message.connectionId,
        windowId: message.windowId,
        message: {
          type: "intent.ticket.claim",
          reservationId,
          ticket,
          targetWindowId,
          generation,
        },
      }));
    } else if (
      message.type === "runtime.intent.ticket" &&
      message.reservationId === reservationId
    ) {
      if (message.ok && typeof message.claim?.srcdoc === "string") {
        status.textContent = "Verified napplet opened.";
        const frame = document.createElement("iframe");
        frame.title = "Verified napplet";
        frame.sandbox.add("allow-scripts");
        frame.srcdoc = message.claim.srcdoc;
        document.body.append(frame);
      } else {
        status.textContent = "Reservation expired.";
        socket.close();
      }
    }
  });
  socket.addEventListener("error", () => {
    status.textContent = "Reservation failed.";
  });
}
