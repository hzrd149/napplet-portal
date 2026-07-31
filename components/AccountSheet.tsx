import { useEffect, useRef } from "preact/hooks";
import { type PublicProfile, UserIcon } from "./ProfileView.tsx";
import { shortenPubkey } from "./HomeHeader.tsx";
import { ThemeControls } from "./ThemeControls.tsx";

interface AccountSheetProps {
  readonly open: boolean;
  readonly profile: PublicProfile | null;
  readonly backendConnected: boolean;
  readonly onClose: () => void;
  readonly onSignOut: () => void;
  readonly onOpenSettings?: () => void;
}

export function AccountSheet(
  { open, profile, backendConnected, onClose, onSignOut, onOpenSettings }:
    AccountSheetProps,
) {
  const invoker = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      invoker.current = document.activeElement as HTMLElement | null;
      return;
    }
    invoker.current?.focus();
    invoker.current = null;
  }, [open]);
  if (!open) return null;
  return (
    <div class="account-sheet-backdrop" role="presentation" onClick={onClose}>
      <section
        class="account-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
        onClick={(event) =>
          event.stopPropagation()}
      >
        <header class="sheet-heading">
          <h2 id="account-title">Account</h2>
          <button
            type="button"
            class="sheet-close"
            aria-label="Close account"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {profile
          ? (
            <div class="account-identity">
              <span class="home-header-avatar">
                <UserIcon />
              </span>
              <div>
                <strong>{profile.displayName ?? "Nostr account"}</strong>
                <span>{shortenPubkey(profile.pubkey)}</span>
              </div>
            </div>
          )
          : <p class="account-state-copy">No account is connected.</p>}
        {profile?.status === "offline" && (
          <p>Public data will keep updating while the signer reconnects.</p>
        )}
        <dl class="account-status-grid">
          <div>
            <dt>Account</dt>
            <dd>{profile ? "Signed in" : "Signed out"}</dd>
          </div>
          <div>
            <dt>Signer</dt>
            <dd>
              {profile?.status === "offline"
                ? "Signer offline"
                : profile
                ? "Signer connected"
                : "No signer"}
            </dd>
          </div>
          <div>
            <dt>Portal</dt>
            <dd>
              {backendConnected ? "Backend connected" : "Backend disconnected"}
            </dd>
          </div>
        </dl>
        <ThemeControls />
        <div class="account-actions">
          {!profile
            ? <a class="primary-button" href="/signin">Sign in</a>
            : (
              <button
                type="button"
                class="destructive-button"
                onClick={onSignOut}
              >
                Sign out
              </button>
            )}
          {onOpenSettings && (
            <button
              type="button"
              class="secondary-button"
              onClick={onOpenSettings}
            >
              Runtime settings
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
