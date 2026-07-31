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
  readonly resolution?: "pending" | "ready" | "unavailable";
  readonly update?: CatalogUpdateCandidate;
}

export interface CatalogViewProjection {
  readonly catalogEventId: string | null;
  readonly entries: readonly CatalogViewEntry[];
}

export interface InstallPreview {
  readonly publisher: string;
  readonly coordinate: string;
  readonly manifestEventId: string;
  readonly title?: string;
  readonly version?: string;
  readonly aggregateHash: string;
  readonly capabilities: readonly string[];
  readonly sourceCatalogEventId: string | null;
}

export type CatalogStreamStatus = "loading" | "ready" | "stale" | "error";

interface HomeViewProps {
  readonly configured?: boolean;
  readonly catalog: CatalogViewProjection;
  readonly status: CatalogStreamStatus;
  readonly signedIn: boolean;
  readonly query?: string;
  readonly onQueryChange?: (query: string) => void;
  readonly onOpen: (entry: CatalogViewEntry) => void;
  readonly onCommand: (
    command: CatalogMutationCommand,
  ) => Promise<CatalogCommandOutcome>;
}

export type CatalogCardCommand =
  | { readonly type: "review"; readonly entry: CatalogViewEntry }
  | { readonly type: "uninstall"; readonly entry: CatalogViewEntry };

export type CatalogMutationCommand =
  | { readonly type: "catalog.preview"; readonly naddr: string }
  | {
    readonly type: "catalog.approve";
    readonly coordinate: string;
    readonly manifestEventId: string;
    readonly sourceCatalogEventId: string | null;
  }
  | { readonly type: "catalog.uninstall"; readonly coordinate: string };

export interface CatalogCommandOutcome {
  readonly ok: boolean;
  readonly error?: string;
  readonly value?: unknown;
}

export function filterCatalogEntries(
  entries: readonly CatalogViewEntry[],
  query: string,
): readonly CatalogViewEntry[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return entries;
  return entries.filter((entry) => {
    const identifier = entry.coordinate.split(":").at(-1) ?? "";
    return [
      entry.title ?? "",
      identifier,
      entry.version ?? "",
      ...(entry.capabilities ?? []),
    ]
      .some((value) => value.toLocaleLowerCase().includes(needle));
  });
}

export function HomeView({
  catalog,
  configured = true,
  status,
  signedIn,
  query = "",
  onQueryChange = () => undefined,
  onOpen,
  onCommand,
}: HomeViewProps) {
  const hasEntries = catalog.entries.length > 0;
  const [dialog, setDialog] = useState<CatalogCardCommand | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [naddr, setNaddr] = useState("");
  const [installPreview, setInstallPreview] = useState<InstallPreview | null>(
    null,
  );
  const [installPending, setInstallPending] = useState(false);
  const [installError, setInstallError] = useState("");
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
    if (
      installPreview &&
      installPreview.sourceCatalogEventId !== catalog.catalogEventId
    ) {
      setInstallPreview(null);
      setInstallPending(false);
      setInstallError("");
      setAnnouncement(
        "The installed catalog changed. Review the latest version before continuing.",
      );
      queueMicrotask(() => invoker.current?.focus());
    }
  }, [catalog.catalogEventId, installPreview]);

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
    const result = await onCommand(command);
    setPending(false);
    if (result.ok) closeDialog();
    else {
      setError(
        result.error === "catalog-command-capacity"
          ? "Please wait for a current action to finish, then try again."
          : command.type === "catalog.approve"
          ? "The update could not be approved. Try again."
          : "The napplet could not be uninstalled. Try again.",
      );
    }
  }

  async function previewInstall(event: Event): Promise<void> {
    event.preventDefault();
    if (installPending || !naddr.trim()) return;
    invoker.current = event.currentTarget instanceof HTMLFormElement
      ? event.currentTarget.querySelector("input")
      : null;
    setInstallPending(true);
    setInstallError("");
    const result = await onCommand({
      type: "catalog.preview",
      naddr: naddr.trim(),
    });
    setInstallPending(false);
    if (!result.ok || !result.value || typeof result.value !== "object") {
      setInstallError(
        "That naddr could not be resolved. Check it and try again.",
      );
      return;
    }
    setInstallPreview(result.value as InstallPreview);
  }

  async function approveInstall(): Promise<void> {
    if (!installPreview || installPending) return;
    setInstallPending(true);
    setInstallError("");
    const result = await onCommand({
      type: "catalog.approve",
      coordinate: installPreview.coordinate,
      manifestEventId: installPreview.manifestEventId,
      sourceCatalogEventId: installPreview.sourceCatalogEventId,
    });
    setInstallPending(false);
    if (!result.ok) {
      setInstallError(
        "The napplet could not be installed. Review the details and try again.",
      );
      return;
    }
    setInstallPreview(null);
    setNaddr("");
    setAnnouncement("Napplet installed.");
    queueMicrotask(() => invoker.current?.focus());
  }
  return (
    <section class="portal-view catalog-view" aria-label="Home">
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
          <CatalogContent
            catalog={catalog}
            status={status}
            signedIn={signedIn}
            announcement={announcement}
            hasEntries={hasEntries}
            query={query}
            onQueryChange={onQueryChange}
            naddr={naddr}
            installPending={installPending}
            installError={installError}
            onNaddrChange={setNaddr}
            onInstall={previewInstall}
            onOpen={onOpen}
            onCommand={openDialog}
          />
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
            sourceCatalogEventId: openedCatalogId.current,
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
      <InstallReviewDialog
        preview={installPreview}
        open={installPreview !== null}
        pending={installPending}
        error={installError}
        onApprove={() => void approveInstall()}
        onClose={() => {
          setInstallPreview(null);
          setInstallError("");
          queueMicrotask(() => invoker.current?.focus());
        }}
      />
    </section>
  );
}

