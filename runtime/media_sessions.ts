import { decodeMediaMessage } from "./media_contract.ts";
import {
  EMPTY_MEDIA_STATE,
  type MediaActorRef,
  type MediaAuthorityState,
  type MediaCommand,
  type MediaEffect,
  type MediaProjection,
  type MediaTransition,
  reduceMedia,
} from "./media_reducer.ts";

interface Options {
  readonly createId?: () => string;
  readonly deliver: (
    recipient: MediaActorRef,
    message: MediaEffect["message"],
  ) => boolean;
}
export interface MediaReceiveOutcome {
  readonly accepted: boolean;
  readonly session?: MediaProjection;
  readonly reason?: string;
}
const actorKey = (actor: MediaActorRef) =>
  `${actor.connectionId}:${actor.windowId}`;
const safeHint = (value: string | undefined): value is string =>
  value !== undefined && value.length <= 128 &&
  /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
function projection(
  session: MediaTransition["session"],
): MediaProjection | undefined {
  if (!session) return undefined;
  const { requests: _requests, ...value } = session;
  return Object.freeze({ type: "runtime.media.snapshot", ...value });
}

export class MediaSessionCoordinator {
  #state = EMPTY_MEDIA_STATE;
  readonly #createId: () => string;
  readonly #deliver: Options["deliver"];
  readonly #eligible = new Map<string, Map<string, MediaActorRef>>();
  #dispatching = false;
  readonly #queue: Array<() => void> = [];
  constructor(options: Options) {
    this.#createId = options.createId ?? (() => crypto.randomUUID());
    this.#deliver = options.deliver;
  }
  get state(): MediaAuthorityState {
    return this.#state;
  }
  current(accountId: string): MediaProjection | null {
    const sessionId = this.#state.activeByAccount.get(accountId);
    const session = sessionId
      ? this.#state.sessions.get(`${accountId}:${sessionId}`)
      : undefined;
    return projection(session) ?? null;
  }
  connect(accountId: string, actor: MediaActorRef): void {
    let group = this.#eligible.get(accountId);
    if (!group) this.#eligible.set(accountId, group = new Map());
    group.set(actorKey(actor), Object.freeze({ ...actor }));
  }
  #recipients(accountId: string): readonly MediaActorRef[] {
    return [...(this.#eligible.get(accountId)?.values() ?? [])];
  }
  #recipientsByAccount(): ReadonlyMap<string, readonly MediaActorRef[]> {
    return new Map(
      [...this.#eligible].map((
        [account, actors],
      ) => [account, [...actors.values()]]),
    );
  }
  #run(command: MediaCommand): MediaReceiveOutcome {
    let output: MediaReceiveOutcome = { accepted: false, reason: "queued" };
    const work = () => {
      const transition = reduceMedia(this.#state, command);
      this.#state = transition.state;
      const failed: MediaActorRef[] = [];
      for (const effect of transition.effects) {
        if (!this.#deliver(effect.recipient, effect.message)) {
          failed.push(effect.recipient);
        }
      }
      for (const actor of failed) {
        const ownsActive = [...this.#state.sessions.values()].some((session) =>
          !session.terminal &&
          session.owner?.connectionId === actor.connectionId &&
          session.owner.windowId === actor.windowId
        );
        if (!ownsActive) continue;
        const loss = reduceMedia(this.#state, {
          type: "owner-loss",
          actor,
          recipientsByAccount: this.#recipientsByAccount(),
        });
        this.#state = loss.state;
        for (const effect of loss.effects) {
          this.#deliver(effect.recipient, effect.message);
        }
      }
      output = {
        accepted: transition.accepted,
        session: projection(transition.session),
        reason: transition.reason,
      };
    };
    this.#queue.push(work);
    if (!this.#dispatching) {
      this.#dispatching = true;
      try {
        while (this.#queue.length) this.#queue.shift()!();
      } finally {
        this.#dispatching = false;
      }
    }
    return output;
  }
  receive(
    accountId: string,
    actor: MediaActorRef,
    input: unknown,
    authority: { readonly generation?: number } = {},
  ): MediaReceiveOutcome {
    const decoded = decodeMediaMessage(input);
    if (!decoded.ok) return { accepted: false, reason: decoded.error };
    const message = decoded.value;
    if (message.type === "media.session.create") {
      const id = safeHint(message.sessionId) &&
          !this.#state.sessions.has(`${accountId}:${message.sessionId}`)
        ? message.sessionId
        : this.#createId();
      return this.#run({
        type: "create",
        accountId,
        actor,
        message,
        canonicalSessionId: id,
        fingerprint: JSON.stringify(message),
        recipients: this.#recipients(accountId),
      });
    }
    if (
      message.type === "media.session.create.result" ||
      message.type === "media.controls"
    ) return { accepted: false, reason: "wrong-direction" };
    const type = message.type === "media.session.update"
      ? "update"
      : message.type === "media.session.destroy"
      ? "destroy"
      : message.type === "media.state"
      ? "state"
      : message.type === "media.capabilities"
      ? "capabilities"
      : "route";
    return this.#run({
      type,
      accountId,
      actor,
      message,
      generation: authority.generation,
      recipients: this.#recipients(accountId),
    });
  }
  transfer(
    accountId: string,
    actor: MediaActorRef,
    sessionId: string,
    generation: number,
    requestId: string,
  ) {
    return this.#run({
      type: "transfer",
      accountId,
      actor,
      sessionId,
      generation,
      requestId,
      fingerprint: JSON.stringify([
        "transfer",
        accountId,
        sessionId,
        generation,
        actorKey(actor),
      ]),
      recipients: this.#recipients(accountId),
    });
  }
  stop(
    accountId: string,
    actor: MediaActorRef,
    sessionId: string,
    generation: number,
    requestId: string,
  ) {
    return this.#run({
      type: "stop",
      accountId,
      actor,
      sessionId,
      generation,
      requestId,
      fingerprint: JSON.stringify([
        "stop",
        accountId,
        sessionId,
        generation,
        actorKey(actor),
      ]),
      recipients: this.#recipients(accountId),
    });
  }
  detach(actor: MediaActorRef): MediaReceiveOutcome[] {
    for (const group of this.#eligible.values()) group.delete(actorKey(actor));
    return [
      this.#run({
        type: "owner-loss",
        actor,
        recipientsByAccount: this.#recipientsByAccount(),
      }),
    ];
  }
  expireOrigin(actor: MediaActorRef): MediaReceiveOutcome[] {
    return [
      this.#run({
        type: "origin-expiry",
        actor,
        recipientsByAccount: this.#recipientsByAccount(),
      }),
    ];
  }
  changeAccount(accountId: string): MediaReceiveOutcome {
    return this.#run({
      type: "account-change",
      accountId,
      recipients: this.#recipients(accountId),
    });
  }
  destroy(): MediaReceiveOutcome {
    const outcome = this.#run({
      type: "shutdown",
      recipientsByAccount: this.#recipientsByAccount(),
    });
    this.#eligible.clear();
    return outcome;
  }
}
