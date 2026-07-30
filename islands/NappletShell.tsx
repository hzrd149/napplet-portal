import { useEffect, useRef, useState } from "preact/hooks";
import { NappletFrame } from "../components/NappletFrame.tsx";

interface NappletShellProps {
  readonly coordinate: string;
}

export default function NappletShell({ coordinate }: NappletShellProps) {
  const [srcdoc, setSrcdoc] = useState("");
  const [status, setStatus] = useState("Sign in to load Security Lab");
  const socket = useRef<WebSocket | null>(null);
  const iframe = useRef<HTMLIFrameElement | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    function receive(event: MessageEvent): void {
      const target = iframe.current?.contentWindow;
      if (!target || event.source !== target) return;
      const message = event.data as Record<string, unknown> | null;
      if (!message || typeof message.type !== "string") return;
      if (message.type === "shell.ready") {
        if (initialized.current) return;
        initialized.current = true;
        target.postMessage({
          type: "shell.init",
          capabilities: { domains: ["identity", "relay"] },
          services: ["identity", "relay"],
        }, "*");
        setStatus("Security Lab handshake complete");
        return;
      }
      if (!/^(identity|relay)\./.test(message.type)) return;
      const ws = socket.current;
      if (ws?.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({
        type: "runtime.forward",
        connectionId: "browser-tab",
        windowId: "security-lab",
        message,
      }));
    }

    globalThis.addEventListener("message", receive);
    return () => {
      globalThis.removeEventListener("message", receive);
      socket.current?.close();
    };
  }, []);

  function signIn(): void {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${location.host}/api/runtime`);
    socket.current = ws;
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "runtime.start", coordinate }));
      setStatus("Signed in — verifying supplied artifact…");
    });
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as Record<string, unknown>;
      if (message.type === "runtime.event") {
        const runtimeMessage = message.message;
        if (runtimeMessage && typeof runtimeMessage === "object") {
          iframe.current?.contentWindow?.postMessage(runtimeMessage, "*");
        }
        return;
      }
      if (
        message.type === "runtime.artifact" &&
        typeof message.srcdoc === "string"
      ) {
        initialized.current = false;
        setSrcdoc(message.srcdoc);
        setStatus("Verified Security Lab loaded");
      }
    });
  }

  return (
    <section class="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header class="flex items-center justify-between gap-4 border-b border-slate-800 p-4">
        <div>
          <h1 class="text-lg font-semibold">Napplet Portal</h1>
          <p class="text-xs text-slate-400">{status}</p>
        </div>
        <button
          type="button"
          onClick={signIn}
          class="rounded bg-emerald-500 px-4 py-2 font-medium text-slate-950"
        >
          Sign in
        </button>
      </header>
      <main class="min-h-0 flex-1">
        {srcdoc
          ? (
            <NappletFrame
              srcdoc={srcdoc}
              title="Security Lab napplet"
              onFrame={(frame) => iframe.current = frame}
            />
          )
          : (
            <div class="grid min-h-[70vh] place-items-center text-slate-400">
              No napplet loaded
            </div>
          )}
      </main>
    </section>
  );
}
