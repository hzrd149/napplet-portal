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
  encodeUploadPayload,
  FIXED_RESOURCE_URL,
} from "../runtime/binary_transport.ts";
import {
  decodeNapControlMessage,
  type IntentNavigationMessage,
  isReservedIntentLaunchPath,
} from "../runtime/transport.ts";

const debug = rootDebug.extend("shell");

interface NappletShellProps {
  readonly coordinate: string;
}

export interface IntentSurface {
  readonly surfaceId: string;
  readonly account: string;
  readonly identity: VerifiedNappletIdentity;
  readonly srcdoc: string;
  readonly owner: { readonly connectionId: string; readonly windowId: string };
}

interface SurfaceStackOptions {
  readonly pushHistory?: (state: { readonly surfaceId: string }) => void;
  readonly settleClosed?: (surfaceId: string) => void;
  readonly changed?: (surfaces: readonly IntentSurface[]) => void;
}

export class SurfaceStackController {
  #surfaces: IntentSurface[] = [];
  readonly #closed = new Set<string>();

  constructor(readonly options: SurfaceStackOptions = {}) {}

  get surfaces(): readonly IntentSurface[] {
    return this.#surfaces;
  }

  get active(): IntentSurface | null {
    return this.#surfaces.at(-1) ?? null;
  }

  replaceRoot(surface: IntentSurface): void {
    this.#surfaces = [surface];
    this.#emit();
  }

  push(surface: IntentSurface): boolean {
    if (
      this.#surfaces.some((candidate) =>
        candidate.surfaceId === surface.surfaceId
      )
    ) {
      return false;
    }
    this.#surfaces = [...this.#surfaces, surface];
    this.options.pushHistory?.({ surfaceId: surface.surfaceId });
    this.#emit();
    return true;
  }

  pop(surfaceId: string): boolean {
    const index = this.#surfaces.findIndex((surface) =>
      surface.surfaceId === surfaceId
    );
    if (index < 0 || index === this.#surfaces.length - 1) return false;
    for (const surface of this.#surfaces.slice(index + 1)) {
      this.#settle(surface.surfaceId);
    }
    this.#surfaces = this.#surfaces.slice(0, index + 1);
    this.#emit();
    return true;
  }

  close(surfaceId: string): boolean {
    const index = this.#surfaces.findIndex((surface) =>
      surface.surfaceId === surfaceId
    );
    if (index <= 0) return false;
    this.#surfaces = this.#surfaces.filter((surface) =>
      surface.surfaceId !== surfaceId
    );
    this.#settle(surfaceId);
    this.#emit();
    return true;
  }

  focusReusable(
    account: string,
    identity: VerifiedNappletIdentity,
  ): IntentSurface | null {
    const match =
      this.#surfaces.find((surface) =>
        surface.account === account &&
        surface.identity.dTag === identity.dTag &&
        surface.identity.aggregateHash === identity.aggregateHash
      ) ?? null;
    if (!match) return null;
    const index = this.#surfaces.indexOf(match);
    this.#surfaces = [
      ...this.#surfaces.slice(0, index),
      ...this.#surfaces.slice(index + 1),
      match,
    ];
    this.#emit();
    return match;
  }

  #settle(surfaceId: string): void {
    if (this.#closed.has(surfaceId)) return;
    this.#closed.add(surfaceId);
    this.options.settleClosed?.(surfaceId);
  }

  #emit(): void {
    this.options.changed?.(this.#surfaces);
  }
}

interface PopupReservationOptions {
  readonly open: (
    path: string,
    name: string,
    features?: string,
  ) => Window | null;
  readonly send: (message: Record<string, unknown>) => void;
  readonly setTimer?: typeof setTimeout;
  readonly clearTimer?: typeof clearTimeout;
  readonly timeoutMs?: number;
}

interface PopupReservation {
  readonly source: Window;
  readonly invocationId: string;
  readonly handle: Window;
  readonly timeout: number;
}

