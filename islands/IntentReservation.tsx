import { useEffect, useState } from "preact/hooks";

const ID = /^[0-9a-f-]{36}$/;

export default function IntentReservation() {
  const [status, setStatus] = useState("Preparing verified napplet…");
  const [srcdoc, setSrcdoc] = useState("");

  useEffect(() => {
    // This is deliberately the first browser-side operation. Sensitive transport
    // and ticket work starts only after the opener relationship is gone.
    globalThis.opener = null;
    const params = new URLSearchParams(location.hash.slice(1));
    const reservationId = params.get("reservationId");
    const ticket = params.get("ticket");
    const targetWindowId = params.get("targetWindowId");
    const generation = Number(params.get("generation"));
    history.replaceState(null, "", location.pathname);
    if (
      !reservationId || !ID.test(reservationId) || !ticket ||
      !ID.test(ticket) || !targetWindowId || !ID.test(targetWindowId) ||
      !Number.isSafeInteger(generation) || generation < 0
    ) {
      setStatus("Invalid navigation reservation.");
      return;
    }
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(
      `${protocol}//${location.host}/api/runtime?window=${targetWindowId}`,
    );
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as Record<string, unknown>;
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
        const claim = message.claim as Record<string, unknown> | undefined;
        if (message.ok && typeof claim?.srcdoc === "string") {
          setStatus("Verified napplet opened.");
          setSrcdoc(claim.srcdoc);
        } else {
          setStatus("Reservation expired.");
          socket.close();
        }
      }
    });
    socket.addEventListener("error", () => setStatus("Reservation failed."));
    return () => socket.close();
  }, []);

  return (
    <main class="intent-reservation">
      <p aria-live="polite">{status}</p>
      {srcdoc && (
        <iframe
          title="Verified napplet"
          sandbox="allow-scripts"
          srcDoc={srcdoc}
        />
      )}
    </main>
  );
}
