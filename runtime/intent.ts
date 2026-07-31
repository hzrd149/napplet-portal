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
      candidates: Object.freeze([]),
      hasDefault: false,
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
    this.#registry = new Map([...next].map(([archetype, candidates]) => [
      archetype,
      Object.freeze(candidates),
    ]));
    const changed = new Map<string, IntentAvailability>();
    for (const [archetype, candidates] of this.#registry) {
      const projected: IntentCandidate[] = candidates.map((candidate, index) =>
        Object.freeze({
          dTag: candidate.dTag,
          title: candidate.title,
          actions: [...candidate.actions],
          conventions: [...candidate.conventions],
          ...(index === 0 ? { isDefault: true } : {}),
        })
      );
      changed.set(
        archetype,
        Object.freeze({
          archetype,
          available: projected.length > 0,
          candidates: Object.freeze(projected),
          hasDefault: projected.length > 0,
        }),
      );
    }
    this.#lastGood = changed;
    for (const availability of changed.values()) {
      const message = Object.freeze({
        type: "intent.changed" as const,
        availability,
      });
      for (const listener of this.#listeners) listener(message);
    }
  }
}