export class PopupReservationController {
  readonly #pending = new Map<string, PopupReservation>();
  readonly #terminal = new Set<string>();
  readonly #setTimer: typeof setTimeout;
  readonly #clearTimer: typeof clearTimeout;

  constructor(readonly options: PopupReservationOptions) {
    this.#setTimer = options.setTimer ?? setTimeout;
    this.#clearTimer = options.clearTimer ?? clearTimeout;
  }

  reserve(source: Window, input: {
    readonly invocationId: string;
    readonly callerWindowId: string;
    readonly owner: {
      readonly connectionId: string;
      readonly windowId: string;
    };
  }): string | null {
    const reservationId = crypto.randomUUID();
    const reserveMessage = {
      type: "intent.navigation.reserve",
      reservationId,
      invocationId: input.invocationId,
      callerWindowId: input.callerWindowId,
      mode: "new-tab",
    } as const;
    const handle = this.options.open(
      `/intent/reserved#${reservationId}`,
      `_napplet_intent_${reservationId}`,
    );
    if (!handle) {
      this.options.send(reserveMessage);
      this.#ack(reservationId, input.invocationId, "blocked");
      return null;
    }
    const timeout = this.#setTimer(
      () => this.fail(reservationId, "failed"),
      this.options.timeoutMs ?? 15_000,
    );
    this.#pending.set(reservationId, {
      source,
      invocationId: input.invocationId,
      handle,
      timeout,
    });
    this.options.send(reserveMessage);
    return reservationId;
  }

  authorize(
    source: Window,
    message: Extract<IntentNavigationMessage, {
      type: "intent.navigation.authorized";
    }>,
  ): boolean {
    const pending = this.#pending.get(message.reservationId);
    if (
      !pending || pending.source !== source ||
      pending.invocationId !== message.invocationId || pending.handle.closed
    ) {
      if (pending) this.fail(message.reservationId, "closed");
      return false;
    }
    if (!isReservedIntentLaunchPath(message.launchPath)) {
      return this.fail(message.reservationId, "failed");
    }
    pending.handle.location.replace(message.launchPath);
    return this.#finish(message.reservationId, "committed", false);
  }

  fail(reservationId: string, state: "blocked" | "closed" | "failed"): boolean {
    return this.#finish(reservationId, state, true);
  }

  clear(state: "closed" | "failed" = "failed"): void {
    for (const reservationId of [...this.#pending.keys()]) {
      this.#finish(reservationId, state, true);
    }
  }

  #finish(
    reservationId: string,
    state: "committed" | "blocked" | "closed" | "failed",
    close: boolean,
  ): boolean {
    const pending = this.#pending.get(reservationId);
    if (!pending || this.#terminal.has(reservationId)) return false;
    this.#pending.delete(reservationId);
    this.#clearTimer(pending.timeout);
    if (close && !pending.handle.closed) pending.handle.close();
    this.#ack(reservationId, pending.invocationId, state);
    return true;
  }

  #ack(
    reservationId: string,
    invocationId: string,
    state: "committed" | "blocked" | "closed" | "failed",
  ): void {
    if (this.#terminal.has(reservationId)) return;
    this.#terminal.add(reservationId);
    this.options.send({
      type: "intent.navigation.ack",
      reservationId,
      invocationId,
      state,
    });
  }
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

type PendingResourceResult = {
  readonly message: Record<string, unknown>;
  readonly expected: readonly {
    id: string;
    mime: string;
    itemIndex?: number;
  }[];
  readonly payloads: Map<string, Uint8Array>;
};

export class ResourceBinaryAssembler {
  readonly #pending = new Map<string, PendingResourceResult>();

  acceptMetadata(message: Record<string, unknown>): boolean {
    if (typeof message.id !== "string") return false;
    if (
      message.type === "resource.bytes.result" &&
      typeof message.mime === "string"
    ) {
      this.#pending.set(message.id, {
        message,
        expected: [{ id: message.id, mime: message.mime }],
        payloads: new Map(),
      });
      return true;
    }
    if (
      message.type !== "resource.bytesMany.result" ||
      !Array.isArray(message.items)
    ) return false;
    const expected = message.items.flatMap((item, itemIndex) => {
      if (!item || typeof item !== "object") return [];
      const value = item as Record<string, unknown>;
      return value.ok === true && typeof value.mime === "string" &&
          typeof value.binaryIndex === "number"
        ? [{
          id: `${message.id}:${value.binaryIndex}`,
          mime: value.mime,
          itemIndex,
        }]
        : [];
    });
    if (expected.length === 0) return false;
    this.#pending.set(message.id, { message, expected, payloads: new Map() });
    return true;
  }

  acceptBinary(
    bytes: Uint8Array,
    owner: { readonly connectionId: string; readonly windowId: string },
  ): Record<string, unknown> | null {
    const decoded = decodeBinaryFrames(bytes, owner);
    if (!decoded.ok || decoded.frames.length !== 1) return null;
    const frame = decoded.frames[0];
    if (frame.kind !== BinaryFrameKind.ResourceResult) return null;
    const pending = [...this.#pending.values()].find((entry) =>
      entry.expected.some(({ id }) => id === frame.id)
    );
    if (!pending || pending.payloads.has(frame.id)) return null;
    pending.payloads.set(frame.id, frame.payload);
    if (pending.payloads.size !== pending.expected.length) return null;
    this.#pending.delete(String(pending.message.id));
    if (pending.message.type === "resource.bytes.result") {
      const expected = pending.expected[0];
      return {
        ...pending.message,
        blob: new Blob([pending.payloads.get(expected.id)!.slice().buffer], {
          type: expected.mime,
        }),
      };
    }
    const items = (pending.message.items as Record<string, unknown>[]).map((
      item,
    ) => ({ ...item }));
    for (const expected of pending.expected) {
      const item = items[expected.itemIndex!] as Record<string, unknown>;
      delete item.binaryIndex;
      item.blob = new Blob(
        [pending.payloads.get(expected.id)!.slice().buffer],
        { type: expected.mime },
      );
    }
    return { ...pending.message, items };
  }

  clear(): void {
    this.#pending.clear();
  }
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
  const [surfaces, setSurfaces] = useState<readonly IntentSurface[]>([]);
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
  const resourceAssembler = useRef(new ResourceBinaryAssembler());
  const popupReservations = useRef<PopupReservationController | null>(null);
  const surfaceStack = useRef<SurfaceStackController | null>(null);
  if (!surfaceStack.current) {
    surfaceStack.current = new SurfaceStackController({
      pushHistory: (state) => history.pushState(state, "", location.href),
      changed: setSurfaces,
    });
  }
  if (!popupReservations.current) {
    popupReservations.current = new PopupReservationController({
      open: (path, name, features) => globalThis.open(path, name, features),
      send: (message) => {
        const ws = controller.current?.socket;
        const currentOwner = owner.current;
        if (ws?.readyState !== WebSocket.OPEN || !currentOwner) return;
        ws.send(JSON.stringify({
          type: "runtime.forward",
          ...currentOwner,
          message,
        }));
      },
    });
  }

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
        frame && event.source === frame && event.origin === "null" &&
        registration?.source === frame && message?.type === "intent.invoke" &&
        typeof message.id === "string"
      ) {
        const request = message.request as Record<string, unknown> | undefined;
        const behavior = request?.behavior as
          | Record<string, unknown>
          | undefined;
        const currentOwner = owner.current;
        if (behavior?.newWindow === true && currentOwner) {
          popupReservations.current?.reserve(frame, {
            invocationId: message.id,
            callerWindowId: currentOwner.windowId,
            owner: currentOwner,
          });
        }
      }
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
        typeof message.type === "string" &&
        /^(resource|upload)\./.test(message.type)
      ) {
        const control = decodeNapControlMessage(message);
        const ws = controller.current?.socket;
        const currentOwner = owner.current;
        if (!control || ws?.readyState !== WebSocket.OPEN || !currentOwner) {
          return;
        }
        if (control.type === "upload.upload") {
          const data = control.request.data;
          void (data instanceof Blob
            ? data.arrayBuffer()
            : Promise.resolve(data))
            .then((buffer) => {
              if (ws.readyState !== WebSocket.OPEN) return;
              ws.send(
                encodeBinaryFrame({
                  kind: BinaryFrameKind.UploadRequest,
                  id: control.id,
                  payload: encodeUploadPayload(
                    Object.fromEntries(
                      Object.entries(control.request).filter(([key]) =>
                        key !== "data"
                      ),
                    ),
                    new Uint8Array(buffer),
                  ),
                }).slice().buffer as ArrayBuffer,
              );
            });
        } else {
          ws.send(JSON.stringify({
            type: "runtime.forward",
            ...currentOwner,
            message: control,
          }));
        }
        return;
      }
      bridge.receive(event);
    };
    globalThis.addEventListener("message", receive);
    const back = (event: PopStateEvent) => {
      closeCatalogDialog();
      const surfaceId = (event.state as { surfaceId?: string } | null)
        ?.surfaceId;
      if (surfaceId && surfaceStack.current?.pop(surfaceId)) {
        setView("napplet");
        return;
      }
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
            const incoming = new Uint8Array(event.data);
            const message =
              resourceAssembler.current.acceptBinary(incoming, currentOwner) ??
                decodeResourceBinaryResult(
                  incoming,
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
          resourceAssembler.current.clear();
          popupReservations.current?.clear("failed");
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
        popupReservations.current?.clear("closed");
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
      if (eventMessage.type === "intent.navigation.authorized") {
        const decoded = eventMessage as Extract<IntentNavigationMessage, {
          type: "intent.navigation.authorized";
        }>;
        const source = iframe.current?.contentWindow;
        if (source) popupReservations.current?.authorize(source, decoded);
        return;
      }
      if (resourceAssembler.current.acceptMetadata(eventMessage)) return;
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
    const nextAccount = typeof account?.pubkey === "string"
      ? account.pubkey
      : "";
    const currentOwner = owner.current;
    if (currentOwner) {
      surfaceStack.current?.replaceRoot({
        surfaceId: crypto.randomUUID(),
        account: nextAccount,
        identity: {
          dTag: nextIdentity.dTag,
          aggregateHash: nextIdentity.aggregateHash,
        },
        srcdoc: message.srcdoc,
        owner: currentOwner,
      });
    }
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
    if (Array.isArray(artifact.capabilities)) {
      bridge.grantDomains(
        artifact.capabilities.filter((value): value is string =>
          typeof value === "string"
        ),
      );
    }
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
          {(surfaces.length > 0
            ? surfaces
            : identity && srcdoc && owner.current
            ? [{
              surfaceId: "root",
              account: profile?.pubkey ?? "",
              identity,
              srcdoc,
              owner: owner.current,
            }]
            : []).map((surface, index, all) => (
              <div key={surface.surfaceId} class="napplet-surface">
                {index === all.length - 1 && all.length > 1 && (
                  <nav
                    aria-label="Napplet stack"
                    class="napplet-stack-controls"
                  >
                    <button
                      type="button"
                      onClick={() => history.back()}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        surfaceStack.current?.close(surface.surfaceId)}
                    >
                      Close
                    </button>
                  </nav>
                )}
                <NappletFrame
                  srcdoc={surface.srcdoc}
                  identity={surface.identity}
                  title={`Napplet ${surface.identity.dTag}`}
                  hidden={view !== "napplet" || index !== all.length - 1}
                  registry={registry}
                  onFrame={(frame) => {
                    if (index === 0) {
                      iframe.current = frame;
                    }
                  }}
                />
              </div>
            ))}
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
