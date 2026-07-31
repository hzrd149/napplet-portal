import type { MediaActorRef } from "../runtime/media_reducer.ts";
import type { ShellMediaProjection } from "../islands/NappletShell.tsx";

interface MediaControlsProps {
  readonly ready: boolean;
  readonly projection: ShellMediaProjection | null;
  readonly currentOwner: MediaActorRef | null;
  readonly pending: boolean;
  readonly retryRequired: boolean;
  readonly onTransfer: () => void;
  readonly onStop: () => void;
  readonly onRetry: () => void;
}

const bounded = (value: unknown, fallback: string, max = 96) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : fallback;

export function MediaControls(props: MediaControlsProps) {
  const session = props.ready ? props.projection : null;
  if (!session) return null;
  const owns = props.currentOwner !== null &&
    session.owner?.connectionId === props.currentOwner.connectionId &&
    session.owner.windowId === props.currentOwner.windowId;
  const title = bounded(session.metadata.title, "Untitled media");
  const artist = bounded(session.metadata.artist, "Unknown artist", 64);
  return (
    <aside class="media-controls" aria-label="Now playing">
      <div class="media-controls-copy">
        <strong title={title}>{title}</strong>
        <span title={artist}>{artist}</span>
        <span class="sr-only" aria-live="polite">
          {session.status}
          {owns ? ", playing in this tab" : ", another tab owns playback"}
        </span>
      </div>
      <div class="media-controls-actions">
        {!owns && session.transferable && !session.terminal && (
          <button
            type="button"
            disabled={props.pending}
            onClick={props.onTransfer}
          >
            Transfer here
          </button>
        )}
        {!session.terminal && (
          <button type="button" disabled={props.pending} onClick={props.onStop}>
            Stop playback
          </button>
        )}
        {owns && props.retryRequired && (
          <button type="button" onClick={props.onRetry}>Tap to play</button>
        )}
      </div>
    </aside>
  );
}
