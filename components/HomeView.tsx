import { useEffect, useRef, useState } from "preact/hooks";

export interface CatalogUpdateCandidate {
  readonly publisher: string;
  readonly manifestEventId: string;
  readonly title?: string;
  readonly version?: string;
  readonly aggregateHash: string;
  readonly capabilities: readonly string[];
}

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
  readonly update?: CatalogUpdateCandidate;
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
  readonly onCommand: (command: CatalogMutationCommand) => Promise<boolean>;
}

export type CatalogCardCommand =
  | { readonly type: "review"; readonly entry: CatalogViewEntry }
  | { readonly type: "uninstall"; readonly entry: CatalogViewEntry };

export type CatalogMutationCommand =
  | {
    readonly type: "catalog.approve";
    readonly coordinate: string;
    readonly manifestEventId: string;
  }
  | { readonly type: "catalog.uninstall"; readonly coordinate: string };

export function HomeView({
  catalog,
  status,
  signedIn,
  onOpen,
  onCommand,
}: HomeViewProps) {
  const hasEntries = catalog.entries.length > 0;
  const [dialog, setDialog] = useState<CatalogCardCommand | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const invoker = useRef<HTMLElement | null>(null);
  const openedCatalogId = useRef<string | null>(null);

  function closeDialog(): void {
    setDialog(null);
    setPending(false);
    setError("");
    queueMicrotask(() => invoker.current?.focus());
  }

  function openDialog(command: CatalogCardCommand): void {
    invoker.current = document.activeElement as HTMLElement | null;
    openedCatalogId.current = catalog.catalogEventId;
    setError("");
    setDialog(command);
  }

  useEffect(() => {
    if (dialog && openedCatalogId.current !== catalog.catalogEventId) {
      closeDialog();
      setAnnouncement(
        "The installed catalog changed. Review the latest version before continuing.",
      );
    }
  }, [catalog.catalogEventId]);

  useEffect(() => {
    const closeCatalogDialog = () => dialog && closeDialog();
    globalThis.addEventListener("catalog-dialog-close", closeCatalogDialog);
    return () =>
      globalThis.removeEventListener(
        "catalog-dialog-close",
        closeCatalogDialog,
      );
  }, [dialog]);

  async function mutate(command: CatalogMutationCommand): Promise<void> {
    setPending(true);
    setError("");
    const ok = await onCommand(command);
    setPending(false);
    if (ok) closeDialog();
    else {
      setError(
        command.type === "catalog.approve"
          ? "The update could not be approved. Try again."
          : "The napplet could not be uninstalled. Try again.",
      );
    }
  }
  return (
    <section class="portal-view catalog-view" aria-label="Home">
      <p class="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
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
      {!signedIn && hasEntries && (
        <p class="catalog-signer-support">
          Connect a signer to change installed napplets.
        </p>
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
                onCommand={openDialog}
              />
            ))}
          </div>
        )}
      <UpdateReviewDialog
        entry={dialog?.type === "review" ? dialog.entry : null}
        open={dialog?.type === "review"}
        pending={pending}
        error={error}
        onClose={closeDialog}
        onApprove={() => {
          const entry = dialog?.entry;
          if (!entry?.update) return;
          void mutate({
            type: "catalog.approve",
            coordinate: entry.coordinate,
            manifestEventId: entry.update.manifestEventId,
          });
        }}
      />
      <UninstallDialog
        entry={dialog?.type === "uninstall" ? dialog.entry : null}
        open={dialog?.type === "uninstall"}
        pending={pending}
        error={error}
        onClose={closeDialog}
        onConfirm={() => {
          const entry = dialog?.entry;
          if (!entry) return;
          void mutate({
            type: "catalog.uninstall",
            coordinate: entry.coordinate,
          });
        }}
      />
    </section>
  );
}

export function capabilityChanges(
  accepted: readonly string[],
  candidate: readonly string[],
): string[] {
  const previous = new Set(accepted);
  const next = new Set(candidate);
  const changes = [
    ...candidate.filter((value) => !previous.has(value)).map((value) =>
      `Added ${value}`
    ),
    ...accepted.filter((value) => !next.has(value)).map((value) =>
      `Removed ${value}`
    ),
  ];
  return changes.length ? changes : ["No capability changes"];
}

