import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  type CatalogCommandOutcome,
  type CatalogMutationCommand,
  type CatalogStreamStatus,
  type CatalogViewEntry,
  type CatalogViewProjection,
  HomeView,
} from "../components/HomeView.tsx";
import {
  createIframeBridge,
  createVerifiedIdentityPublisher,
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
import { HomeHeader } from "../components/HomeHeader.tsx";
import { AccountSheet } from "../components/AccountSheet.tsx";
import { debug as rootDebug, shortId } from "../debug.ts";
import {
  ConnectionController,
  type ConnectionSnapshot,
} from "../shell/connection.ts";
import {
  ActiveBinaryRequests,
  BinaryFrameKind,
  decodeBinaryFrames,
  encodeBinaryFrame,
  FIXED_RESOURCE_URL,
} from "../runtime/binary_transport.ts";
import { decodeNapControlMessage } from "../runtime/transport.ts";

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
export const MAX_PENDING_CATALOG_COMMANDS = 32;
const CATALOG_COMMAND_TIMEOUT_MS = 15_000;

interface CatalogResult extends CatalogCommandOutcome {
  readonly value?: unknown;
  readonly retryable?: boolean;
}

interface PendingCatalogCommand {
  readonly resolve: (result: CatalogResult) => void;
  readonly timeout: number;
}

export function decodeResourceBinaryResult(
  bytes: Uint8Array,
  currentOwner: { readonly connectionId: string; readonly windowId: string },
  requests: ActiveBinaryRequests,
): Record<string, unknown> | null {
  const decoded = decodeBinaryFrames(bytes, currentOwner);
  if (!decoded.ok || decoded.frames.length !== 1) return null;
  const result = decoded.frames[0];
  if (
    result.kind !== BinaryFrameKind.ResourceResult ||
    !requests.settle(currentOwner, result.id)
  ) return null;
  return {
    type: "resource.bytes.result",
    id: result.id,
    blob: new Blob([result.payload.slice().buffer], { type: "text/plain" }),
    mime: "text/plain",
  };
}

export class CatalogCommandRegistry {
  readonly #pending = new Map<string, PendingCatalogCommand>();
  readonly #setTimer: typeof setTimeout;
  readonly #clearTimer: typeof clearTimeout;

  constructor(
    readonly send: (message: Record<string, unknown>) => boolean,
    timers: { setTimer?: typeof setTimeout; clearTimer?: typeof clearTimeout } =
      {},
  ) {
    this.#setTimer = timers.setTimer ?? setTimeout;
    this.#clearTimer = timers.clearTimer ?? clearTimeout;
  }

  request(command: Record<string, unknown>): Promise<CatalogResult> {
    if (this.#pending.size >= MAX_PENDING_CATALOG_COMMANDS) {
      return Promise.resolve({
        ok: false,
        error: "catalog-command-capacity",
        retryable: true,
      });
    }
    const id = crypto.randomUUID();
    return new Promise((resolve) => {
      const timeout = this.#setTimer(() => {
        this.#settle(id, {
          ok: false,
          error: "catalog-command-timeout",
          retryable: true,
        });
      }, CATALOG_COMMAND_TIMEOUT_MS);
      this.#pending.set(id, { resolve, timeout });
      if (!this.send({ ...command, id })) {
        this.#settle(id, {
          ok: false,
          error: "catalog-command-disconnected",
          retryable: true,
        });
      }
    });
  }

  receive(message: Record<string, unknown>): boolean {
    if (
      message.type !== "runtime.catalog.result" ||
      typeof message.id !== "string"
    ) return false;
    const result: CatalogResult = message.ok === true
      ? { ok: true, value: message.value }
      : {
        ok: false,
        error: typeof message.error === "string"
          ? message.error
          : "catalog-command-failed",
        retryable: message.retryable === true,
      };
    return this.#settle(message.id, result);
  }

  clear(error = "catalog-command-disconnected"): void {
    for (const id of [...this.#pending.keys()]) {
      this.#settle(id, { ok: false, error, retryable: true });
    }
  }

  get size(): number {
    return this.#pending.size;
  }

  #settle(id: string, result: CatalogResult): boolean {
    const pending = this.#pending.get(id);
    if (!pending) return false;
    this.#pending.delete(id);
    this.#clearTimer(pending.timeout);
    pending.resolve(result);
    return true;
  }
}

