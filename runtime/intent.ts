import type {
  IntentAvailability,
  IntentCandidate,
  IntentRequest,
  IntentResult,
} from "@napplet/core";
import type {
  IntentAvailableMessage,
  IntentChangedMessage,
  IntentHandlersMessage,
  IntentInvokeMessage,
  IntentInvokeResultMessage,
} from "@napplet/nap/intent";
import type { CatalogService } from "./catalog.ts";
import type {
  IntentNavigationMessage,
  IntentNavigationMode,
  MessageOwner,
} from "./transport.ts";
import { createReservedIntentLaunchPath } from "./transport.ts";

export type IntentCommand =
  | IntentInvokeMessage
  | IntentAvailableMessage
  | IntentHandlersMessage;
export type IntentNotification = IntentChangedMessage;
export type IntentReply = IntentInvokeResultMessage;

interface IntentServiceOptions {
  readonly account?: () => string | null;
  readonly sendNavigation?: (
    message: IntentNavigationMessage,
    owner: MessageOwner,
  ) => void;
  readonly createId?: () => string;
  readonly now?: () => number;
  readonly setTimeout?: (callback: () => void, delay: number) => number;
  readonly clearTimeout?: (id: number) => void;
  readonly timeoutMs?: number;
  readonly maxPending?: number;
}

interface PendingInvocation {
  readonly owner: MessageOwner;
  readonly reservationId: string;
  readonly invocationId: string;
  readonly command: IntentInvokeMessage;
  readonly reply: (message: IntentReply) => void;
  readonly generation: number;
  readonly candidate: AuthorityCandidate;
  readonly targetWindowId: string;
  readonly timer: number;
  ticket: string | null;
  terminal: boolean;
}

interface LaunchTicket {
  readonly reservationId: string;
  readonly invocationId: string;
  readonly accountPubkey: string;
  readonly caller: MessageOwner;
  readonly candidate: AuthorityCandidate;
  readonly convention?: string;
  readonly payload?: unknown;
  readonly targetWindowId: string;
  readonly generation: number;
  readonly expiresAt: number;
  readonly launch: {
    readonly dTag: string;
    readonly aggregateHash: string;
    readonly srcdoc: string;
  };
}

interface AuthorityCandidate {
  readonly accountPubkey: string;
  readonly catalogEventId: string;
  readonly coordinate: string;
  readonly manifestEventId: string;
  readonly dTag: string;
  readonly aggregateHash: string;
  readonly title: string;
  readonly archetype: string;
  readonly actions: readonly string[];
  readonly conventions: readonly string[];
}

export type IntentSelection =
  | {
    readonly ok: true;
    readonly generation: number;
    readonly candidate: AuthorityCandidate;
    readonly request: Readonly<
      Required<Pick<IntentRequest, "archetype" | "action">> & IntentRequest
    >;
  }
  | { readonly ok: false; readonly result: IntentResult };

export class IntentService {
  readonly #catalog: CatalogService;
  readonly #unsubscribe: () => void;
  readonly #listeners = new Set<(message: IntentNotification) => void>();
  #registry = new Map<string, readonly AuthorityCandidate[]>();
  #lastGood = new Map<string, IntentAvailability>();
  #generation = 0;
  readonly #options: Required<IntentServiceOptions>;
  readonly #pending = new Map<string, PendingInvocation>();
  readonly #tickets = new Map<string, LaunchTicket>();

