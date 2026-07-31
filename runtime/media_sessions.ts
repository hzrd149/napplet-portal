import type { MediaNapMessage } from "@napplet/nap/media";
import { decodeMediaMessage } from "./media_contract.ts";
import {
  EMPTY_MEDIA_STATE,
  type MediaActorRef,
  type MediaAuthorityState,
  type MediaProjection,
  reduceMedia,
} from "./media_reducer.ts";

interface MediaSessionCoordinatorOptions {
  readonly createId?: () => string;
  readonly deliver: (
    recipient: MediaActorRef,
    message: MediaNapMessage | MediaProjection,
  ) => boolean;
}

export interface MediaReceiveOutcome {
  readonly accepted: boolean;
  readonly session?: MediaProjection;
  readonly reason?: string;
}

function safeHint(value: string | undefined): value is string {
  return value !== undefined && value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
}

function project(
  state: MediaAuthorityState,
  accountId: string,
  sessionId: string,
) {
  const session = state.sessions.get(`${accountId}:${sessionId}`);
  if (!session) return undefined;
  const { requestOutcomes: _requestOutcomes, ...value } = session;
  return Object.freeze({ type: "runtime.media.snapshot" as const, ...value });
}

export class MediaSessionCoordinator {
  #state = EMPTY_MEDIA_STATE;
  readonly #createId: () => string;
  readonly #deliver: MediaSessionCoordinatorOptions["deliver"];
  readonly #eligible = new Map<string, Map<string, MediaActorRef>>();

  constructor(options: MediaSessionCoordinatorOptions) {
    this.#createId = options.createId ?? (() => crypto.randomUUID());
    this.#deliver = options.deliver;
  }

  get state(): MediaAuthorityState {
    return this.#state;
  }

  connect(accountId: string, actor: MediaActorRef): void {
    let account = this.#eligible.get(accountId);
    if (!account) this.#eligible.set(accountId, account = new Map());
    account.set(
      `${actor.connectionId}:${actor.windowId}`,
      Object.freeze({ ...actor }),
    );
  }

  receive(
    accountId: string,
    actor: MediaActorRef,
    input: unknown,
  ): MediaReceiveOutcome {
    const decoded = decodeMediaMessage(input);
    if (!decoded.ok || decoded.value.type !== "media.session.create") {
      return { accepted: false, reason: "invalid-media-message" };
    }
    const message = decoded.value;
    const hintAvailable = safeHint(message.sessionId) &&
      !this.#state.sessions.has(`${accountId}:${message.sessionId}`);
    const canonicalSessionId = hintAvailable
      ? message.sessionId!
      : this.#createId();
    const transition = reduceMedia(this.#state, {
      type: "create",
      accountId,
      actor: Object.freeze({ ...actor }),
      message,
      canonicalSessionId,
      fingerprint: JSON.stringify(message),
      recipients: [...(this.#eligible.get(accountId)?.values() ?? [])],
    });
    this.#state = transition.state;
    for (const effect of transition.effects) {
      this.#deliver(effect.recipient, effect.message);
    }
    return {
      accepted: transition.accepted,
      session: transition.session
        ? project(this.#state, accountId, transition.session.sessionId)
        : undefined,
      reason: transition.reason,
    };
  }
}
