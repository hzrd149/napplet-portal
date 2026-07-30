import { qrcode } from "@libs/qrcode";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { HomeView } from "../components/HomeView.tsx";
import {
  createIframeBridge,
  type FrameIdentityRegistry,
  NappletFrame,
  type VerifiedNappletIdentity,
} from "../components/NappletFrame.tsx";
import {
  ProfileView,
  type PublicProfile,
  UserIcon,
} from "../components/ProfileView.tsx";

interface NappletShellProps {
  readonly coordinate: string;
}

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

type View = "napplet" | "home" | "profile";
type Notice = "connection" | "handshake" | "integrity" | null;

export default function NappletShell({ coordinate }: NappletShellProps) {
  const [srcdoc, setSrcdoc] = useState("");
  const [identity, setIdentity] = useState<VerifiedNappletIdentity | null>(
    null,
  );
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [view, setView] = useState<View>("home");
  const [notice, setNotice] = useState<Notice>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectionUri, setConnectionUri] = useState("");
  const [copied, setCopied] = useState(false);
  const [signInError, setSignInError] = useState("");
  const socket = useRef<WebSocket | null>(null);
  const iframe = useRef<HTMLIFrameElement | null>(null);
  const owner = useRef<{ connectionId: string; windowId: string } | null>(null);
  const reconnectToken = useRef<string | null>(null);
  const copyTimer = useRef<number | null>(null);
  const signOutDialog = useRef<HTMLDialogElement | null>(null);
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
    const relay = `${
      location.protocol === "https:" ? "wss:" : "ws:"
    }//${location.host}/api/runtime`;
    setConnectionUri(
      `nostrconnect://napplet-portal?relay=${encodeURIComponent(relay)}`,
    );
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
      if (copyTimer.current !== null) clearTimeout(copyTimer.current);
      socket.current?.close();
    };
  }, []);

  function openSocket(method: "connect" | "bunker" | "nsec" = "connect"): void {
    if (!coordinate) return;
    setConnecting(true);
    setSignInError("");
    setNotice(null);
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
      ws.send(JSON.stringify({ type: "runtime.start", coordinate, method }));
    });
    ws.addEventListener("message", (event) => receiveRuntimeMessage(event));
    ws.addEventListener("error", () => {
      setConnecting(false);
      setSignInError(
        "Napplet Portal could not connect. Check the server and try again.",
      );
    });
    ws.addEventListener("close", () => {
      setConnecting(false);
      if (profile) {
        setProfile((current) =>
          current ? { ...current, status: "offline" } : null
        );
      }
      if (srcdoc) setNotice("connection");
    });
  }

  function receiveRuntimeMessage(event: MessageEvent): void {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(String(event.data)) as Record<string, unknown>;
    } catch {
      return;
    }
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
    if (message.type === "runtime.error") {
      setConnecting(false);
      setNotice("integrity");
      return;
    }
    if (
      message.type !== "runtime.artifact" ||
      typeof message.srcdoc !== "string" ||
      !message.identity || typeof message.identity !== "object"
    ) return;
    const nextIdentity = message.identity as Record<string, unknown>;
    const account = message.account as Record<string, unknown> | undefined;
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
    if (typeof account?.pubkey === "string") {
      setProfile({ pubkey: account.pubkey, status: "active" });
    }
    setConnecting(false);
    navigate("napplet");
  }

  function navigate(next: View): void {
    setView(next);
    history.pushState({ view: next }, "", location.href);
  }

  async function copyUri(): Promise<void> {
    await navigator.clipboard.writeText(connectionUri);
    setCopied(true);
    if (copyTimer.current !== null) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2_000);
  }

  function signOut(): void {
    socket.current?.send(JSON.stringify({ type: "runtime.signout" }));
    setProfile(null);
    signOutDialog.current?.close();
    navigate("home");
  }

  const signedIn = profile !== null;
  return (
    <section class="portal-shell">
      <main class="shell-content">
        {!signedIn && (
          <SignInPanel
            uri={connectionUri}
            connecting={connecting}
            error={signInError}
            copied={copied}
            onCopy={copyUri}
            onConnect={openSocket}
          />
        )}
        <div
          class={`shell-view ${
            signedIn && view === "home" ? "" : "shell-view-hidden"
          }`}
          inert={!signedIn || view !== "home"}
        >
          <HomeView
            configured={Boolean(coordinate)}
            title="Security Lab"
            active={Boolean(srcdoc)}
            onOpen={() => navigate("napplet")}
          />
        </div>
        <div
          class={`shell-view ${
            signedIn && view === "profile" ? "" : "shell-view-hidden"
          }`}
          inert={!signedIn || view !== "profile"}
        >
          <ProfileView
            profile={profile}
            onSignOut={() => signOutDialog.current?.showModal()}
          />
        </div>
        <div
          class={`napplet-stack ${
            signedIn && view === "napplet" ? "" : "shell-view-hidden"
          }`}
          inert={!signedIn || view !== "napplet"}
        >
          {notice && (
            <ShellNotice
              notice={notice}
              onRetry={() => openSocket()}
            />
          )}
          <NappletFrame
            srcdoc={srcdoc}
            identity={identity}
            title="Security Lab napplet"
            hidden={!signedIn || view !== "napplet"}
            registry={registry}
            onFrame={(frame) => iframe.current = frame}
          />
          {!srcdoc && (
            <p class="stream-status" aria-live="polite">Waiting for updates</p>
          )}
        </div>
      </main>
      <PrimaryNavigation
        view={view}
        signedIn={signedIn}
        onNavigate={navigate}
      />
      <dialog
        ref={signOutDialog}
        class="signout-dialog"
        aria-labelledby="signout-title"
      >
        <h2 id="signout-title">Sign out</h2>
        <p>
          Sign out of this account? Public data will keep updating, but signing
          actions will stop.
        </p>
        <div class="dialog-actions">
          <button type="button" onClick={() => signOutDialog.current?.close()}>
            Keep account
          </button>
          <button type="button" class="destructive-button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </dialog>
    </section>
  );
}

