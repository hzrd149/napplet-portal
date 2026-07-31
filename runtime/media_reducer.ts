import type { MediaNapMessage } from "@napplet/nap/media";
import type { MediaPlaybackOwner } from "@napplet/core";

export interface MediaActorRef {
  readonly connectionId: string;
  readonly windowId: string;
}

export interface MediaProjection {
  readonly type: "runtime.media.snapshot";
  readonly accountId: string;
  readonly sessionId: string;
  readonly generation: number;
  readonly playbackOwner: MediaPlaybackOwner;
  readonly owner: MediaActorRef | null;
  readonly origin: MediaActorRef;
  readonly status: "playing" | "paused" | "stopped" | "buffering";
  readonly transferable: boolean;
  readonly terminal: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface MediaSessionState extends Omit<MediaProjection, "type"> {
  readonly requestOutcomes: ReadonlyMap<string, MediaRecordedOutcome>;
}

export interface MediaRecordedOutcome {
  readonly fingerprint: string;
  readonly result: MediaNapMessage;
}

export interface MediaAuthorityState {
  readonly sessions: ReadonlyMap<string, MediaSessionState>;
  readonly activeByAccount: ReadonlyMap<string, string>;
}

export type MediaCommand = {
  readonly type: "create";
  readonly accountId: string;
  readonly actor: MediaActorRef;
  readonly message: Extract<MediaNapMessage, { type: "media.session.create" }>;
  readonly canonicalSessionId: string;
  readonly fingerprint: string;
  readonly recipients: readonly MediaActorRef[];
};

export interface MediaEffect {
  readonly recipient: MediaActorRef;
  readonly message: MediaNapMessage | MediaProjection;
}

export interface MediaTransition {
  readonly state: MediaAuthorityState;
  readonly accepted: boolean;
  readonly session?: MediaSessionState;
  readonly effects: readonly MediaEffect[];
  readonly reason?: string;
}

export const EMPTY_MEDIA_STATE: MediaAuthorityState = Object.freeze({
  sessions: new Map(),
  activeByAccount: new Map(),
});

function sameActor(left: MediaActorRef, right: MediaActorRef): boolean {
  return left.connectionId === right.connectionId &&
    left.windowId === right.windowId;
}

function projection(session: MediaSessionState): MediaProjection {
  return Object.freeze({
    type: "runtime.media.snapshot",
    accountId: session.accountId,
    sessionId: session.sessionId,
    generation: session.generation,
    playbackOwner: session.playbackOwner,
    owner: session.owner,
    origin: session.origin,
    status: session.status,
    transferable: session.transferable,
    terminal: session.terminal,
    metadata: session.metadata,
  });
}

export function reduceMedia(
  state: MediaAuthorityState,
  command: MediaCommand,
): MediaTransition {
  const replay = [...state.sessions.values()].find((session) =>
    sameActor(session.origin, command.actor) &&
    session.requestOutcomes.has(command.message.id)
  )?.requestOutcomes.get(command.message.id);
  if (replay) {
    if (replay.fingerprint !== command.fingerprint) {
      return {
        state,
        accepted: false,
        effects: [],
        reason: "request-id-conflict",
      };
    }
    return {
      state,
      accepted: true,
      effects: [{ recipient: command.actor, message: replay.result }],
    };
  }

  const generation = Math.max(
    0,
    ...[...state.sessions.values()].filter((item) =>
      item.accountId === command.accountId
    )
      .map((item) => item.generation),
  ) + 1;
  const result = Object.freeze({
    type: "media.session.create.result" as const,
    id: command.message.id,
    sessionId: command.canonicalSessionId,
    owner: command.message.owner,
  });
  const session: MediaSessionState = Object.freeze({
    accountId: command.accountId,
    sessionId: command.canonicalSessionId,
    generation,
    playbackOwner: command.message.owner,
    origin: Object.freeze({ ...command.actor }),
    owner: Object.freeze({ ...command.actor }),
    status: command.message.autoplay ? "playing" : "stopped",
    transferable: true,
    terminal: false,
    metadata: Object.freeze({ ...(command.message.metadata ?? {}) }),
    requestOutcomes: new Map([[command.message.id, {
      fingerprint: command.fingerprint,
      result,
    }]]),
  });
  const sessions = new Map(state.sessions);
  sessions.set(`${command.accountId}:${command.canonicalSessionId}`, session);
  const activeByAccount = new Map(state.activeByAccount);
  activeByAccount.set(command.accountId, command.canonicalSessionId);
  const next = Object.freeze({ sessions, activeByAccount });
  return {
    state: next,
    accepted: true,
    session,
    effects: Object.freeze([
      { recipient: command.actor, message: result },
      ...command.recipients.map((recipient) => ({
        recipient,
        message: projection(session),
      })),
    ]),
  };
}
