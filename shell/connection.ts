export type ConnectionPhase =
  | "pending"
  | "connected"
  | "bootstrapping"
  | "ready"
  | "retrying"
  | "dormant"
  | "failed";

export interface ConnectionSnapshot {
  readonly phase: ConnectionPhase;
  readonly mode: "cold" | "reconnect";
  readonly failures: number;
  readonly canRetry: boolean;
  readonly nextRetryMs: number | null;
  readonly online: boolean;
}

export interface SocketLike extends EventTarget {
  readonly readyState: number;
  send(data: string | ArrayBuffer): void;
  close(code?: number, reason?: string): void;
}

export interface ConnectionControllerOptions {
  readonly coordinate: string;
  readonly socketBaseUrl: string;
  readonly createSocket: (url: string) => SocketLike;
  readonly setTimer?: (callback: () => void, delay: number) => number;
  readonly clearTimer?: (id: number) => void;
  readonly random?: () => number;
  readonly isVisible?: () => boolean;
  readonly isOnline?: () => boolean;
  readonly onSnapshot?: (snapshot: ConnectionSnapshot) => void;
  readonly onMessage?: (message: Record<string, unknown>) => void;
  readonly onSocketTerminal?: () => void;
  readonly connectTimeoutMs?: number;
}

const BASE_RETRY_MS = 500;
const MAX_RETRY_MS = 30_000;
const QUIET_RETRY_MS = 60_000;
const MANUAL_RETRY_FAILURES = 3;

export function computeRetryDelay(
  failure: number,
  random: () => number = Math.random,
): number {
  const window = Math.min(
    MAX_RETRY_MS,
    BASE_RETRY_MS * 2 ** Math.max(0, failure - 1),
  );
  return Math.floor(window * Math.max(0, Math.min(1, random())));
}

export class ConnectionController {
  readonly #options:
    & Required<
      Pick<
        ConnectionControllerOptions,
        | "setTimer"
        | "clearTimer"
        | "random"
        | "isVisible"
        | "isOnline"
        | "onSnapshot"
        | "onMessage"
        | "onSocketTerminal"
        | "connectTimeoutMs"
      >
    >
    & ConnectionControllerOptions;
  #snapshot: ConnectionSnapshot;
  #socket: SocketLike | null = null;
  #timer: number | null = null;
  #generation = 0;
  #token: string | null = null;
  #started = false;
  #stopped = false;
  #attemptTerminal = false;
  #runtimeStarted = false;

