interface HomeViewProps {
  readonly configured: boolean;
  readonly title: string;
  readonly active: boolean;
  readonly onOpen: () => void;
}

export function HomeView({
  configured,
  title,
  active,
  onOpen,
}: HomeViewProps) {
  return (
    <section class="portal-view" aria-label="Home">
      {!configured
        ? (
          <div class="empty-state">
            <UserWindowIcon />
            <h1>No napplet configured</h1>
            <p>
              Add a napplet coordinate to the server configuration, then restart
              Napplet Portal.
            </p>
          </div>
        )
        : (
          <div class="napplet-grid">
            <button type="button" class="napplet-tile" onClick={onOpen}>
              <span class="napplet-icon" aria-hidden="true">
                <UserWindowIcon />
              </span>
              <span class="napplet-title">{title}</span>
              <span class="active-status">
                <span class="active-dot" aria-hidden="true" />
                {active ? "Active" : "Open"}
              </span>
            </button>
          </div>
        )}
    </section>
  );
}

function UserWindowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 15h8" />
    </svg>
  );
}
