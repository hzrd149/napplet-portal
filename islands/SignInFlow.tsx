import { qrcode } from "@libs/qrcode";
import { useEffect, useRef, useState } from "preact/hooks";

type SignInStatus =
  | { readonly status: "active"; readonly pubkey: string }
  | { readonly status: "offline"; readonly pubkey: string }
  | { readonly status: "unavailable" }
  | { readonly status: "idle" }
  | { readonly status: "preparing" }
  | { readonly status: "awaiting"; readonly uri: string }
  | { readonly status: "error"; readonly message: string };

export function createSignerLaunch(uri: string): {
  readonly href: string;
  readonly qrSvg: string;
  readonly qrDataUrl: string;
} {
  const qrSvg = uri
    ? qrcode(uri, { output: "svg", ecl: "MEDIUM", border: 2 })
    : "";
  return {
    href: uri,
    qrSvg,
    qrDataUrl: qrSvg ? `data:image/svg+xml,${encodeURIComponent(qrSvg)}` : "",
  };
}

export default function SignInFlow() {
  const [status, setStatus] = useState<SignInStatus>({ status: "idle" });
  const [uri, setUri] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [bunker, setBunker] = useState("");
  const [nsec, setNsec] = useState("");
  const socket = useRef<WebSocket | null>(null);
  const copyTimer = useRef<number | null>(null);
  const started = useRef(false);

  useEffect(() => {
    void refreshStatus();
    startQrSignIn();
    return () => {
      socket.current?.close();
      if (copyTimer.current !== null) clearTimeout(copyTimer.current);
    };
  }, []);

  async function refreshStatus(): Promise<void> {
    const response = await fetch("/api/signin/status");
    if (!response.ok) return;
    setStatus(await response.json() as SignInStatus);
  }

  function startQrSignIn(): void {
    if (started.current) return;
    started.current = true;
    setError("");
    setUri("");
    setCopied(false);
    socket.current?.close();
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocol}//${location.host}/api/signin/connect`,
    );
    socket.current = ws;
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "signer.start" }));
    });
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as Record<string, unknown>;
      if (
        message.type === "signer.pending" && typeof message.uri === "string"
      ) {
        setUri(message.uri);
        setStatus({ status: "awaiting", uri: message.uri });
        return;
      }
      if (message.type === "signer.preparing") {
        setStatus({ status: "preparing" });
        return;
      }
      if (
        message.type === "signer.active" && typeof message.pubkey === "string"
      ) {
        setStatus({ status: "active", pubkey: message.pubkey });
        location.href = "/";
        return;
      }
      if (message.type === "signer.error") {
        const messageText = typeof message.message === "string"
          ? message.message
          : "Remote signer connection failed or timed out.";
        setError(messageText);
        setStatus({ status: "error", message: messageText });
      }
    });
    ws.addEventListener("error", () => {
      started.current = false;
      setError(
        "Napplet Portal could not connect. Check the server and try again.",
      );
    });
    ws.addEventListener("close", () => {
      if (status.status !== "awaiting" && status.status !== "preparing") {
        started.current = false;
      }
    });
  }

  function cancelQrSignIn(): void {
    socket.current?.send(JSON.stringify({ type: "signer.cancel" }));
    socket.current?.close();
    started.current = false;
    setUri("");
    setStatus({ status: "idle" });
  }

  async function submitJson(path: string, body: Record<string, string>) {
    setError("");
    socket.current?.close();
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json() as SignInStatus;
    setStatus(payload);
    if (payload.status === "active") {
      location.href = "/";
      return;
    }
    if (payload.status === "error") setError(payload.message);
  }

  async function copyUri(): Promise<void> {
    await navigator.clipboard.writeText(uri);
    setCopied(true);
    if (copyTimer.current !== null) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2_000);
  }

  const launch = createSignerLaunch(uri);
  const waiting = status.status === "preparing" || status.status === "awaiting";
  return (
    <section
      class="sign-in-view sign-in-view-page"
      aria-labelledby="sign-in-title"
    >
      <div class="sign-in-panel">
        <p>
          <a href="/">Back to portal</a>
        </p>
        <h1 id="sign-in-title">Connect signer</h1>
        <p>
          Use a remote signer QR code, paste a bunker URI, or use an isolated
          development key.
        </p>
        {status.status === "active" && (
          <p class="signer-status">
            <strong>Signer connected</strong>
          </p>
        )}
        <section aria-label="Nostr Connect QR">
          <h2>QR sign-in</h2>
          <p>
            Start a server-owned Nostr Connect session and approve it in your
            signer.
          </p>
          <div class="qr-code" role="img" aria-label="Nostr Connect QR code">
            {launch.qrDataUrl && <img src={launch.qrDataUrl} alt="" />}
          </div>
          <label for="connect-uri">Connection URI</label>
          <div class="uri-row">
            <input id="connect-uri" value={uri} readOnly />
            <button type="button" onClick={copyUri} disabled={!uri}>
              {copied ? "Copied" : "Copy URI"}
            </button>
          </div>
          <a
            class="primary-button"
            href={launch.href || undefined}
            aria-disabled={!launch.href}
            onClick={(event) => {
              if (!launch.href) event.preventDefault();
            }}
          >
            Connect signer
          </a>
          {!waiting && !uri && (
            <button type="button" onClick={startQrSignIn}>
              Start QR sign-in
            </button>
          )}
          {waiting && (
            <button type="button" onClick={cancelQrSignIn}>Cancel</button>
          )}
          {waiting && (
            <p class="inline-status" aria-live="polite">
              {status.status === "awaiting"
                ? "Awaiting remote signer connection..."
                : "Preparing secure signer connection..."}
            </p>
          )}
        </section>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitJson("/api/signin/bunker", { uri: bunker });
          }}
        >
          <h2>Use bunker URI</h2>
          <label for="bunker-uri">Bunker URI</label>
          <input
            id="bunker-uri"
            type="password"
            autoComplete="off"
            value={bunker}
            onInput={(event) => setBunker(event.currentTarget.value)}
          />
          <button type="submit">Connect bunker</button>
        </form>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitJson("/api/signin/nsec", { nsec });
          }}
        >
          <h2>
            Use nsec <span class="warning-badge">Not recommended</span>
          </h2>
          <label for="nsec">Private key</label>
          <input
            id="nsec"
            type="password"
            autoComplete="off"
            value={nsec}
            onInput={(event) => setNsec(event.currentTarget.value)}
          />
          <button type="submit">Use nsec</button>
        </form>
        {error && <p class="form-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
