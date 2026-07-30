import { BehaviorSubject } from "npm:rxjs@7.8.2";
import type { IdentitySnapshot, NostrConnectResult } from "./accounts.ts";

export interface SignerAccountsPort {
  startNostrConnect(abort?: AbortSignal): Promise<NostrConnectResult>;
  signOut?(): Promise<void>;
}

export type SignerConnectionState =
  | { readonly status: "idle" }
  | { readonly status: "preparing" }
  | { readonly status: "awaiting"; readonly uri: string }
  | { readonly status: "active"; readonly identity: IdentitySnapshot }
  | { readonly status: "error"; readonly message: string };

const IDLE: SignerConnectionState = Object.freeze({ status: "idle" });

/**
 * Process-owned NIP-46 lifecycle. Browser connections only observe the safe
 * replayed state and dispatch commands; signer objects never cross this seam.
 */
export class SignerConnectionService {
  readonly state$ = new BehaviorSubject<SignerConnectionState>(IDLE);
  readonly #accounts: SignerAccountsPort;
  readonly #timeoutMs: number;
  #attempt:
    | { readonly token: symbol; readonly controller: AbortController }
    | undefined;

  constructor(
    accounts: SignerAccountsPort,
    options: { readonly timeoutMs?: number } = {},
  ) {
    this.#accounts = accounts;
    this.#timeoutMs = options.timeoutMs ?? 120_000;
  }

  get state(): SignerConnectionState {
    return this.state$.value;
  }

  start(): void {
    if (this.#attempt || this.state.status === "active") return;
    const attempt = {
      token: Symbol("signer-attempt"),
      controller: new AbortController(),
    };
    this.#attempt = attempt;
    this.state$.next(Object.freeze({ status: "preparing" }));
    const abort = AbortSignal.any([
      attempt.controller.signal,
      AbortSignal.timeout(this.#timeoutMs),
    ]);
    void this.#run(attempt.token, abort);
  }

  retry(): void {
    this.cancel();
    this.start();
  }

  cancel(): void {
    this.#attempt?.controller.abort();
    this.#attempt = undefined;
    this.state$.next(IDLE);
  }

  async signOut(): Promise<void> {
    this.cancel();
    await this.#accounts.signOut?.();
  }

  async #run(token: symbol, abort: AbortSignal): Promise<void> {
    try {
      const pending = await this.#accounts.startNostrConnect(abort);
      if (this.#attempt?.token !== token) return;
      this.state$.next(Object.freeze({
        status: "awaiting",
        uri: pending.uri,
      }));
      const identity = await pending.connected;
      if (this.#attempt?.token !== token) return;
      this.#attempt = undefined;
      this.state$.next(Object.freeze({ status: "active", identity }));
    } catch {
      if (this.#attempt?.token !== token) return;
      this.#attempt = undefined;
      this.state$.next(Object.freeze({
        status: "error",
        message: "Remote signer connection failed or timed out",
      }));
    }
  }
}
