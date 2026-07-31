import {
  AccountManager,
  Accounts,
  type IAccount,
  type SerializedAccount,
} from "applesauce-accounts";
import { NostrConnectSigner, type NostrPool } from "applesauce-signers";
import type { EventTemplate, NostrEvent } from "@napplet/core";
import { BehaviorSubject } from "npm:rxjs@7.8.2";
import { debug as rootDebug, shortId } from "../debug.ts";
import { type AccountSnapshot, AccountStore } from "./account_store.ts";

const debug = rootDebug.extend("accounts");

export type IdentityStatus = "active" | "offline" | "unavailable";

export interface IdentitySnapshot {
  readonly accountId: string | null;
  readonly pubkey: string | null;
  readonly status: IdentityStatus;
  readonly generation?: number;
}

export interface PendingNostrConnect {
  readonly uri: string;
  readonly connected: Promise<IAccount>;
}

export interface PortalAccountFactories {
  readonly remoteSignerRelays: readonly string[];
  readonly pool: NostrPool;
  readonly createNostrConnect?: (abort?: AbortSignal) =>
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
  generation?: number,
): IdentitySnapshot {
  const identity: IdentitySnapshot = {
    accountId: account.id,
    pubkey: account.pubkey,
    status,
  };
  Object.defineProperty(identity, "generation", { value: generation });
  return Object.freeze(identity);
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
  readonly #connectedAccountIds = new Set<string>();
  readonly identity$ = new BehaviorSubject<IdentitySnapshot>(UNAVAILABLE);
  readonly publicReadsEnabled = true;
  #authorityGeneration = 0;

  constructor(store: AccountStore, factories: PortalAccountFactories) {
    this.#store = store;
    this.#factories = factories;
    // Account deserialization constructs the signer internally, so Applesauce's
    // documented class fallback must share the same process-owned RelayPool.
    NostrConnectSigner.pool = factories.pool;
    this.#manager.registerType(Accounts.NostrConnectAccount);
    this.#manager.registerType(Accounts.PrivateKeyAccount);
    this.#manager.active$.subscribe((account) => {
      this.#authorityGeneration++;
      this.identity$.next(this.#identityForActive(account));
    });
    debug(
      "initialized remoteSignerRelays=%d",
      factories.remoteSignerRelays.length,
    );
  }

  get identity(): IdentitySnapshot {
    return this.identity$.value;
  }

  get accountCount(): number {
    return this.#manager.accounts.length;
  }

  async restore(): Promise<IdentitySnapshot> {
    debug("restore started");
    const snapshot = await this.#store.read();
    if (!snapshot) {
      debug("restore skipped no snapshot");
      return this.identity;
    }
    this.#manager.fromJSON(snapshot.accounts as SerializedAccount[]);
    debug(
      "restore loaded accounts=%d active=%s",
      this.#manager.accounts.length,
      snapshot.activeAccountId ? "present" : "none",
    );
    if (!snapshot.activeAccountId) return this.identity;
    const account = this.#manager.getAccount(snapshot.activeAccountId);
    if (!account) throw new Error("Active account record is unavailable");
    this.#manager.setActive(account);
    const identity = this.identity;
    debug(
      "restore complete account=%s status=%s",
      shortId(identity.accountId),
      identity.status,
    );
    return identity;
  }

  async startNostrConnect(abort?: AbortSignal): Promise<NostrConnectResult> {
    debug("nostr connect start requested");
    const pending = await (this.#factories.createNostrConnect?.(abort) ??
      this.#createNostrConnect(abort));
    debug("nostr connect URI prepared");
    return {
      uri: pending.uri,
      connected: pending.connected.then((account) => this.#activate(account)),
    };
  }

  async signInBunker(uri: string): Promise<IdentitySnapshot> {
    if (!uri.startsWith("bunker://")) throw new Error("Invalid bunker URI");
    debug("bunker sign-in started");
    const account = await (this.#factories.connectBunker?.(uri) ??
      this.#connectBunker(uri));
    return await this.#activate(account);
  }

  async signInNsec(privateKey: string): Promise<IdentitySnapshot> {
    debug("nsec sign-in started");
    const account = Accounts.PrivateKeyAccount.fromKey(privateKey);
    return await this.#activate(account);
  }

  async retryOffline(): Promise<IdentitySnapshot> {
    const account = this.#manager.active;
    if (!account || account.type !== Accounts.NostrConnectAccount.type) {
      debug("offline retry skipped active=%s", Boolean(account));
      return this.identity;
    }
    try {
      debug("offline retry started account=%s", shortId(account.id));
      await (this.#factories.reconnectNostrConnect?.(account) ??
        this.#reconnectNostrConnect(account));
      this.#connectedAccountIds.add(account.id);
      this.#authorityGeneration++;
      const identity = this.#identityForActive(account);
      this.identity$.next(identity);
      debug("offline retry active account=%s", shortId(account.id));
      return identity;
    } catch {
      const identity = publicIdentity(
        account,
        "offline",
        ++this.#authorityGeneration,
      );
      this.identity$.next(identity);
      debug("offline retry failed account=%s", shortId(account.id));
      return identity;
    }
  }

  async signOut(): Promise<void> {
    debug("signout started active=%s", shortId(this.#manager.active?.id));
    this.#manager.clearActive();
    await this.#persist();
    debug("signout complete");
  }

  async signEvent(template: EventTemplate): Promise<NostrEvent> {
    const account = this.#manager.active;
    if (!account || this.identity.status !== "active") {
      throw new Error("Signer unavailable");
    }
    return await account.signEvent(template);
  }

  async #activate(account: IAccount): Promise<IdentitySnapshot> {
    debug("activate account=%s type=%s", shortId(account.id), account.type);
    this.#manager.addAccount(account);
    this.#connectedAccountIds.add(account.id);
    this.#manager.setActive(account);
    const identity = this.#identityForActive(account);
    this.identity$.next(identity);
    await this.#persist();
    debug(
      "activate complete account=%s pubkey=%s",
      shortId(account.id),
      shortId(account.pubkey),
    );
    return identity;
  }

  async #persist(): Promise<void> {
    debug(
      "persist started accounts=%d active=%s",
      this.#manager.accounts.length,
      shortId(this.#manager.active?.id),
    );
    const snapshot: AccountSnapshot = {
      version: 1,
      activeAccountId: this.#manager.active?.id ?? null,
      accounts: this.#manager.toJSON() as Record<string, unknown>[],
    };
    await this.#store.write(snapshot);
    debug("persist complete");
  }

  #identityForActive(account: IAccount | undefined): IdentitySnapshot {
    if (!account) return UNAVAILABLE;
    const status = account.type === Accounts.NostrConnectAccount.type &&
        !this.#connectedAccountIds.has(account.id)
      ? "offline"
      : "active";
    return publicIdentity(account, status, this.#authorityGeneration);
  }

  async #createNostrConnect(abort?: AbortSignal): Promise<PendingNostrConnect> {
    debug(
      "opening nostr connect signer relays=%d",
      this.#factories.remoteSignerRelays.length,
    );
    const signer = new NostrConnectSigner({
      relays: [...this.#factories.remoteSignerRelays],
      pool: this.#factories.pool,
    });
    await signer.open();
    debug("nostr connect signer opened");
    const uri = signer.getNostrConnectURI({
      name: "Napplet Portal",
      url: "http://127.0.0.1",
    });
    return {
      uri,
      connected: signer.waitForSigner(abort).then(async () => {
        debug("nostr connect signer connected");
        const pubkey = await signer.getPublicKey();
        return new Accounts.NostrConnectAccount(pubkey, signer);
      }),
    };
  }

  async #connectBunker(uri: string): Promise<IAccount> {
    debug("connecting bunker signer");
    const signer = await NostrConnectSigner.fromBunkerURI(uri, {
      pool: this.#factories.pool,
    });
    const pubkey = await signer.getPublicKey();
    debug("bunker signer connected pubkey=%s", shortId(pubkey));
    return new Accounts.NostrConnectAccount(pubkey, signer);
  }

  async #reconnectNostrConnect(account: IAccount): Promise<void> {
    debug("reconnecting nostr connect account=%s", shortId(account.id));
    const signer = account.signer as NostrConnectSigner;
    await signer.open();
    await signer.requireConnection();
    debug("reconnected nostr connect account=%s", shortId(account.id));
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
    debug("tracer sign-in pubkey=%s", shortId(pubkey));
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
    debug("tracer sign-out active=%s", shortId(this.#active?.pubkey));
    this.#active = null;
  }
}
