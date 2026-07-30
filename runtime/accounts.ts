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
}