  constructor(options: ConnectionControllerOptions) {
    this.#options = {
      ...options,
      setTimer: options.setTimer ??
        ((callback, delay) => setTimeout(callback, delay)),
      clearTimer: options.clearTimer ?? ((id) => clearTimeout(id)),
      random: options.random ?? Math.random,
      isVisible: options.isVisible ??
        (() => document.visibilityState === "visible"),
      isOnline: options.isOnline ?? (() => navigator.onLine),
      onSnapshot: options.onSnapshot ?? (() => {}),
      onMessage: options.onMessage ?? (() => {}),
      onSocketTerminal: options.onSocketTerminal ?? (() => {}),
      connectTimeoutMs: options.connectTimeoutMs ?? 10_000,
    };
    this.#snapshot = {
      phase: "pending",
      mode: "cold",
      failures: 0,
      canRetry: false,
      nextRetryMs: null,
      online: this.#options.isOnline(),
    };
  }

  get snapshot(): ConnectionSnapshot {
    return this.#snapshot;
  }

  get socket(): SocketLike | null {
    return this.#socket;
  }

  start(): void {
    if (this.#started || this.#stopped || !this.#options.coordinate) return;
    this.#started = true;
    this.requestConnect("start");
  }

  requestConnect(_reason: string): void {
    if (this.#stopped || !this.#started || !this.#eligible()) return;
    if (this.#socket && this.#socket.readyState < 2 && !this.#attemptTerminal) {
      return;
    }
    this.#clearTimer();
    const previous = this.#socket;
    this.#generation++;
    const generation = this.#generation;
    this.#attemptTerminal = false;
    this.#runtimeStarted = false;
    this.#socket = null;
    if (previous) this.#options.onSocketTerminal();
    previous?.close(1000, "superseded");
    const reconnect = this.#token !== null || this.#snapshot.failures > 0;
    this.#emit({
      phase: reconnect ? "retrying" : "pending",
      mode: reconnect ? "reconnect" : "cold",
      nextRetryMs: null,
    });
    const token = this.#token
      ? `?reconnect=${encodeURIComponent(this.#token)}`
      : "";
    const socket = this.#options.createSocket(
      `${this.#options.socketBaseUrl}${token}`,
    );
    this.#socket = socket;
    this.#timer = this.#options.setTimer(() => {
      if (!this.#current(socket, generation) || socket.readyState === 1) return;
      this.#terminateAttempt(socket, generation);
    }, this.#options.connectTimeoutMs);
    socket.addEventListener("open", () => {
      if (!this.#current(socket, generation)) return;
      this.#clearTimer();
    });
    socket.addEventListener("message", (event) => {
      if (!this.#current(socket, generation)) return;
      this.#receive(socket, (event as MessageEvent).data);
    });
    socket.addEventListener(
      "error",
      () => this.#terminateAttempt(socket, generation),
    );
    socket.addEventListener(
      "close",
      () => this.#terminateAttempt(socket, generation),
    );
  }

  retryNow(): void {
    if (this.#stopped || !this.#started || !this.#eligible()) return;
    this.#attemptTerminal = true;
    this.requestConnect("manual");
  }

  visibilityChanged(): void {
    this.#lifecycleChanged();
  }

  onlineChanged(): void {
    this.#lifecycleChanged();
  }

  send(message: Record<string, unknown>): boolean {
    if (
      !this.#socket || this.#socket.readyState !== 1 || this.#attemptTerminal
    ) {
      return false;
    }
    this.#socket.send(JSON.stringify(message));
    return true;
  }

  stop(): void {
    if (this.#stopped) return;
    this.#stopped = true;
    this.#generation++;
    this.#clearTimer();
    const socket = this.#socket;
    this.#socket = null;
    this.#attemptTerminal = true;
    this.#options.onSocketTerminal();
    socket?.close(1000, "shell unmounted");
  }

  #receive(socket: SocketLike, raw: unknown): void {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(String(raw)) as Record<string, unknown>;
    } catch {
      return;
    }
    if (
      message.type === "runtime.connected" &&
      typeof message.connectionId === "string" &&
      typeof message.windowId === "string" &&
      typeof message.reconnectToken === "string" && !this.#runtimeStarted
    ) {
      this.#runtimeStarted = true;
      this.#token = message.reconnectToken;
      this.#emit({ phase: "connected", nextRetryMs: null });
      socket.send(JSON.stringify({
        type: "runtime.start",
        coordinate: this.#options.coordinate,
      }));
      this.#emit({ phase: "bootstrapping" });
    } else if (
      message.type === "runtime.artifact" &&
      typeof message.srcdoc === "string" &&
      message.identity && typeof message.identity === "object" &&
      typeof (message.identity as Record<string, unknown>).dTag === "string" &&
      typeof (message.identity as Record<string, unknown>).aggregateHash ===
        "string"
    ) {
      this.#emit({
        phase: "ready",
        failures: 0,
        canRetry: false,
        nextRetryMs: null,
      });
    }
    this.#options.onMessage(message);
  }

  #terminateAttempt(socket: SocketLike, generation: number): void {
    if (!this.#current(socket, generation) || this.#attemptTerminal) return;
    this.#attemptTerminal = true;
    this.#clearTimer();
    this.#socket = null;
    this.#options.onSocketTerminal();
    socket.close();
    const failures = this.#snapshot.failures + 1;
    const canRetry = failures >= MANUAL_RETRY_FAILURES;
    if (!this.#eligible()) {
      this.#emit({
        phase: "dormant",
        mode: "reconnect",
        failures,
        canRetry,
        nextRetryMs: null,
        online: this.#options.isOnline(),
      });
      return;
    }
    const delay = canRetry
      ? QUIET_RETRY_MS
      : computeRetryDelay(failures, this.#options.random);
    this.#emit({
      phase: canRetry ? "failed" : "retrying",
      mode: "reconnect",
      failures,
      canRetry,
      nextRetryMs: delay,
      online: true,
    });
    this.#timer = this.#options.setTimer(() => {
      this.#timer = null;
      this.requestConnect("timer");
    }, delay);
  }

  #lifecycleChanged(): void {
    if (this.#stopped || !this.#started) return;
    if (!this.#eligible()) {
      this.#clearTimer();
      if (this.#snapshot.phase !== "ready") {
        this.#emit({
          phase: "dormant",
          mode: this.#token ? "reconnect" : this.#snapshot.mode,
          nextRetryMs: null,
          online: this.#options.isOnline(),
        });
      }
      return;
    }
    this.#emit({ online: true });
    if (!this.#socket || this.#attemptTerminal) {
      this.requestConnect("lifecycle");
    }
  }

  #eligible(): boolean {
    return this.#options.isVisible() && this.#options.isOnline();
  }

  #current(socket: SocketLike, generation: number): boolean {
    return !this.#stopped && this.#generation === generation &&
      this.#socket === socket;
  }

  #clearTimer(): void {
    if (this.#timer === null) return;
    this.#options.clearTimer(this.#timer);
    this.#timer = null;
  }

  #emit(update: Partial<ConnectionSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...update };
    this.#options.onSnapshot(this.#snapshot);
  }
}