function validCatalogProjection(
  value: unknown,
): value is CatalogViewProjection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const projection = value as Record<string, unknown>;
  if (
    !(projection.catalogEventId === null ||
      (typeof projection.catalogEventId === "string" &&
        /^[0-9a-f]{64}$/.test(projection.catalogEventId))) ||
    !Array.isArray(projection.entries)
  ) return false;
  const coordinates = new Set<string>();
  return projection.entries.every((candidate) => {
    if (
      !candidate || typeof candidate !== "object" || Array.isArray(candidate)
    ) return false;
    const entry = candidate as Record<string, unknown>;
    if (
      typeof entry.coordinate !== "string" ||
      !/^\d+:[0-9a-f]{64}:[^:\s]+$/.test(entry.coordinate) ||
      coordinates.has(entry.coordinate)
    ) return false;
    coordinates.add(entry.coordinate);
    return typeof entry.acceptedManifestEventId === "string" &&
      /^[0-9a-f]{64}$/.test(entry.acceptedManifestEventId) &&
      (entry.resolution === "pending" || entry.resolution === "ready" ||
        entry.resolution === "unavailable") &&
      (entry.title === undefined || typeof entry.title === "string") &&
      (entry.version === undefined || typeof entry.version === "string") &&
      (entry.capabilities === undefined ||
        (Array.isArray(entry.capabilities) &&
          entry.capabilities.every((item) => typeof item === "string")));
  });
}

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
  const [catalogQuery, setCatalogQuery] = useState("");
  const controller = useRef<ConnectionController | null>(null);
  const iframe = useRef<HTMLIFrameElement | null>(null);
  const owner = useRef<{ connectionId: string; windowId: string } | null>(null);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [signedOutNotice, setSignedOutNotice] = useState(false);
  const hasMountedNapplet = useRef(false);
  const registered = useRef<
    {
      source: Window;
      identity: VerifiedNappletIdentity;
    } | null
  >(null);
  const catalogCommands = useRef<CatalogCommandRegistry | null>(null);
  const catalogGeneration = useRef<
    { current: string | null; retired: Set<string> }
  >({ current: null, retired: new Set() });
  const catalogAccount = useRef<string | null>(null);
  const mountedAt = useRef(Date.now());
  const binaryRequests = useRef(new ActiveBinaryRequests(2));

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

  const publishIdentity = useMemo(() =>
    createVerifiedIdentityPublisher({
      source: () => iframe.current?.contentWindow ?? null,
      registered: () => registered.current,
      post: (message) =>
        iframe.current?.contentWindow?.postMessage(message, "*"),
    }), []);

  useEffect(() => {
    debug("shell mounted coordinate=%s", coordinate ? "configured" : "empty");
    const receive = (event: MessageEvent) => {
      const frame = iframe.current?.contentWindow;
      const registration = registered.current;
      const message = event.data as Record<string, unknown> | null;
      if (
        frame && event.source === frame && registration?.source === frame &&
        message && typeof message === "object" &&
        message.type === "resource.bytes" &&
        Object.keys(message).sort().join(",") === "id,type,url" &&
        typeof message.id === "string" && message.id.length > 0 &&
        message.id.length <= 128 && message.url === FIXED_RESOURCE_URL
      ) {
        const ws = controller.current?.socket;
        const currentOwner = owner.current;
        if (
          ws instanceof WebSocket && ws.readyState === WebSocket.OPEN &&
          currentOwner && binaryRequests.current.open(currentOwner, message.id)
        ) {
          const request = encodeBinaryFrame({
            kind: BinaryFrameKind.ResourceRequest,
            id: message.id,
            payload: new Uint8Array(),
          });
          ws.send(request.slice().buffer as ArrayBuffer);
        }
        return;
      }
      if (
        frame && event.source === frame && registration?.source === frame &&
        message && typeof message === "object" &&
        (message.type === "resource.info" || message.type === "upload.info")
      ) {
        const control = decodeNapControlMessage(message);
        const ws = controller.current?.socket;
        const currentOwner = owner.current;
        if (control && ws?.readyState === WebSocket.OPEN && currentOwner) {
          ws.send(JSON.stringify({
            type: "runtime.forward",
            ...currentOwner,
            message: control,
          }));
        }
        return;
      }
      if (
        frame && event.source === frame && registration?.source === frame &&
        message && typeof message === "object" &&
        typeof message.type === "string" &&
        /^(resource|upload)\./.test(message.type)
      ) {
        const control = decodeNapControlMessage(message);
        if (control?.type === "resource.bytes") {
          frame.postMessage({
            type: "resource.bytes.error",
            id: control.id,
            error: "blocked-by-policy",
            message: "Resource transfer is unavailable",
          }, "*");
        } else if (control?.type === "upload.upload") {
          frame.postMessage({
            type: "upload.upload.result",
            id: control.id,
            error: "Upload transfer is unavailable",
          }, "*");
        }
        return;
      }
      bridge.receive(event);
    };
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
        createSocket: (url) => {
          const socket = new WebSocket(url);
          socket.binaryType = "arraybuffer";
          socket.addEventListener("message", (event) => {
            if (!(event.data instanceof ArrayBuffer)) return;
            const currentOwner = owner.current;
            if (!currentOwner) return;
            const message = decodeResourceBinaryResult(
              new Uint8Array(event.data),
              currentOwner,
              binaryRequests.current,
            );
            if (message) {
              iframe.current?.contentWindow?.postMessage(message, "*");
            }
          });
          return socket;
        },
        onSocketTerminal: () => {
          catalogCommands.current?.clear();
          binaryRequests.current.clear();
        },
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
      catalogCommands.current = new CatalogCommandRegistry((message) =>
        controller.current?.send(message) ?? false
      );
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
        catalogCommands.current?.clear("catalog-command-cancelled");
        catalogCommands.current = null;
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
      const currentOwner = owner.current;
      if (
        !currentOwner || message.connectionId !== currentOwner.connectionId ||
        message.windowId !== currentOwner.windowId
      ) return;
      const eventMessage = message.message as Record<string, unknown>;
      if (eventMessage.type === "identity.changed") {
        const projected = eventMessage.identity as
          | Record<string, unknown>
          | undefined;
        const pubkey = typeof projected?.pubkey === "string"
          ? projected.pubkey
          : "";
        if (catalogAccount.current !== pubkey) {
          catalogAccount.current = pubkey;
          catalogGeneration.current = { current: null, retired: new Set() };
          setCatalog({ catalogEventId: null, entries: [] });
          setCatalogStatus("loading");
        }
        const source = iframe.current?.contentWindow;
        if (source) {
          publishIdentity(source, {
            type: "identity.changed",
            identity: { pubkey },
          });
        }
        setProfile(
          pubkey
            ? {
              pubkey,
              status: projected?.status === "offline" ? "offline" : "active",
            }
            : null,
        );
        return;
      }
      debug("post runtime event to iframe");
      iframe.current?.contentWindow?.postMessage(message.message, "*");
      return;
    }
    if (message.type === "runtime.catalog") {
      if (
        message.status === "loading" || message.status === "ready" ||
        message.status === "stale" || message.status === "error"
      ) setCatalogStatus(message.status);
      if (validCatalogProjection(message.catalog)) {
        const next = message.catalog;
        const generations = catalogGeneration.current;
        const nextId = next.catalogEventId;
        if (
          nextId === generations.current || !nextId ||
          !generations.retired.has(nextId)
        ) {
          if (generations.current && nextId !== generations.current) {
            generations.retired.add(generations.current);
          }
          generations.current = nextId;
          setCatalog(next);
        }
      }
      return;
    }
    if (
      message.type === "runtime.catalog.result" &&
      typeof message.id === "string"
    ) {
      catalogCommands.current?.receive(message);
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
    setAccountSheetOpen(false);
    setSignedOutNotice(true);
    setTimeout(() => setSignedOutNotice(false), 2_000);
  }

  async function openCatalogEntry(entry: CatalogViewEntry): Promise<void> {
    const catalogEventId = catalog.catalogEventId;
    if (!catalogEventId || entry.resolution !== "ready") return;
    const result = await catalogCommands.current?.request({
      type: "catalog.launch",
      catalogEventId,
      coordinate: entry.coordinate,
      manifestEventId: entry.acceptedManifestEventId,
    });
    if (!result?.ok || !result.value || typeof result.value !== "object") {
      setRuntimeError(
        result?.error === "catalog-command-capacity"
          ? "Please wait for a current action to finish, then try again."
          : "This napplet changed or is unavailable. Refreshing the catalog; try again.",
      );
      setCatalogStatus("stale");
      return;
    }
    const artifact = result.value as Record<string, unknown>;
    const launch = artifact.launch as Record<string, unknown> | undefined;
    if (
      !launch || typeof launch.dTag !== "string" ||
      typeof launch.aggregateHash !== "string" ||
      typeof launch.srcdoc !== "string"
    ) return;
    bridge.reset();
    setIdentity({ dTag: launch.dTag, aggregateHash: launch.aggregateHash });
    setSrcdoc(launch.srcdoc);
    navigate("napplet");
  }

  function closeCatalogDialog(): void {
    globalThis.dispatchEvent(new Event("catalog-dialog-close"));
  }

  function sendCatalogCommand(
    command: CatalogMutationCommand,
  ): Promise<CatalogCommandOutcome> {
    const registry = catalogCommands.current;
    if (!registry) {
      return Promise.resolve({
        ok: false,
        error: "catalog-command-disconnected",
      });
    }
    return registry.request(
      command.type === "catalog.preview"
        ? { type: "catalog.preview", naddr: command.naddr }
        : command.type === "catalog.approve"
        ? {
          type: "catalog.approve",
          coordinate: command.coordinate,
          manifestEventId: command.manifestEventId,
          sourceCatalogEventId: command.sourceCatalogEventId,
        }
        : {
          type: "catalog.uninstall",
          coordinate: command.coordinate,
        },
    );
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
            query={catalogQuery}
            onQueryChange={setCatalogQuery}
            onOpen={openCatalogEntry}
            onCommand={sendCatalogCommand}
          />
          <HomeHeader
            profile={profile}
            onOpenAccount={() => setAccountSheetOpen(true)}
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
            onSignOut={signOut}
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
            view === "napplet" ? "" : "shell-view-hidden"
          }`}
          inert={view !== "napplet"}
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
            hidden={view !== "napplet"}
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
        onAccount={() => setAccountSheetOpen(true)}
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
      <AccountSheet
        open={accountSheetOpen}
        profile={profile}
        backendConnected={connection.phase === "ready"}
        onClose={() => setAccountSheetOpen(false)}
        onSignOut={signOut}
        onOpenSettings={() => {
          setAccountSheetOpen(false);
          navigate("settings");
        }}
      />
      {signedOutNotice && (
        <p
          class="signout-toast"
          role="status"
          title="Public data will keep updating"
        >
          Signed out
        </p>
      )}
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
  onAccount,
}: {
  view: View;
  signedIn: boolean;
  connection: ConnectionSnapshot;
  onNavigate: (view: View) => void;
  onConnection: () => void;
  onAccount: () => void;
}) {
  return (
    <nav aria-label="Primary" class="bottom-nav">
      <button
        type="button"
        aria-current={signedIn && view === "home" ? "page" : undefined}
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
        aria-current={undefined}
        aria-label="Open account"
        onClick={onAccount}
      >
        <AccountIcon />
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

function AccountIcon() {
  return <UserIcon />;
}
