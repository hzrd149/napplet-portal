import { BehaviorSubject } from "npm:rxjs@7.8.2";
import { debug as rootDebug, shortId } from "../debug.ts";
import type { IdentitySnapshot, NostrConnectResult } from "./accounts.ts";

const debug = rootDebug.extend("signer");

export interface SignerAccountsPort {
  identity$: BehaviorSubject<IdentitySnapshot>;
  restore?(): Promise<IdentitySnapshot>;
  startNostrConnect(abort?: AbortSignal): Promise<NostrConnectResult>;
  signInBunker?(uri: string): Promise<IdentitySnapshot>;
  signInNsec?(privateKey: string): Promise<IdentitySnapshot>;
  signOut?(): Promise<void>;
}

export type SignerConnectionState =
  | { readonly status: "idle" }
  | { readonly status: "preparing" }
  | { readonly status: "awaiting"; readonly uri: string }
  | { readonly status: "active"; readonly identity: IdentitySnapshot }
  | { readonly status: "error"; readonly message: string };

const IDLE = Object.freeze({ status: "idle" } as const);

type PendingState =
  | typeof IDLE
  | { readonly status: "preparing" }
  | { readonly status: "awaiting"; readonly uri: string }
  | { readonly status: "error"; readonly message: string };

/**
 * Process-owned NIP-46 lifecycle. Browser connections only observe the safe
 * replayed state and dispatch commands; signer objects never cross this seam.
 */
export class SignerConnectionService {
  readonly state$ = new BehaviorSubject<SignerConnectionState>(IDLE);
  readonly #accounts: SignerAccountsPort;
  readonly #timeoutMs: number;
  #pending: PendingState = IDLE;
  #attempt:
    | { readonly token: symbol; readonly controller: AbortController }
    | undefined;
  #restore: Promise<IdentitySnapshot | null> | undefined;

  constructor(
    accounts: SignerAccountsPort,
    options: { readonly timeoutMs?: number } = {},
  ) {
    this.#accounts = accounts;
    this.#timeoutMs = options.timeoutMs ?? 120_000;
    this.#accounts.identity$.subscribe((identity) => this.#project(identity));
  }

  get state(): SignerConnectionState {
    return this.state$.value;
  }

  async restore(): Promise<IdentitySnapshot | null> {
    this.#restore ??= this.#restoreAccountState().catch((error) => {
      this.#restore = undefined;
      throw error;
    });
    return await this.#restore;
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
    this.#setPending(Object.freeze({ status: "preparing" }));
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

  async signInBunker(uri: string): Promise<IdentitySnapshot> {
    if (!this.#accounts.signInBunker) {
      throw new Error("Bunker sign-in unavailable");
    }
    this.cancel();
    try {
      const identity = await this.#accounts.signInBunker(uri);
      this.#setPending(IDLE);
      return identity;
    } catch (error) {
      const failure = new Error("Bunker sign-in failed", { cause: error });
      this.#setPending(Object.freeze({
        status: "error",
        message: failure.message,
      }));
      throw failure;
    }
  }

  async signInNsec(privateKey: string): Promise<IdentitySnapshot> {
    if (!this.#accounts.signInNsec) {
      throw new Error("nsec sign-in unavailable");
    }
    this.cancel();
    try {
      const identity = await this.#accounts.signInNsec(privateKey);
      this.#setPending(IDLE);
      return identity;
    } catch (error) {
      const failure = new Error("nsec sign-in failed", { cause: error });
      this.#setPending(Object.freeze({
        status: "error",
        message: failure.message,
      }));
      throw failure;
    }
  }

  cancel(): void {
    debug(
      "cancel status=%s attempt=%s",
      this.state.status,
      Boolean(this.#attempt),
    );
    this.#attempt?.controller.abort();
    this.#attempt = undefined;
    this.#setPending(IDLE);
  }

  async signOut(): Promise<void> {
    debug("signout requested status=%s", this.state.status);
    this.cancel();
    await this.#accounts.signOut?.();
    this.#restore = undefined;
    debug("signout complete");
  }

  async #run(token: symbol, abort: AbortSignal): Promise<void> {
    try {
      const pending = await this.#accounts.startNostrConnect(abort);
      if (this.#attempt?.token !== token) return;
      debug("awaiting remote signer approval");
      this.#setPending(Object.freeze({
        status: "awaiting",
        uri: pending.uri,
      }));
      const identity = await pending.connected;
      if (this.#attempt?.token !== token) return;
      this.#attempt = undefined;
      debug("remote signer active pubkey=%s", shortId(identity.pubkey));
      this.#setPending(IDLE);
    } catch {
      if (this.#attempt?.token !== token) return;
      this.#attempt = undefined;
      debug("remote signer failed or timed out");
      this.#setPending(Object.freeze({
        status: "error",
        message: "Remote signer connection failed or timed out",
      }));
    }
  }

  async #restoreAccountState(): Promise<IdentitySnapshot | null> {
    const identity = await this.#accounts.restore?.();
    if (identity?.pubkey && identity.status !== "unavailable") {
      debug(
        "restored signer state status=%s pubkey=%s",
        identity.status,
        shortId(identity.pubkey),
      );
    }
    this.#project(identity ?? this.#accounts.identity$.value);
    return identity ?? null;
  }

  #setPending(state: PendingState): void {
    this.#pending = state;
    this.#project(this.#accounts.identity$.value);
  }

  #project(identity: IdentitySnapshot): void {
    if (this.#pending.status !== "idle") {
      this.state$.next(this.#pending);
      return;
    }
    if (identity.pubkey && identity.status === "active") {
      this.state$.next(Object.freeze({ status: "active", identity }));
      return;
    }
    this.state$.next(IDLE);
  }
}
