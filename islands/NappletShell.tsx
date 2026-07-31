import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  type CatalogMutationCommand,
  type CatalogStreamStatus,
  type CatalogViewEntry,
  type CatalogViewProjection,
  HomeView,
} from "../components/HomeView.tsx";
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
import {
  ConnectionConstellation,
  connectionCopy,
} from "../components/ConnectionConstellation.tsx";
import { ConnectionSheet } from "../components/ConnectionSheet.tsx";
import { debug as rootDebug, shortId } from "../debug.ts";
import {
  ConnectionController,
  type ConnectionSnapshot,
} from "../shell/connection.ts";

const debug = rootDebug.extend("shell");

interface NappletShellProps {
  readonly coordinate: string;
}

type View = "napplet" | "home" | "profile" | "settings";
type Notice = "connection" | "handshake" | "integrity" | null;

/**
 * A transport that never opens must still surface a failure. Fresh cannot
 * serve WebSocket upgrades under the Vite dev server before 2.4, where the
 * request hangs without an open, error, or close event.
 */
const CONNECT_FAILED =
  "Napplet Portal could not connect. Check the server and try again.";
const RITUAL_READY_CEILING_MS = 1_000;
const SLOW_START_ESCAPE_MS = 3_000;

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
  const [connection, setConnection] = useState<ConnectionSnapshot>({
    phase: "pending",
    mode: "cold",
    failures: 0,
    canRetry: false,
    nextRetryMs: null,
    online: true,
  });
  const [connectionSheetOpen, setConnectionSheetOpen] = useState(false);
  const [ritualVisible, setRitualVisible] = useState(Boolean(coordinate));
  const [slowStartEscape, setSlowStartEscape] = useState(false);
  const [catalog, setCatalog] = useState<CatalogViewProjection>({
    catalogEventId: null,
    entries: [],
  });
  const [catalogStatus, setCatalogStatus] = useState<CatalogStreamStatus>(
    "loading",
  );
  const controller = useRef<ConnectionController | null>(null);
  const iframe = useRef<HTMLIFrameElement | null>(null);
  const owner = useRef<{ connectionId: string; windowId: string } | null>(null);
  const signOutDialog = useRef<HTMLDialogElement | null>(null);
  const hasMountedNapplet = useRef(false);
  const registered = useRef<
    {
      source: Window;
      identity: VerifiedNappletIdentity;
    } | null
  >(null);
  const catalogCommands = useRef(
    new Map<string, (accepted: boolean) => void>(),
  );
  const mountedAt = useRef(Date.now());

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
        const ws = controller.current?.socket;
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
      closeCatalogDialog();
      const next = (event.state as { view?: View } | null)?.view;
      setView(
        next === "profile" || next === "napplet" || next === "settings"
          ? next
          : "home",
      );
    };
    globalThis.addEventListener("popstate", back);
    if (coordinate) {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      controller.current = new ConnectionController({
        coordinate,
        socketBaseUrl: `${protocol}//${location.host}/api/runtime`,
        createSocket: (url) => new WebSocket(url),
        onSnapshot: (snapshot) => {
          setConnection(snapshot);
          setConnecting(
            snapshot.phase === "pending" || snapshot.phase === "connected" ||
              snapshot.phase === "bootstrapping" ||
              snapshot.phase === "retrying",
          );
          if (snapshot.phase === "ready") {
            setRuntimeError("");
            setNotice(null);
            const remaining = Math.max(
              0,
              RITUAL_READY_CEILING_MS - (Date.now() - mountedAt.current),
            );
            setTimeout(() => setRitualVisible(false), remaining);
          } else if (snapshot.phase === "failed") {
            setRuntimeError(CONNECT_FAILED);
            if (hasMountedNapplet.current) setNotice("connection");
          }
        },
        onMessage: receiveRuntimeMessage,
      });
      const visibility = () => controller.current?.visibilityChanged();
      const online = () => controller.current?.onlineChanged();
      document.addEventListener("visibilitychange", visibility);
      globalThis.addEventListener("online", online);
      globalThis.addEventListener("offline", online);
      controller.current.start();
      const escapeTimer = setTimeout(
        () => setSlowStartEscape(true),
        SLOW_START_ESCAPE_MS,
      );
      return () => {
        debug("shell unmounting");
        globalThis.removeEventListener("message", receive);
        globalThis.removeEventListener("popstate", back);
        document.removeEventListener("visibilitychange", visibility);
        globalThis.removeEventListener("online", online);
        globalThis.removeEventListener("offline", online);
        controller.current?.stop();
        controller.current = null;
        clearTimeout(escapeTimer);
      };
    }
    return () => {
      debug("shell unmounting");
      globalThis.removeEventListener("message", receive);
      globalThis.removeEventListener("popstate", back);
    };
  }, []);

  useEffect(() => {
    hasMountedNapplet.current = Boolean(srcdoc);
  }, [srcdoc]);

  function receiveRuntimeMessage(message: Record<string, unknown>): void {
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
      debug(
        "runtime connected connection=%s window=%s resumed=%s",
        shortId(message.connectionId),
        shortId(message.windowId),
        Boolean(message.resumed),
      );
      return;
    }
    if (message.type === "runtime.event" && message.message) {
      debug("post runtime event to iframe");
      iframe.current?.contentWindow?.postMessage(message.message, "*");
      return;
    }
    if (message.type === "runtime.catalog") {
      if (
        message.status === "loading" || message.status === "ready" ||
        message.status === "stale" || message.status === "error"
      ) setCatalogStatus(message.status);
      if (message.catalog && typeof message.catalog === "object") {
        const next = message.catalog as CatalogViewProjection;
        if (Array.isArray(next.entries)) setCatalog(next);
      }
      return;
    }
    if (
      message.type === "runtime.catalog.result" &&
      typeof message.id === "string"
    ) {
      const resolve = catalogCommands.current.get(message.id);
      catalogCommands.current.delete(message.id);
      resolve?.(message.ok === true);
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
    history.pushState(
      { view: next },
      next === "settings"
        ? "/settings"
        : location.pathname === "/settings"
        ? "/"
        : location.href,
    );
  }

  function signOut(): void {
    debug("signout requested");
    controller.current?.send({ type: "runtime.signout" });
    setProfile(null);
    signOutDialog.current?.close();
    navigate("home");
  }

  function openCatalogEntry(entry: CatalogViewEntry): void {
    if (!entry.launch) return;
    bridge.reset();
    setIdentity({
      dTag: entry.launch.dTag,
      aggregateHash: entry.launch.aggregateHash,
    });
    setSrcdoc(entry.launch.srcdoc);
    navigate("napplet");
  }

  function closeCatalogDialog(): void {
    globalThis.dispatchEvent(new Event("catalog-dialog-close"));
  }

  function sendCatalogCommand(
    command: CatalogMutationCommand,
  ): Promise<boolean> {
    const ws = controller.current;
    if (!ws) return Promise.resolve(false);
    const id = crypto.randomUUID();
    return new Promise((resolve) => {
      catalogCommands.current.set(id, resolve);
      ws.send(
        command.type === "catalog.approve"
          ? {
            type: "catalog.approve",
            id,
            coordinate: command.coordinate,
            manifestEventId: command.manifestEventId,
          }
          : {
            type: "catalog.uninstall",
            id,
            coordinate: command.coordinate,
          },
      );
    });
  }

  const signedIn = profile !== null;
  const configured = Boolean(coordinate);
  const homeVisible = !configured || view === "home";
  return (
    <section class="portal-shell">
      <main class="shell-content">
        {ritualVisible && !srcdoc && (
          <div class="connection-ritual" data-escape={slowStartEscape}>
            <ConnectionConstellation state={connection} compact={false} />
            <span class="sr-only" aria-live="polite">
              {connectionCopy(connection)}
            </span>
            {connection.phase === "failed" && (
              <span class="sr-only" role="alert">
                Connection needs attention. Retry is available.
              </span>
            )}
            {slowStartEscape && (
              <div class="ritual-escape-actions">
                <button
                  type="button"
                  onClick={() => navigate("home")}
                >
                  Home
                </button>
                <a href={signedIn ? "#account" : "/signin"}>Account</a>
              </div>
            )}
          </div>
        )}
        <div
          class={`shell-view ${homeVisible ? "" : "shell-view-hidden"}`}
          inert={!homeVisible}
        >
          <HomeView
            configured={configured}
            catalog={catalog}
            status={catalogStatus}
            signedIn={signedIn}
            onOpen={openCatalogEntry}
            onCommand={sendCatalogCommand}
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
            onOpenSettings={() => navigate("settings")}
          />
        </div>
        <div
          class={`shell-view ${
            signedIn && view === "settings" ? "" : "shell-view-hidden"
          }`}
          inert={!signedIn || view !== "settings"}
        >
          <iframe
            class="settings-frame"
            src="/settings"
            title="Runtime settings"
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
              onRetry={() => controller.current?.retryNow()}
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
        connection={connection}
        onNavigate={navigate}
        onConnection={() => setConnectionSheetOpen(true)}
      />
      <ConnectionSheet
        state={connection}
        open={connectionSheetOpen}
        onClose={() => setConnectionSheetOpen(false)}
        onRetry={() => {
          setConnectionSheetOpen(false);
          controller.current?.retryNow();
        }}
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
  connection,
  onNavigate,
  onConnection,
}: {
  view: View;
  signedIn: boolean;
  connection: ConnectionSnapshot;
  onNavigate: (view: View) => void;
  onConnection: () => void;
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
        class="connection-status-button"
        aria-label={`Connection status: ${
          connectionCopy(connection)
        } Open details.`}
        onClick={onConnection}
      >
        <ConnectionConstellation state={connection} compact />
        <span>Status</span>
      </button>
      <button
        type="button"
        aria-current={signedIn && view === "profile" ? "page" : undefined}
        aria-label="Open account"
        disabled={!signedIn}
        onClick={() => onNavigate("profile")}
      >
        <UserIcon />
        <span>Account</span>
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
