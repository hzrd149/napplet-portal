import { type PublicProfile, UserIcon } from "./ProfileView.tsx";

interface HomeHeaderProps {
  readonly profile: PublicProfile | null;
  readonly onOpenAccount: () => void;
}

export function shortenPubkey(pubkey: string): string {
  return pubkey.length > 24
    ? `${pubkey.slice(0, 12)}…${pubkey.slice(-12)}`
    : pubkey;
}

export function HomeHeader({ profile, onOpenAccount }: HomeHeaderProps) {
  const signerCopy = profile?.status === "offline"
    ? "Signer offline"
    : profile
    ? "Signer connected"
    : "Signed out";
  return (
    <header class="home-header">
      <button
        type="button"
        class="home-identity-target"
        onClick={onOpenAccount}
      >
        {profile?.avatar
          ? <img class="home-header-avatar" src={profile.avatar} alt="" />
          : (
            <span class="home-header-avatar">
              <UserIcon />
            </span>
          )}
        <span class="home-header-copy">
          <strong>
            {profile?.displayName ?? (profile ? "Nostr account" : "Sign in")}
          </strong>
          <span
            class="signer-mark"
            data-status={profile?.status ?? "unavailable"}
          >
            <span aria-hidden="true">
              {profile?.status === "offline" ? "!" : "●"}
            </span>
            {signerCopy}
          </span>
          {profile && (
            <span class="header-wide-identity">
              {shortenPubkey(profile.pubkey)} · {signerCopy}
            </span>
          )}
        </span>
        <span class="identity-disclosure" aria-hidden="true">›</span>
      </button>
    </header>
  );
}
