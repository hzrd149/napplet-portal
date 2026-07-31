import type { MediaAction, MediaPlaybackOwner } from "@napplet/core";
import type { MediaNapMessage, MediaStateMessage } from "@napplet/nap/media";

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
  readonly status: MediaStateMessage["status"];
  readonly position?: number;
  readonly duration?: number;
  readonly volume?: number;
  readonly capabilities: readonly MediaAction[];
  readonly transferable: boolean;
  readonly terminal: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;
}
interface Recorded {
  readonly fingerprint: string;
  readonly accepted: boolean;
}
export interface MediaSessionState extends Omit<MediaProjection, "type"> {
  readonly requests: ReadonlyMap<string, Recorded>;
}
export interface MediaAuthorityState {
  readonly sessions: ReadonlyMap<string, MediaSessionState>;
  readonly activeByAccount: ReadonlyMap<string, string>;
  readonly nextGeneration: number;
}
interface Base {
  readonly accountId: string;
  readonly actor: MediaActorRef;
  readonly recipients: readonly MediaActorRef[];
}
export type MediaCommand =
  | (Base & {
    readonly type: "create";
    readonly message: Extract<
      MediaNapMessage,
      { type: "media.session.create" }
    >;
    readonly canonicalSessionId: string;
    readonly fingerprint: string;
  })
  | (Base & {
    readonly type: "update" | "destroy" | "state" | "capabilities" | "route";
    readonly message: MediaNapMessage;
    readonly generation?: number;
  })
  | (Base & {
    readonly type: "transfer" | "stop";
    readonly sessionId: string;
    readonly generation: number;
    readonly requestId: string;
    readonly fingerprint: string;
  })
  | {
    readonly type: "owner-loss" | "origin-expiry";
    readonly actor: MediaActorRef;
    readonly recipientsByAccount: ReadonlyMap<string, readonly MediaActorRef[]>;
  }
  | {
    readonly type: "account-change";
    readonly accountId: string;
    readonly recipients: readonly MediaActorRef[];
  }
  | {
    readonly type: "shutdown";
    readonly recipientsByAccount: ReadonlyMap<string, readonly MediaActorRef[]>;
  };
export interface MediaEffect {
  readonly recipient: MediaActorRef;
  readonly message: MediaNapMessage | MediaProjection | MediaGrant;
}
export interface MediaGrant {
  readonly type: "runtime.media.grant";
  readonly sessionId: string;
  readonly generation: number;
  readonly owner: MediaActorRef;
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
  nextGeneration: 0,
});

const same = (a: MediaActorRef | null, b: MediaActorRef) =>
  a?.connectionId === b.connectionId && a.windowId === b.windowId;
const key = (account: string, session: string) => `${account}:${session}`;
const snap = (s: MediaSessionState): MediaProjection =>
  Object.freeze({
    type: "runtime.media.snapshot",
    accountId: s.accountId,
    sessionId: s.sessionId,
    generation: s.generation,
    playbackOwner: s.playbackOwner,
    owner: s.owner,
    origin: s.origin,
    status: s.status,
    position: s.position,
    duration: s.duration,
    volume: s.volume,
    capabilities: s.capabilities,
    transferable: s.transferable,
    terminal: s.terminal,
    metadata: s.metadata,
  });
const broadcast = (
  s: MediaSessionState,
  recipients: readonly MediaActorRef[],
): MediaEffect[] =>
  recipients.map((recipient) => ({ recipient, message: snap(s) }));
function replace(
  state: MediaAuthorityState,
  session: MediaSessionState,
  active = true,
): MediaAuthorityState {
  const sessions = new Map(state.sessions);
  sessions.set(key(session.accountId, session.sessionId), session);
  const activeByAccount = new Map(state.activeByAccount);
  if (active) activeByAccount.set(session.accountId, session.sessionId);
  else if (activeByAccount.get(session.accountId) === session.sessionId) {
    activeByAccount.delete(session.accountId);
  }
  return Object.freeze({
    sessions,
    activeByAccount,
    nextGeneration: Math.max(state.nextGeneration, session.generation),
  });
}
function terminal(
  session: MediaSessionState,
  generation: number,
): MediaSessionState {
  return Object.freeze({
    ...session,
    generation,
    owner: null,
    status: "stopped",
    transferable: false,
    terminal: true,
  });
}
function reject(state: MediaAuthorityState, reason: string): MediaTransition {
  return { state, accepted: false, effects: [], reason };
}

