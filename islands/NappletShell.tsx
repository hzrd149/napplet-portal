import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  createIframeBridge,
  type FrameIdentityRegistry,
  NappletFrame,
  type VerifiedNappletIdentity,
} from "../components/NappletFrame.tsx";

interface NappletShellProps {
  readonly coordinate: string;
}

type View = "napplet" | "home" | "profile";

export default function NappletShell({ coordinate }: NappletShellProps) {
  const [srcdoc, setSrcdoc] = useState("");
  const [identity, setIdentity] = useState<VerifiedNappletIdentity | null>(
    null,
  );
  const [view, setView] = useState<View>("home");
  const [status, setStatus] = useState("Waiting for updates");
  const socket = useRef<WebSocket | null>(null);
  const iframe = useRef<HTMLIFrameElement | null>(null);
  const owner = useRef<{ connectionId: string; windowId: string } | null>(null);
  const reconnectToken = useRef<string | null>(null);
  const registered = useRef<
    {
      source: Window;
      identity: VerifiedNappletIdentity;
    } | null
  >(null);

  const registry = useMemo<FrameIdentityRegistry>(() => ({
    register(source, nextIdentity) {
      registered.current = { source, identity: nextIdentity };
    },
  }), []);

  const bridge = useMemo(() =>
    createIframeBridge({
      source: () => iframe.current?.contentWindow ?? null,
      post: (message) =>
        iframe.current?.contentWindow?.postMessage(message, "*"),
      forward: (message) => {
        const ws = socket.current;
        const currentOwner = owner.current;
        if (ws?.readyState !== WebSocket.OPEN || !currentOwner) return;
        ws.send(JSON.stringify({
          type: "runtime.forward",
          ...currentOwner,
          message,
        }));
      },
    }), []);

  useEffect(() => {
    const receive = (event: MessageEvent) => bridge.receive(event);
    globalThis.addEventListener("message", receive);
    const back = (event: PopStateEvent) => {
      const next = (event.state as { view?: View } | null)?.view;
      setView(next === "profile" || next === "napplet" ? next : "home");
    };
    globalThis.addEventListener("popstate", back);
    return () => {
      globalThis.removeEventListener("message", receive);
      globalThis.removeEventListener("popstate", back);
      socket.current?.close();
    };
  }, []);

  function openSocket(): void {
    socket.current?.close();
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const token = reconnectToken.current
      ? `?reconnect=${encodeURIComponent(reconnectToken.current)}`
      : "";
    const ws = new WebSocket(
      `${protocol}//${location.host}/api/runtime${token}`,
    );
    socket.current = ws;
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "runtime.start", coordinate }));
    });
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as Record<string, unknown>;
      if (
        message.type === "runtime.connected" &&
        typeof message.connectionId === "string" &&
        typeof message.windowId === "string" &&
        typeof message.reconnectToken === "string"
      ) {
        owner.current = {
          connectionId: message.connectionId,
          windowId: message.windowId,
        };
        reconnectToken.current = message.reconnectToken;
        return;
      }
      if (message.type === "runtime.event" && message.message) {
        iframe.current?.contentWindow?.postMessage(message.message, "*");
        return;
      }
      if (
        message.type === "runtime.artifact" &&
        typeof message.srcdoc === "string" &&
        message.identity && typeof message.identity === "object"
      ) {
        const nextIdentity = message.identity as Record<string, unknown>;
        if (
          typeof nextIdentity.dTag !== "string" ||
          typeof nextIdentity.aggregateHash !== "string"
        ) return;
        bridge.reset();
        setIdentity({
          dTag: nextIdentity.dTag,
          aggregateHash: nextIdentity.aggregateHash,
        });
        setSrcdoc(message.srcdoc);
        navigate("napplet");
      }
    });
    ws.addEventListener("close", () => setStatus("Connection interrupted"));
  }

  function navigate(next: View): void {
    setView(next);
    history.pushState({ view: next }, "", location.href);
  }

  return (
    <section class="portal-shell">
      <main class="shell-content">
        <div class={`shell-view ${view === "home" ? "" : "shell-view-hidden"}`}>
          <button type="button" onClick={openSocket}>Connect signer</button>
        </div>
        <div
          class={`shell-view ${view === "profile" ? "" : "shell-view-hidden"}`}
        >
          <p>{status}</p>
        </div>
        <NappletFrame
          srcdoc={srcdoc}
          identity={identity}
          title="Security Lab napplet"
          hidden={view !== "napplet"}
          registry={registry}
          onFrame={(frame) => iframe.current = frame}
        />
      </main>
      <nav aria-label="Primary" class="bottom-nav">
        <button
          type="button"
          aria-current={view === "home" ? "page" : undefined}
          onClick={() => navigate("home")}
        >
          Home
        </button>
        <button
          type="button"
          aria-current={view === "profile" ? "page" : undefined}
          onClick={() => navigate("profile")}
        >
          Profile
        </button>
      </nav>
    </section>
  );
}
