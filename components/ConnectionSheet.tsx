import type { ConnectionSnapshot } from "../shell/connection.ts";
import { connectionCopy } from "./ConnectionConstellation.tsx";

interface ConnectionSheetProps {
  readonly state: ConnectionSnapshot;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onRetry: () => void;
}

export function ConnectionSheet(
  { state, open, onClose, onRetry }: ConnectionSheetProps,
) {
  if (!open) return null;
  return (
    <div
      class="connection-sheet-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <section
        class="connection-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="connection-sheet-title">Connection</h2>
        <p>{connectionCopy(state)}</p>
        <div class="connection-sheet-actions">
          {state.canRetry && (
            <button type="button" class="primary-button" onClick={onRetry}>
              Retry
            </button>
          )}
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  );
}