function CatalogContent({
  catalog,
  status,
  signedIn,
  announcement,
  hasEntries,
  query,
  onQueryChange,
  naddr,
  installPending,
  installError,
  onNaddrChange,
  onInstall,
  onOpen,
  onCommand,
}: {
  catalog: CatalogViewProjection;
  status: CatalogStreamStatus;
  signedIn: boolean;
  announcement: string;
  hasEntries: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  naddr: string;
  installPending: boolean;
  installError: string;
  onNaddrChange: (value: string) => void;
  onInstall: (event: Event) => void;
  onOpen: (entry: CatalogViewEntry) => void;
  onCommand: (command: CatalogCardCommand) => void;
}) {
  const results = filterCatalogEntries(catalog.entries, query);
  return (
    <>
      <p class="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
      <header class="catalog-heading">
        <h1>Installed napplets</h1>
        <InlineStatusNotice status={status} hasEntries={hasEntries} />
      </header>
      {signedIn && (
        <form class="catalog-install" onSubmit={onInstall}>
          <label for="install-naddr">Install a napplet</label>
          <div class="catalog-control-row">
            <input
              id="install-naddr"
              name="naddr"
              type="text"
              inputMode="url"
              value={naddr}
              placeholder="naddr1…"
              aria-describedby={installError ? "install-error" : undefined}
              onInput={(event) => onNaddrChange(event.currentTarget.value)}
            />
            <button type="submit" disabled={installPending || !naddr.trim()}>
              {installPending ? "Resolving…" : "Review install"}
            </button>
          </div>
          {installError && (
            <p id="install-error" class="field-error" role="alert">
              {installError}
            </p>
          )}
        </form>
      )}
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
      {hasEntries && (
        <div class="catalog-search">
          <label for="catalog-search">Search installed napplets</label>
          <div class="catalog-control-row">
            <input
              id="catalog-search"
              type="search"
              value={query}
              onInput={(event) => onQueryChange(event.currentTarget.value)}
            />
            {query && (
              <button type="button" onClick={() => onQueryChange("")}>
                Clear
              </button>
            )}
          </div>
          <p
            class="visually-hidden"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {results.length} {results.length === 1 ? "napplet" : "napplets"}
            {" "}
            found
          </p>
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
        : results.length === 0
        ? (
          <div class="empty-state catalog-empty">
            <h2>No installed napplets match this search</h2>
            <p>Try a different title, identifier, version, or capability.</p>
          </div>
        )
        : (
          <div class="catalog-grid">
            {results.map((entry) => (
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
    </>
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

export function InstallReviewDialog({
  preview,
  open,
  pending,
  error,
  onApprove,
  onClose,
}: {
  preview: InstallPreview | null;
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
  if (!preview) return null;
  return (
    <dialog
      ref={element}
      open={open}
      class="catalog-dialog"
      aria-labelledby="install-review-title"
      onClose={onClose}
    >
      <h2 id="install-review-title" tabIndex={-1}>Review napplet install</h2>
      <div class="dialog-comparison">
        <dl>
          <PublicIdentifier label="Publisher" value={preview.publisher} />
          <PublicIdentifier label="Coordinate" value={preview.coordinate} />
          <PublicIdentifier
            label="Manifest ID"
            value={preview.manifestEventId}
          />
          <div class="comparison-field">
            <dt>Display name</dt>
            <dd>{preview.title || "Not provided"}</dd>
          </div>
          <div class="comparison-field">
            <dt>Version</dt>
            <dd>{preview.version || "Not provided"}</dd>
          </div>
          <PublicIdentifier
            label="Aggregate hash"
            value={preview.aggregateHash}
          />
          <div class="comparison-field">
            <dt>Capabilities</dt>
            <dd>
              {preview.capabilities.length
                ? preview.capabilities.join(", ")
                : "None declared"}
            </dd>
          </div>
        </dl>
      </div>
      {error && <p class="dialog-error" role="alert">{error}</p>}
      <div class="dialog-actions">
        <button type="button" disabled={pending} onClick={onClose}>
          Cancel
        </button>
        <button type="button" disabled={pending} onClick={onApprove}>
          {pending ? "Installing…" : "Install napplet"}
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
  const resolved = entry.resolution === "ready" ||
    (entry.resolution === undefined && Boolean(entry.title));
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