export function reduceMedia(
  state: MediaAuthorityState,
  command: MediaCommand,
): MediaTransition {
  if (command.type === "create") {
    for (const candidate of state.sessions.values()) {
      const retry = same(candidate.origin, command.actor)
        ? candidate.requests.get(command.message.id)
        : undefined;
      if (retry) {
        return retry.fingerprint === command.fingerprint
          ? { state, accepted: retry.accepted, session: candidate, effects: [] }
          : reject(state, "request-id-conflict");
      }
    }
    let working = state;
    const effects: MediaEffect[] = [];
    const priorId = state.activeByAccount.get(command.accountId);
    const prior = priorId &&
      state.sessions.get(key(command.accountId, priorId));
    if (prior && !prior.terminal) {
      const ended = terminal(prior, working.nextGeneration + 1);
      working = replace(working, ended, false);
      if (prior.owner) {
        effects.push({
          recipient: prior.owner,
          message: Object.freeze({
            type: "media.command",
            sessionId: prior.sessionId,
            action: "stop",
          }),
        });
      }
    }
    const generation = working.nextGeneration + 1;
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
      capabilities: Object.freeze([...(command.message.capabilities ?? [])]),
      transferable: true,
      terminal: false,
      metadata: Object.freeze({ ...(command.message.metadata ?? {}) }),
      requests: new Map([[command.message.id, {
        fingerprint: command.fingerprint,
        accepted: true,
      }]]),
    });
    working = replace(working, session);
    effects.push(
      { recipient: command.actor, message: result },
      ...broadcast(session, command.recipients),
    );
    return { state: working, accepted: true, session, effects };
  }
  if (
    command.type === "owner-loss" || command.type === "origin-expiry" ||
    command.type === "shutdown"
  ) {
    let working = state;
    const effects: MediaEffect[] = [];
    let last: MediaSessionState | undefined;
    for (const session of state.sessions.values()) {
      const affected = command.type === "shutdown" ||
        (command.type === "owner-loss"
          ? same(session.owner, command.actor)
          : same(session.origin, command.actor));
      if (!affected || session.terminal) continue;
      const generation = working.nextGeneration + 1;
      const next = command.type === "owner-loss"
        ? Object.freeze({
          ...session,
          generation,
          owner: null,
          status: "stopped" as const,
          transferable: true,
        })
        : terminal(session, generation);
      working = replace(working, next, !next.terminal);
      last = next;
      const recipients = command.recipientsByAccount.get(session.accountId) ??
        [];
      effects.push(...broadcast(next, recipients));
    }
    return { state: working, accepted: Boolean(last), session: last, effects };
  }
  if (command.type === "account-change") {
    let working = state;
    const effects: MediaEffect[] = [];
    let last: MediaSessionState | undefined;
    for (const session of state.sessions.values()) {
      if (session.accountId === command.accountId && !session.terminal) {
        last = terminal(session, working.nextGeneration + 1);
        working = replace(working, last, false);
        effects.push(...broadcast(last, command.recipients));
      }
    }
    return { state: working, accepted: Boolean(last), session: last, effects };
  }
  const active = command as Extract<
    MediaCommand,
    {
      readonly type:
        | "update"
        | "destroy"
        | "state"
        | "capabilities"
        | "route"
        | "transfer"
        | "stop";
    }
  >;
  const sessionId = "sessionId" in active
    ? active.sessionId
    : (active.message as { readonly sessionId: string }).sessionId;
  const session = state.sessions.get(key(active.accountId, sessionId));
  if (!session || session.terminal) return reject(state, "unknown-session");
  if (active.type === "transfer" || active.type === "stop") {
    const seen = session.requests.get(active.requestId);
    if (seen) {
      return seen.fingerprint === active.fingerprint
        ? { state, accepted: seen.accepted, session, effects: [] }
        : reject(state, "request-id-conflict");
    }
    if (active.generation !== session.generation) {
      return reject(state, "stale-generation");
    }
    const requests = new Map(session.requests);
    requests.set(active.requestId, {
      fingerprint: active.fingerprint,
      accepted: true,
    });
    while (requests.size > 64) requests.delete(requests.keys().next().value!);
    const generation = state.nextGeneration + 1;
    const effects: MediaEffect[] = [];
    if (session.owner) {
      effects.push({
        recipient: session.owner,
        message: Object.freeze({
          type: "media.command",
          sessionId,
          action: "stop",
        }),
      });
    }
    const next = Object.freeze({
      ...session,
      generation,
      owner: active.type === "transfer"
        ? Object.freeze({ ...active.actor })
        : null,
      status: "stopped" as const,
      transferable: true,
      requests,
    });
    if (active.type === "transfer") {
      effects.push({
        recipient: active.actor,
        message: Object.freeze({
          type: "runtime.media.grant",
          sessionId,
          generation,
          owner: next.owner!,
        }),
      });
    }
    effects.push(...broadcast(next, active.recipients));
    return {
      state: replace(state, next),
      accepted: true,
      session: next,
      effects,
    };
  }
  const messageCommand = active as Extract<
    MediaCommand,
    { readonly type: "update" | "destroy" | "state" | "capabilities" | "route" }
  >;
  const originOnly = messageCommand.type === "update" ||
    messageCommand.type === "destroy";
  if (
    originOnly
      ? !same(session.origin, messageCommand.actor)
      : !same(session.owner, messageCommand.actor) ||
        messageCommand.generation !== session.generation
  ) return reject(state, "not-authorized");
  let next: MediaSessionState;
  const effects: MediaEffect[] = [];
  if (messageCommand.type === "destroy") {
    next = terminal(session, state.nextGeneration + 1);
  } else if (messageCommand.type === "update") {
    next = Object.freeze({
      ...session,
      metadata: Object.freeze({
        ...session.metadata,
        ...(messageCommand.message as Extract<
          MediaNapMessage,
          { type: "media.session.update" }
        >).metadata,
      }),
    });
  } else if (messageCommand.type === "state") {
    const msg = messageCommand.message as MediaStateMessage;
    next = Object.freeze({
      ...session,
      status: msg.status,
      position: msg.position ?? session.position,
      duration: msg.duration ?? session.duration,
      volume: msg.volume ?? session.volume,
    });
  } else if (messageCommand.type === "capabilities") {
    next = Object.freeze({
      ...session,
      capabilities: Object.freeze([
        ...(messageCommand.message as Extract<
          MediaNapMessage,
          { type: "media.capabilities" }
        >).actions,
      ]),
    });
  } else {
    next = session;
    effects.push({
      recipient: session.owner!,
      message: messageCommand.message,
    });
  }
  effects.push(...broadcast(next, messageCommand.recipients));
  return {
    state: replace(state, next, !next.terminal),
    accepted: true,
    session: next,
    effects,
  };
}
