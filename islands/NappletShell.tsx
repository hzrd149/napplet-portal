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
import { debug as rootDebug, shortId } from "../debug.ts";

const debug = rootDebug.extend("shell");

interface NappletShellProps {
  readonly coordinate: string;
}

type View = "napplet" | "home" | "profile";
type Notice = "connection" | "handshake" | "integrity" | null;

/**
 * A transport that never opens must still surface a failure. Fresh cannot
 * serve WebSocket upgrades under the Vite dev server before 2.4, where the
 * request hangs without an open, error, or close event.
 */
const CONNECT_TIMEOUT_MS = 10_000;

const CONNECT_FAILED =
  "Napplet Portal could not connect. Check the server and try again.";

export default function NappletShell({ coordinate }: NappletShellProps) {
  const [srcdoc, setSrcdoc] = useState("");
  const [identity, setIdentity] = useState<VerifiedNappletIdentity | null>(
    null,
  );
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [view, setView] = useState<View>("home");
  const [notice, setNotice] = useState<Notice>(null);
  const [connecting, setConnecting] = useState(false);
  const [runtimeError, setRuntimeError] = useState("");
  const socket = useRef<WebSocket | null>(null);
  const iframe = useRef<HTMLIFrameElement | null>(null);
  const owner = useRef<{ connectionId: string; windowId: string } | null>(null);
  const reconnectToken = useRef<string | null>(null);
  const connectTimer = useRef<number | null>(null);
  const signOutDialog = useRef<HTMLDialogElement | null>(null);
  const hasMountedNapplet = useRef(false);
  const registered = useRef<
    {
      source: Window;
      identity: VerifiedNappletIdentity;
    } | null
  >(null);

  const registry = useMemo<FrameIdentityRegistry>(() => ({
    register(source, nextIdentity) {
      registered.current = { source, identity: nextIdentity };
      debug(
        "registered frame identity dTag=%s aggregate=%s",
        nextIdentity.dTag,
        shortId(nextIdentity.aggregateHash),
      );
    },
  }), []);

  const bridge = useMemo(() =>
    createIframeBridge({
      source: () => iframe.current?.contentWindow ?? null,
      post: (message) => {
        debug("post iframe message type=%s", String(message.type));
        iframe.current?.contentWindow?.postMessage(message, "*");
      },
      forward: (message) => {
        const ws = socket.current;
        const currentOwner = owner.current;
        if (ws?.readyState !== WebSocket.OPEN || !currentOwner) {
          debug(
            "skip runtime forward type=%s readyState=%s owner=%s",
            String(message.type),
            ws?.readyState ?? "none",
            Boolean(currentOwner),
          );
          return;
        }
        debug(
          "send runtime forward connection=%s window=%s type=%s",
          shortId(currentOwner.connectionId),
          shortId(currentOwner.windowId),
          String(message.type),
        );
        ws.send(JSON.stringify({
          type: "runtime.forward",
          ...currentOwner,
          message,
        }));
      },
    }), []);

  useEffect(() => {
    debug("shell mounted coordinate=%s", coordinate ? "configured" : "empty");
    const receive = (event: MessageEvent) => bridge.receive(event);
    globalThis.addEventListener("message", receive);
    const back = (event: PopStateEvent) => {
      const next = (event.state as { view?: View } | null)?.view;
      setView(next === "profile" || next === "napplet" ? next : "home");
    };
    globalThis.addEventListener("popstate", back);
    openSocket();
    return () => {
      debug("shell unmounting");
      globalThis.removeEventListener("message", receive);
      globalThis.removeEventListener("popstate", back);
      if (connectTimer.current !== null) clearTimeout(connectTimer.current);
      socket.current?.close();
    };
  }, []);

  useEffect(() => {
    hasMountedNapplet.current = Boolean(srcdoc);
  }, [srcdoc]);

  function openSocket(): void {
    if (!coordinate) {
      debug("open socket skipped empty coordinate");
      return;
    }
    debug(
      "open socket started reconnect=%s",
      Boolean(reconnectToken.current),
    );
    setConnecting(true);
    setRuntimeError("");
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
    if (connectTimer.current !== null) clearTimeout(connectTimer.current);
    connectTimer.current = setTimeout(() => {
      if (socket.current !== ws || ws.readyState === WebSocket.OPEN) return;
      debug("socket connect timeout");
      ws.close();
      setConnecting(false);
      setRuntimeError(CONNECT_FAILED);
    }, CONNECT_TIMEOUT_MS);
    ws.addEventListener("open", () => {
      debug("socket open");
      if (connectTimer.current !== null) clearTimeout(connectTimer.current);
      connectTimer.current = null;
    });
    ws.addEventListener("message", (event) => receiveRuntimeMessage(event));
    ws.addEventListener("error", () => {
      // A superseded socket must not report failure for its replacement.
      if (socket.current !== ws) return;
      debug("socket error");
      setConnecting(false);
      setRuntimeError(CONNECT_FAILED);
    });
    ws.addEventListener("close", () => {
      if (socket.current !== ws) return;
      debug("socket close");
      if (connectTimer.current !== null) clearTimeout(connectTimer.current);
      connectTimer.current = null;
      setConnecting(false);
      setProfile((current) =>
        current ? { ...current, status: "offline" } : null
      );
      if (hasMountedNapplet.current) setNotice("connection");
    });
  }

  function receiveRuntimeMessage(event: MessageEvent): void {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(String(event.data)) as Record<string, unknown>;
    } catch {
      debug("ignored invalid runtime JSON");
      return;
    }
    debug("received runtime message type=%s", String(message.type));
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
      debug(
        "runtime connected connection=%s window=%s resumed=%s",
        shortId(message.connectionId),
        shortId(message.windowId),
        Boolean(message.resumed),
      );
      socket.current?.send(JSON.stringify({
        type: "runtime.start",
        coordinate,
      }));
      return;
    }
    if (message.type === "runtime.event" && message.message) {
      debug("post runtime event to iframe");
      iframe.current?.contentWindow?.postMessage(message.message, "*");
      return;
    }
    if (message.type === "runtime.auth.required") {
      debug("runtime auth required");
      setConnecting(false);
      setRuntimeError("Sign in before opening this napplet.");
      return;
    }
    if (message.type === "runtime.error") {
      debug("runtime integrity error");
      setConnecting(false);
      if (typeof message.error === "string") setRuntimeError(message.error);
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
    debug(
      "runtime artifact received dTag=%s aggregate=%s account=%s",
      nextIdentity.dTag,
      shortId(nextIdentity.aggregateHash),
      typeof account?.pubkey === "string" ? shortId(account.pubkey) : "none",
    );
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
    debug("navigate view=%s", next);
    setView(next);
    history.pushState({ view: next }, "", location.href);
  }

  function signOut(): void {
    debug("signout requested");
    socket.current?.send(JSON.stringify({ type: "runtime.signout" }));
    setProfile(null);
    signOutDialog.current?.close();
    navigate("home");
  }

  const signedIn = profile !== null;
  const configured = Boolean(coordinate);
  const homeVisible = !configured || view === "home";
  return (
    <section class="portal-shell">
      <main class="shell-content">
        <div
          class={`shell-view ${homeVisible ? "" : "shell-view-hidden"}`}
          inert={!homeVisible}
        >
          <HomeView
            configured={configured}
            signedIn={signedIn}
            title="Security Lab"
            active={Boolean(srcdoc)}
            onOpen={() => navigate("napplet")}
          />
          {runtimeError && <p class="form-error" role="alert">{runtimeError}
          </p>}
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
            <p class="stream-status" aria-live="polite">
              {connecting ? "Waiting for updates" : "Open a signed-in session"}
            </p>
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
