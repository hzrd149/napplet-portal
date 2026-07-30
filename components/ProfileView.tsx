export interface PublicProfile {
  readonly pubkey: string;
  readonly displayName?: string;
  readonly avatar?: string;
  readonly status: "active" | "offline";
}

interface ProfileViewProps {
  readonly profile: PublicProfile | null;
  readonly onSignOut: () => void;
}

function middleTruncate(value: string): string {
  return value.length > 24
    ? `${value.slice(0, 12)}…${value.slice(-12)}`
    : value;
}

export function ProfileView({ profile, onSignOut }: ProfileViewProps) {
  return (
    <section class="portal-view profile-view" aria-label="Profile">
      <h1>Profile</h1>
      {profile
        ? (
          <>
            <div class="profile-card">
              {profile.avatar
                ? <img src={profile.avatar} alt="" class="profile-avatar" />
                : (
                  <span class="profile-avatar profile-avatar-fallback">
                    <UserIcon />
                  </span>
                )}
              <div class="profile-copy">
                <h2 title={profile.displayName ?? profile.pubkey}>
                  {profile.displayName ?? "Nostr account"}
                </h2>
                <p class="pubkey" title={profile.pubkey}>
                  {middleTruncate(profile.pubkey)}
                </p>
              </div>
            </div>
            <div class="signer-status" aria-live="polite">
              <strong>
                {profile.status === "offline"
                  ? "Signer offline"
                  : "Signer connected"}
              </strong>
              {profile.status === "offline" && (
                <p>
                  Public data can continue updating while Napplet Portal
                  reconnects.
                </p>
              )}
            </div>
            <button
              type="button"
              class="destructive-button"
              onClick={onSignOut}
            >
              Sign out
            </button>
          </>
        )
        : <p>No active account.</p>}
    </section>
  );
}

export function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
