import { BehaviorSubject } from "npm:rxjs@7.8.2";
import { debug as rootDebug, shortId } from "../debug.ts";
import type { IdentitySnapshot, NostrConnectResult } from "./accounts.ts";

const debug = rootDebug.extend("signer");

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
    if (this.#attempt || this.state.status === "active") {
      debug(
        "start ignored status=%s attempt=%s",
        this.state.status,
        Boolean(this.#attempt),
      );
      return;
    }
    const attempt = {
      token: Symbol("signer-attempt"),
      controller: new AbortController(),
    };
    this.#attempt = attempt;
    debug("start timeoutMs=%d", this.#timeoutMs);
    this.state$.next(Object.freeze({ status: "preparing" }));
    const abort = AbortSignal.any([
      attempt.controller.signal,
      AbortSignal.timeout(this.#timeoutMs),
    ]);
    void this.#run(attempt.token, abort);
  }

  retry(): void {
    debug("retry requested status=%s", this.state.status);
    this.cancel();
    this.start();
  }

  cancel(): void {
    debug(
      "cancel status=%s attempt=%s",
      this.state.status,
      Boolean(this.#attempt),
    );
    this.#attempt?.controller.abort();
    this.#attempt = undefined;
    this.state$.next(IDLE);
  }

  async signOut(): Promise<void> {
    debug("signout requested status=%s", this.state.status);
    this.cancel();
    await this.#accounts.signOut?.();
    debug("signout complete");
  }

  async #run(token: symbol, abort: AbortSignal): Promise<void> {
    try {
      const pending = await this.#accounts.startNostrConnect(abort);
      if (this.#attempt?.token !== token) return;
      debug("awaiting remote signer approval");
      this.state$.next(Object.freeze({
        status: "awaiting",
        uri: pending.uri,
      }));
      const identity = await pending.connected;
      if (this.#attempt?.token !== token) return;
      this.#attempt = undefined;
      debug("remote signer active pubkey=%s", shortId(identity.pubkey));
      this.state$.next(Object.freeze({ status: "active", identity }));
    } catch {
      if (this.#attempt?.token !== token) return;
      this.#attempt = undefined;
      debug("remote signer failed or timed out");
      this.state$.next(Object.freeze({
        status: "error",
        message: "Remote signer connection failed or timed out",
      }));
    }
  }
}