  constructor(catalog: CatalogService, options: IntentServiceOptions = {}) {
    this.#catalog = catalog;
    this.#options = {
      account: options.account ??
        (() => catalog.authoritySnapshot().accountPubkey),
      sendNavigation: options.sendNavigation ?? (() => {}),
      createId: options.createId ?? (() => crypto.randomUUID()),
      now: options.now ?? Date.now,
      setTimeout: options.setTimeout ??
        ((callback, delay) => setTimeout(callback, delay)),
      clearTimeout: options.clearTimeout ?? clearTimeout,
      timeoutMs: options.timeoutMs ?? 10_000,
      maxPending: options.maxPending ?? 32,
    };
    this.#unsubscribe = catalog.subscribe(() => this.#rebuild());
    this.#rebuild();
  }

  destroy(): void {
    for (const pending of [...this.#pending.values()]) {
      this.#settle(pending, "failed");
    }
    this.#unsubscribe();
    this.#listeners.clear();
  }

  async reserve(
    owner: MessageOwner,
    reservation: Extract<
      IntentNavigationMessage,
      { type: "intent.navigation.reserve" }
    >,
    command: IntentInvokeMessage,
    reply: (message: IntentReply) => void,
  ): Promise<void> {
    if (
      reservation.callerWindowId !== owner.windowId ||
      this.#pending.has(reservation.reservationId) ||
      this.#pending.size >= this.#options.maxPending
    ) {
      reply(
        resultMessage(
          command,
          failure(
            command.request.archetype,
            command.request.action ?? "open",
            "denied",
          ),
        ),
      );
      return;
    }
    const selection = this.select(command.request);
    if (!selection.ok) {
      reply(resultMessage(command, selection.result));
      return;
    }
    const account = this.#options.account();
    if (
      !account || account !== selection.candidate.accountPubkey ||
      !policyAllows(reservation.mode, command)
    ) {
      reply(
        resultMessage(
          command,
          failure(
            command.request.archetype,
            command.request.action ?? "open",
            "denied",
          ),
        ),
      );
      return;
    }
    const targetWindowId = this.#options.createId();
    const timer = this.#options.setTimeout(() => {
      const pending = this.#pending.get(reservation.reservationId);
      if (pending) this.#settle(pending, "failed");
    }, this.#options.timeoutMs);
    const pending: PendingInvocation = {
      owner,
      reservationId: reservation.reservationId,
      invocationId: reservation.invocationId,
      command,
      reply,
      generation: selection.generation,
      candidate: selection.candidate,
      targetWindowId,
      timer,
      ticket: null,
      terminal: false,
    };
    this.#pending.set(reservation.reservationId, pending);
    const launched = await this.#catalog.launch(
      selection.candidate.catalogEventId,
      selection.candidate.coordinate,
      selection.candidate.manifestEventId,
    );
    if (
      !launched.ok || !this.isCurrent(selection.generation) ||
      this.#options.account() !== account || pending.terminal
    ) {
      this.#settle(pending, "failed");
      return;
    }
    const ticket = this.#options.createId();
    pending.ticket = ticket;
    this.#tickets.set(
      ticket,
      Object.freeze({
        reservationId: reservation.reservationId,
        invocationId: reservation.invocationId,
        accountPubkey: account,
        caller: owner,
        candidate: selection.candidate,
        convention: selection.request.convention,
        payload: selection.request.payload,
        targetWindowId,
        generation: selection.generation,
        expiresAt: this.#options.now() + this.#options.timeoutMs,
        launch: launched.value.launch,
      }),
    );
    this.#options.sendNavigation(
      Object.freeze({
        type: "intent.navigation.authorized",
        reservationId: reservation.reservationId,
        invocationId: reservation.invocationId,
        targetWindowId,
        ticket,
        launchPath: createReservedIntentLaunchPath({
          reservationId: reservation.reservationId,
          ticket,
          targetWindowId,
          generation: selection.generation,
        }),
        generation: selection.generation,
      }),
      owner,
    );
  }

  claim(
    owner: MessageOwner,
    claim: Extract<IntentNavigationMessage, { type: "intent.ticket.claim" }>,
  ): Readonly<Record<string, unknown>> | null {
    const ticket = this.#tickets.get(claim.ticket);
    const pending = this.#pending.get(claim.reservationId);
    if (
      !ticket || !pending || pending.terminal ||
      ticket.reservationId !== claim.reservationId ||
      ticket.targetWindowId !== claim.targetWindowId ||
      ticket.generation !== claim.generation ||
      owner.windowId !== ticket.targetWindowId ||
      this.#options.account() !== ticket.accountPubkey ||
      !this.isCurrent(ticket.generation) ||
      this.#options.now() > ticket.expiresAt
    ) return null;
    this.#tickets.delete(claim.ticket);
    return Object.freeze({
      invocationId: ticket.invocationId,
      archetype: ticket.candidate.archetype,
      action: pending.command.request.action ?? "open",
      convention: ticket.convention,
      payload: ticket.payload,
      handler: ticket.candidate.dTag,
      manifestEventId: ticket.candidate.manifestEventId,
      identity: Object.freeze({
        dTag: ticket.launch.dTag,
        aggregateHash: ticket.launch.aggregateHash,
      }),
      srcdoc: ticket.launch.srcdoc,
    });
  }

  acknowledge(
    owner: MessageOwner,
    ack: Extract<IntentNavigationMessage, { type: "intent.navigation.ack" }>,
  ): boolean {
    const pending = this.#pending.get(ack.reservationId);
    if (
      !pending || pending.terminal ||
      pending.invocationId !== ack.invocationId ||
      pending.owner.connectionId !== owner.connectionId ||
      pending.owner.windowId !== owner.windowId
    ) return false;
    this.#settle(pending, ack.state === "committed" ? "handled" : "failed");
    return true;
  }

  abortWindow(windowId: string): void {
    for (const pending of [...this.#pending.values()]) {
      if (
        pending.owner.windowId === windowId ||
        pending.targetWindowId === windowId
      ) {
        this.#settle(pending, "failed");
      }
    }
  }

  #settle(pending: PendingInvocation, outcome: "handled" | "failed"): void {
    if (pending.terminal) return;
    pending.terminal = true;
    this.#pending.delete(pending.reservationId);
    if (pending.ticket) this.#tickets.delete(pending.ticket);
    this.#options.clearTimeout(pending.timer);
    const request = pending.command.request;
    const result = outcome === "handled"
      ? Object.freeze({
        ok: true,
        archetype: request.archetype,
        action: request.action ?? "open",
        handled: true,
        handler: pending.candidate.dTag,
        windowId: pending.targetWindowId,
        ...(request.convention ? { convention: request.convention } : {}),
      })
      : failure(request.archetype, request.action ?? "open", "failed");
    pending.reply(resultMessage(pending.command, result));
  }

  subscribe(listener: (message: IntentNotification) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  generation(): number {
    return this.#generation;
  }

  handlers(): readonly IntentAvailability[] {
    return Object.freeze(
      [...this.#lastGood.values()].sort((a, b) =>
        a.archetype.localeCompare(b.archetype)
      ),
    );
  }

  available(archetype: string): IntentAvailability {
    return this.#lastGood.get(archetype) ?? Object.freeze({
      archetype,
      available: false,
      candidates: [],
      hasDefault: false,
    });
  }

  isCurrent(generation: number): boolean {
    return generation === this.#generation;
  }

  select(request: IntentRequest): IntentSelection {
    const action = request.action ?? "open";
    if (
      !ARCHETYPE.test(request.archetype) || !ARCHETYPE.test(action) ||
      (request.convention !== undefined &&
        (!CONVENTION.test(request.convention) ||
          request.convention !== `napplet:${request.archetype}/${action}`))
    ) {
      return {
        ok: false,
        result: failure(request.archetype, action, "denied"),
      };
    }
    if (request.handler === "choose") {
      return {
        ok: false,
        result: failure(request.archetype, action, "denied"),
      };
    }
    const eligible = (this.#registry.get(request.archetype) ?? []).filter((
      candidate,
    ) =>
      candidate.actions.includes(action) &&
      (request.convention === undefined ||
        candidate.conventions.includes(request.convention))
    );
    if (eligible.length === 0) {
      return {
        ok: false,
        result: failure(request.archetype, action, "unavailable"),
      };
    }
    let candidate: AuthorityCandidate | undefined;
    if (request.handler && request.handler !== "default") {
      const matches = eligible.filter((entry) =>
        entry.dTag === request.handler
      );
      if (matches.length !== 1) {
        return {
          ok: false,
          result: failure(request.archetype, action, "denied"),
        };
      }
      candidate = matches[0];
    } else candidate = eligible[0];
    return Object.freeze({
      ok: true,
      generation: this.#generation,
      candidate,
      request: Object.freeze({ ...request, action }),
    });
  }

  unavailable(request: IntentRequest): IntentResult {
    return Object.freeze({
      ok: false,
      archetype: request.archetype,
      action: request.action ?? "open",
      handled: false,
      error: "unavailable",
    });
  }

  #rebuild(): void {
    const snapshot = this.#catalog.authoritySnapshot();
    const previous = this.#lastGood;
    const next = new Map<string, AuthorityCandidate[]>();
    if (snapshot.accountPubkey && snapshot.catalogEventId) {
      for (const entry of snapshot.artifacts) {
        const grouped = new Map<
          string,
          { actions: string[]; conventions: string[] }
        >();
        for (const declaration of entry.artifact.declarations) {
          const group = grouped.get(declaration.archetype) ?? {
            actions: [],
            conventions: [],
          };
          if (!group.actions.includes(declaration.action)) {
            group.actions.push(declaration.action);
          }
          if (!group.conventions.includes(declaration.convention)) {
            group.conventions.push(declaration.convention);
          }
          grouped.set(declaration.archetype, group);
        }
        for (const [archetype, declaration] of grouped) {
          const candidate = Object.freeze({
            accountPubkey: snapshot.accountPubkey,
            catalogEventId: snapshot.catalogEventId,
            coordinate: entry.coordinate,
            manifestEventId: entry.acceptedManifestEventId,
            dTag: entry.artifact.launch.dTag,
            aggregateHash: entry.artifact.launch.aggregateHash,
            title: entry.artifact.title,
            archetype,
            actions: Object.freeze(declaration.actions),
            conventions: Object.freeze(declaration.conventions),
          });
          const candidates = next.get(archetype) ?? [];
          candidates.push(candidate);
          next.set(archetype, candidates);
        }
      }
    }
    this.#generation++;
    for (const pending of [...this.#pending.values()]) {
      if (pending.generation !== this.#generation) {
        this.#settle(pending, "failed");
      }
    }
    this.#registry = new Map([...next].map(([archetype, candidates]) => {
      candidates.sort((a, b) =>
        a.dTag.localeCompare(b.dTag) ||
        a.manifestEventId.localeCompare(b.manifestEventId)
      );
      return [archetype, Object.freeze(candidates)] as const;
    }));
    const changed = new Map<string, IntentAvailability>();
    for (const [archetype, candidates] of this.#registry) {
      const projected: IntentCandidate[] = candidates.map((candidate, index) =>
        Object.freeze({
          dTag: candidate.dTag,
          title: candidate.title,
          actions: Object.freeze([...candidate.actions]) as unknown as string[],
          conventions: Object.freeze([
            ...candidate.conventions,
          ]) as unknown as string[],
          ...(index === 0 ? { isDefault: true } : {}),
        })
      );
      changed.set(
        archetype,
        Object.freeze({
          archetype,
          available: projected.length > 0,
          candidates: Object.freeze(projected) as unknown as IntentCandidate[],
          hasDefault: projected.length > 0,
        }),
      );
    }
    if (
      changed.size > 0 || !snapshot.accountPubkey ||
      !["refreshing", "stale", "error"].includes(snapshot.status ?? "idle")
    ) this.#lastGood = changed;
    const notifications = new Map(changed);
    for (const archetype of previous.keys()) {
      if (this.#lastGood.has(archetype)) continue;
      notifications.set(
        archetype,
        Object.freeze({
          archetype,
          available: false,
          candidates: Object.freeze([]) as unknown as IntentCandidate[],
          hasDefault: false,
        }),
      );
    }
    for (const availability of notifications.values()) {
      const message = Object.freeze({
        type: "intent.changed" as const,
        availability,
      });
      for (const listener of this.#listeners) listener(message);
    }
  }
}

const ARCHETYPE = /^[a-z][a-z0-9-]{0,127}$/;
const CONVENTION = /^napplet:[^/?#\s]+\/[^/?#\s]+$/;

function failure(
  archetype: string,
  action: string,
  error: "unavailable" | "denied" | "failed",
): IntentResult {
  return Object.freeze({ ok: false, archetype, action, handled: false, error });
}

function resultMessage(
  command: IntentInvokeMessage,
  result: IntentResult,
): IntentInvokeResultMessage {
  return Object.freeze({
    type: "intent.invoke.result",
    id: command.id,
    result,
  });
}

function policyAllows(
  mode: IntentNavigationMode,
  command: IntentInvokeMessage,
): boolean {
  const behavior = command.request.behavior;
  if (mode === "new-tab") return behavior?.newWindow === true;
  if (mode === "reuse") return behavior?.reuse !== false;
  return behavior?.newWindow !== true;
}
