import {
  AccountManager,
  Accounts,
  type IAccount,
  type SerializedAccount,
} from "applesauce-accounts";
import {
  NostrConnectSigner,
  type NostrPublishMethod,
  type NostrSubscriptionMethod,
} from "applesauce-signers";
import type { EventTemplate, NostrEvent } from "@napplet/core";
import { BehaviorSubject } from "npm:rxjs@7.8.2";
import { type AccountSnapshot, AccountStore } from "./account_store.ts";

export type IdentityStatus = "active" | "offline" | "unavailable";

export interface IdentitySnapshot {
  readonly accountId: string | null;
  readonly pubkey: string | null;
  readonly status: IdentityStatus;
}

export interface PendingNostrConnect {
  readonly uri: string;
  readonly connected: Promise<IAccount>;
}

export interface PortalAccountFactories {
  readonly relays: readonly string[];
  readonly subscriptionMethod: NostrSubscriptionMethod;
  readonly publishMethod: NostrPublishMethod;
  readonly createNostrConnect?: () =>
    | PendingNostrConnect
    | Promise<PendingNostrConnect>;
  readonly connectBunker?: (uri: string) => Promise<IAccount>;
  readonly reconnectNostrConnect?: (account: IAccount) => Promise<void>;
}

export interface NostrConnectResult {
  readonly uri: string;
  readonly connected: Promise<IdentitySnapshot>;
}

const UNAVAILABLE: IdentitySnapshot = Object.freeze({
  accountId: null,
  pubkey: null,
  status: "unavailable",
});

function publicIdentity(
  account: IAccount,
  status: Exclude<IdentityStatus, "unavailable">,
): IdentitySnapshot {
  return Object.freeze({
    accountId: account.id,
    pubkey: account.pubkey,
    status,
  });
}

/**
 * Process-wide account authority. Serialized records are sensitive host-only
 * material; consumers observe only `IdentitySnapshot`.
 *
 * Read-only account mode (AUTH-05) is explicitly deferred. Public relay/outbox
 * reads are independent of signer availability and remain enabled on sign-out.
 */
export class PortalAccounts {
  readonly #store: AccountStore;
  readonly #factories: PortalAccountFactories;
  readonly #manager = new AccountManager();
  readonly identity$ = new BehaviorSubject<IdentitySnapshot>(UNAVAILABLE);
  readonly publicReadsEnabled = true;

  constructor(store: AccountStore, factories: PortalAccountFactories) {
    this.#store = store;
    this.#factories = factories;
    NostrConnectSigner.subscriptionMethod = factories.subscriptionMethod;
    NostrConnectSigner.publishMethod = factories.publishMethod;
    this.#manager.registerType(Accounts.NostrConnectAccount);
    this.#manager.registerType(Accounts.PrivateKeyAccount);
  }

  get identity(): IdentitySnapshot {
    return this.identity$.value;
  }

  get accountCount(): number {
    return this.#manager.accounts.length;
  }

  async restore(): Promise<IdentitySnapshot> {
    const snapshot = await this.#store.read();
    if (!snapshot) return this.identity;
    this.#manager.fromJSON(snapshot.accounts as SerializedAccount[]);
    if (!snapshot.activeAccountId) return this.identity;
    const account = this.#manager.getAccount(snapshot.activeAccountId);
    if (!account) throw new Error("Active account record is unavailable");
    this.#manager.setActive(account);
    const status = account.type === Accounts.NostrConnectAccount.type
      ? "offline"
      : "active";
    const identity = publicIdentity(account, status);
    this.identity$.next(identity);
    return identity;
  }

  async startNostrConnect(): Promise<NostrConnectResult> {
    const pending = await (this.#factories.createNostrConnect?.() ??
      this.#createNostrConnect());
    return {
      uri: pending.uri,
      connected: pending.connected.then((account) => this.#activate(account)),
    };
  }

  async signInBunker(uri: string): Promise<IdentitySnapshot> {
    if (!uri.startsWith("bunker://")) throw new Error("Invalid bunker URI");
    const account = await (this.#factories.connectBunker?.(uri) ??
      this.#connectBunker(uri));
    return await this.#activate(account);
  }

  async signInNsec(privateKey: string): Promise<IdentitySnapshot> {
    const account = Accounts.PrivateKeyAccount.fromKey(privateKey);
    return await this.#activate(account);
  }

  async retryOffline(): Promise<IdentitySnapshot> {
    const account = this.#manager.active;
    if (!account || account.type !== Accounts.NostrConnectAccount.type) {
      return this.identity;
    }
    try {
      await (this.#factories.reconnectNostrConnect?.(account) ??
        this.#reconnectNostrConnect(account));
      const identity = publicIdentity(account, "active");
      this.identity$.next(identity);
      return identity;
    } catch {
      const identity = publicIdentity(account, "offline");
      this.identity$.next(identity);
      return identity;
    }
  }

  async signOut(): Promise<void> {
    this.#manager.clearActive();
    this.identity$.next(UNAVAILABLE);
    await this.#persist();
  }

  async signEvent(template: EventTemplate): Promise<NostrEvent> {
    const account = this.#manager.active;
    if (!account || this.identity.status !== "active") {
      throw new Error("Signer unavailable");
    }
    return await account.signEvent(template);
  }

  async #activate(account: IAccount): Promise<IdentitySnapshot> {
    this.#manager.addAccount(account);
    this.#manager.setActive(account);
    const identity = publicIdentity(account, "active");
    this.identity$.next(identity);
    await this.#persist();
    return identity;
  }

  async #persist(): Promise<void> {
    const snapshot: AccountSnapshot = {
      version: 1,
      activeAccountId: this.#manager.active?.id ?? null,
      accounts: this.#manager.toJSON() as Record<string, unknown>[],
    };
    await this.#store.write(snapshot);
  }

  async #createNostrConnect(): Promise<PendingNostrConnect> {
    const signer = new NostrConnectSigner({
      relays: [...this.#factories.relays],
      subscriptionMethod: this.#factories.subscriptionMethod,
      publishMethod: this.#factories.publishMethod,
    });
    await signer.open();
    const uri = signer.getNostrConnectURI({
      name: "Napplet Portal",
      url: "http://127.0.0.1",
    });
    return {
      uri,
      connected: signer.waitForSigner().then(async () => {
        const pubkey = await signer.getPublicKey();
        return new Accounts.NostrConnectAccount(pubkey, signer);
      }),
    };
  }

  async #connectBunker(uri: string): Promise<IAccount> {
    const signer = await NostrConnectSigner.fromBunkerURI(uri, {
      subscriptionMethod: this.#factories.subscriptionMethod,
      publishMethod: this.#factories.publishMethod,
    });
    const pubkey = await signer.getPublicKey();
    return new Accounts.NostrConnectAccount(pubkey, signer);
  }

  async #reconnectNostrConnect(account: IAccount): Promise<void> {
    const signer = account.signer as NostrConnectSigner;
    await signer.open();
    await signer.requireConnection();
  }
}

/** Minimal tracer compatibility wrapper retained for Plan 01 consumers. */
export interface PublicAccount {
  readonly pubkey: string;
  readonly status: "active";
}

export class AccountRuntime {
  #active: PublicAccount | null = null;

  signIn(pubkey: string): PublicAccount {
    if (!/^[0-9a-f]{64}$/i.test(pubkey)) throw new Error("invalid public key");
    this.#active = Object.freeze({
      pubkey: pubkey.toLowerCase(),
      status: "active",
    });
    return this.#active;
  }

  get active(): PublicAccount | null {
    return this.#active;
  }

  signOut(): void {
    this.#active = null;
  }
}