function PublicIdentifier(
  { label, value }: { label: string; value: string },
) {
  return (
    <div class="comparison-field">
      <dt>{label}</dt>
      <dd>
        <code title={value} aria-label={`${label}: ${value}`}>{value}</code>
        <button
          type="button"
          aria-label={`Copy ${label}`}
          onClick={() => void navigator.clipboard?.writeText(value)}
        >
          Copy
        </button>
      </dd>
    </div>
  );
}

export function UpdateReviewDialog({
  entry,
  open,
  pending,
  error,
  onApprove,
  onClose,
}: {
  entry: CatalogViewEntry | null;
  open: boolean;
  pending: boolean;
  error: string;
  onApprove: () => void;
  onClose: () => void;
}) {
  const element = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    if (open && !element.current?.open) element.current?.showModal();
    if (!open && element.current?.open) element.current.close();
  }, [open]);
  if (!entry?.update) return null;
  const update = entry.update;
  return (
    <dialog
      ref={element}
      open={open}
      class="catalog-dialog"
      aria-labelledby="update-review-title"
      onClose={onClose}
    >
      <h2 id="update-review-title" tabIndex={-1}>Review napplet update</h2>
      <div class="dialog-comparison">
        <dl>
          <PublicIdentifier label="Publisher" value={update.publisher} />
          <PublicIdentifier label="Coordinate" value={entry.coordinate} />
          <PublicIdentifier
            label="Accepted manifest ID"
            value={entry.acceptedManifestEventId}
          />
          <PublicIdentifier
            label="New manifest ID"
            value={update.manifestEventId}
          />
          <div class="comparison-field comparison-pair">
            <dt>Display name</dt>
            <dd>{entry.title || "Not provided"}</dd>
            <dd>{update.title || "Not provided"}</dd>
          </div>
          <div class="comparison-field comparison-pair">
            <dt>Version</dt>
            <dd>{entry.version || "Not provided"}</dd>
            <dd>{update.version || "Not provided"}</dd>
          </div>
          <PublicIdentifier
            label="Aggregate hash"
            value={update.aggregateHash}
          />
        </dl>
        <h3>Capability changes</h3>
        <ul class="capability-changes">
          {capabilityChanges(
            entry.capabilities ?? [],
            update.capabilities,
          ).map((change) => <li key={change}>{change}</li>)}
        </ul>
      </div>
      {error && <p class="dialog-error" role="alert">{error}</p>}
      <div class="dialog-actions">
        <button type="button" disabled={pending} onClick={onClose}>
          Keep current version
        </button>
        <button type="button" disabled={pending} onClick={onApprove}>
          {pending ? "Approving…" : "Approve update"}
        </button>
      </div>
    </dialog>
  );
}

export function UninstallDialog({
  entry,
  open,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  entry: CatalogViewEntry | null;
  open: boolean;
  pending: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const element = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    if (open && !element.current?.open) element.current?.showModal();
    if (!open && element.current?.open) element.current.close();
  }, [open]);
  if (!entry) return null;
  const title = entry.title?.trim() || entry.coordinate.split(":").at(-1) ||
    "this napplet";
  return (
    <dialog
      ref={element}
      open={open}
      class="catalog-dialog uninstall-dialog"
      aria-labelledby="uninstall-title"
      onClose={onClose}
    >
      <h2 id="uninstall-title" tabIndex={-1}>Uninstall napplet</h2>
      <p>
        Remove {title}{" "}
        from your synchronized installed catalog? Cached files may remain until
        normal cache cleanup.
      </p>
      {error && <p class="dialog-error" role="alert">{error}</p>}
      <div class="dialog-actions">
        <button type="button" disabled={pending} onClick={onClose}>
          Keep napplet
        </button>
        <button
          type="button"
          class="destructive-button"
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? "Uninstalling…" : "Uninstall napplet"}
        </button>
      </div>
    </dialog>
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
