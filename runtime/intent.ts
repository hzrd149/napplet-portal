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
} from "@napplet/nap/intent";
import type { CatalogService } from "./catalog.ts";

export type IntentCommand =
  | IntentInvokeMessage
  | IntentAvailableMessage
  | IntentHandlersMessage;
export type IntentNotification = IntentChangedMessage;

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

  constructor(catalog: CatalogService) {
    this.#catalog = catalog;
    this.#unsubscribe = catalog.subscribe(() => this.#rebuild());
    this.#rebuild();
  }

  destroy(): void {
    this.#unsubscribe();
    this.#listeners.clear();
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
    for (const availability of changed.values()) {
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