interface SignInPanelProps {
  readonly uri: string;
  readonly connecting: boolean;
  readonly error: string;
  readonly copied: boolean;
  readonly onCopy: () => void;
  readonly onConnect: (method?: "connect" | "bunker" | "nsec") => void;
}

function SignInPanel(props: SignInPanelProps) {
  const launch = createSignerLaunch(props.uri);
  return (
    <section class="sign-in-view" aria-labelledby="sign-in-title">
      <div class="sign-in-panel">
        <h1 id="sign-in-title">Connect signer</h1>
        <p>
          Scan this QR code with your signer app, or copy the connection URI.
        </p>
        <div class="qr-code" role="img" aria-label="Nostr Connect QR code">
          {launch.qrDataUrl && <img src={launch.qrDataUrl} alt="" />}
        </div>
        <label for="connect-uri">Connection URI</label>
        <div class="uri-row">
          <input id="connect-uri" value={props.uri} readOnly />
          <button type="button" onClick={props.onCopy} disabled={!props.uri}>
            {props.copied ? "Copied" : "Copy URI"}
          </button>
        </div>
        <a
          class="primary-button"
          href={launch.href || undefined}
          aria-disabled={!launch.href || props.connecting}
          onClick={(event) => {
            if (!launch.href || props.connecting) {
              event.preventDefault();
              return;
            }
            props.onConnect("connect");
          }}
        >
          {props.connecting ? "Connecting…" : "Connect signer"}
        </a>
        <details>
          <summary>Use bunker URI</summary>
          <label for="bunker-uri">Bunker URI</label>
          <input id="bunker-uri" type="password" autoComplete="off" />
          <button type="button" onClick={() => props.onConnect("bunker")}>
            Connect bunker
          </button>
        </details>
        <details>
          <summary>
            Use nsec <span class="warning-badge">Not recommended</span>
          </summary>
          <label for="nsec">Private key</label>
          <input id="nsec" type="password" autoComplete="off" />
          <button type="button" onClick={() => props.onConnect("nsec")}>
            Use nsec
          </button>
        </details>
        {props.error && <p class="form-error" role="alert">{props.error}</p>}
      </div>
    </section>
  );
}

function ShellNotice(
  { notice, onRetry }: { notice: Exclude<Notice, null>; onRetry: () => void },
) {
  const copy = notice === "integrity"
    ? "The napplet could not be verified and was not opened."
    : notice === "handshake"
    ? "The napplet did not start correctly."
    : "Napplet Portal could not connect. Check the server and try again.";
  return (
    <div class="shell-notice" role="alert" title={copy}>
      <span>{copy}</span>
      <button type="button" onClick={onRetry}>
        {notice === "connection" ? "Retry Connection" : "Retry Napplet"}
      </button>
    </div>
  );
}

function PrimaryNavigation({
  view,
  signedIn,
  onNavigate,
}: {
  view: View;
  signedIn: boolean;
  onNavigate: (view: View) => void;
}) {
  return (
    <nav aria-label="Primary" class="bottom-nav">
      <button
        type="button"
        aria-current={signedIn && view === "home" ? "page" : undefined}
        disabled={!signedIn}
        onClick={() => onNavigate("home")}
      >
        <HomeIcon />
        <span>Home</span>
      </button>
      <button
        type="button"
        aria-current={signedIn && view === "profile" ? "page" : undefined}
        aria-label="Open profile"
        disabled={!signedIn}
        onClick={() => onNavigate("profile")}
      >
        <UserIcon />
        <span>Profile</span>
      </button>
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m3 11 9-8 9 8v10h-6v-6H9v6H3z" />
    </svg>
  );
}
