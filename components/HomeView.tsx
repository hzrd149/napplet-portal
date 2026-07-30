export interface CatalogViewEntry {
  readonly coordinate: string;
  readonly acceptedManifestEventId: string;
  readonly title?: string;
  readonly version?: string;
  readonly capabilities?: readonly string[];
  readonly launch?: {
    readonly dTag: string;
    readonly aggregateHash: string;
    readonly srcdoc: string;
  };
}

export interface CatalogViewProjection {
  readonly catalogEventId: string | null;
  readonly entries: readonly CatalogViewEntry[];
}

export type CatalogStreamStatus = "loading" | "ready" | "stale" | "error";

interface HomeViewProps {
  readonly catalog: CatalogViewProjection;
  readonly status: CatalogStreamStatus;
  readonly signedIn: boolean;
  readonly onOpen: (entry: CatalogViewEntry) => void;
  readonly onCommand: (command: CatalogCardCommand) => void;
}

export type CatalogCardCommand =
  | { readonly type: "review"; readonly entry: CatalogViewEntry }
  | { readonly type: "uninstall"; readonly entry: CatalogViewEntry };

export function HomeView({
  catalog,
  status,
  signedIn,
  onOpen,
  onCommand,
}: HomeViewProps) {
  const hasEntries = catalog.entries.length > 0;
  return (
    <section class="portal-view catalog-view" aria-label="Home">
      <header class="catalog-heading">
        <h1>Installed napplets</h1>
        <InlineStatusNotice status={status} hasEntries={hasEntries} />
      </header>
      {!signedIn && (
        <div class="signin-callout">
          <p>Sign in to connect a Nostr account before opening napplets.</p>
          <a class="primary-button" href="/signin">Sign in</a>
        </div>
      )}
      {!hasEntries && status !== "loading"
        ? (
          <div class="empty-state catalog-empty">
            <UserWindowIcon />
            <h2>No napplets installed</h2>
            <p>
              Installed napplets synchronized for this account will appear here.
            </p>
          </div>
        )
        : (
          <div class="catalog-grid">
            {catalog.entries.map((entry) => (
              <NappletCard
                key={entry.coordinate}
                entry={entry}
                signedIn={signedIn}
                onOpen={onOpen}
                onCommand={onCommand}
              />
            ))}
          </div>
        )}
    </section>
  );
}

function InlineStatusNotice(
  { status, hasEntries }: {
    status: CatalogStreamStatus;
    hasEntries: boolean;
  },
) {
  const copy = status === "loading"
    ? hasEntries
      ? "Showing synchronized napplets while updates continue."
      : "Syncing installed napplets…"
    : status === "stale"
    ? "Showing synchronized napplets while updates continue."
    : status === "error"
    ? "Installed napplets could not be refreshed. Showing the last synchronized catalog."
    : "";
  return copy
    ? <p class="catalog-status" role="status" aria-live="polite">{copy}</p>
    : null;
}

function NappletCard({
  entry,
  signedIn,
  onOpen,
  onCommand,
}: {
  entry: CatalogViewEntry;
  signedIn: boolean;
  onOpen: (entry: CatalogViewEntry) => void;
  onCommand: (command: CatalogCardCommand) => void;
}) {
  const fallback = entry.coordinate.split(":").at(-1) || "Installed napplet";
  const title = entry.title?.trim() || fallback;
  const resolved = Boolean(entry.launch);
  return (
    <article
      class="catalog-card"
      data-coordinate={entry.coordinate}
      data-manifest-id={entry.acceptedManifestEventId}
    >
      <span class="napplet-icon" aria-hidden="true">
        <UserWindowIcon />
      </span>
      <div class="catalog-card-copy">
        <h2 class="napplet-title">{title}</h2>
        <p class="catalog-metadata" title={entry.coordinate}>
          {entry.coordinate}
        </p>
        <p class="catalog-version" title={entry.version || undefined}>
          {resolved
            ? `Accepted version ${entry.version?.trim() || "Not provided"}`
            : "Manifest details unavailable"}
        </p>
      </div>
      <details class="catalog-actions">
        <summary aria-label={`Actions for ${title}`}>•••</summary>
        <div class="catalog-action-menu">
          <button
            type="button"
            disabled={!signedIn || !resolved}
            onClick={() => onCommand({ type: "review", entry })}
          >
            Review update
          </button>
          <button
            type="button"
            disabled={!signedIn}
            onClick={() => onCommand({ type: "uninstall", entry })}
          >
            Uninstall
          </button>
        </div>
      </details>
      <button
        type="button"
        class="catalog-launch"
        disabled={!signedIn || !resolved}
        onClick={() => onOpen(entry)}
      >
        {resolved ? "Open" : "Unavailable"}
      </button>
    </article>
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
