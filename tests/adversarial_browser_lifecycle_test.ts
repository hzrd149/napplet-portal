import { EventStore } from "applesauce-core";
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools";
import type { IdentitySnapshot } from "../runtime/accounts.ts";
import {
  CATALOG_IDENTIFIER,
  CatalogService,
  decodeArchetypeDeclarations,
  type VerifiedCatalogArtifact,
} from "../runtime/catalog.ts";
import { type IntentReply, IntentService } from "../runtime/intent.ts";
import { ConnectionRegistry } from "../runtime/connections.ts";
import type { MediaActorRef } from "../runtime/media_reducer.ts";
import { MediaSessionCoordinator } from "../runtime/media_sessions.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const key = generateSecretKey();
const pubkey = getPublicKey(key);
const coordinate = `35129:${"1".repeat(64)}:handler`;
const manifestEventId = "a".repeat(64);

async function intentHarness() {
  let identity: IdentitySnapshot = {
    accountId: pubkey,
    pubkey,
    status: "active",
  };
  const catalog = new CatalogService({
    eventStore: new EventStore(),
    identity: () => identity,
    resolveVerifiedArtifact: () =>
      Promise.resolve<VerifiedCatalogArtifact>({
        manifestEventId,
        title: "Handler",
        version: "1",
        capabilities: [],
        declarations: decodeArchetypeDeclarations([
          ["archetype", "note", "napplet:note/open"],
        ]),
        launch: {
          dTag: "handler",
          aggregateHash: "b".repeat(64),
          srcdoc: "verified",
        },
      }),
    signEvent: () => Promise.reject(new Error("unused")),
    publish: () => Promise.resolve([]),
  });
  catalog.load([finalizeEvent({
    kind: 30078,
    created_at: 1,
    tags: [["d", CATALOG_IDENTIFIER]],
    content: JSON.stringify({
      version: 1,
      entries: [{ coordinate, acceptedManifestEventId: manifestEventId }],
    }),
  }, key)]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const navigation: Record<string, unknown>[] = [];
  let sequence = 0;
  const intents = new IntentService(catalog, {
    account: () => identity.pubkey,
    sendNavigation: (message) => navigation.push(message),
    createId: () => `opaque-${++sequence}`,
  });
  return {
    catalog,
    intents,
    navigation,
    replaceAccount() {
      identity = { accountId: null, pubkey: null, status: "unavailable" };
      catalog.resetAccount();
    },
  };
}

Deno.test("intent lifecycle tracer terminalizes only after claim and commit", async () => {
  const h = await intentHarness();
  const owner = {
    connectionId: "caller-connection",
    windowId: "caller-window",
  };
  const results: IntentReply[] = [];
  await h.intents.reserve(owner, {
    type: "intent.navigation.reserve",
    reservationId: "reservation",
    invocationId: "invocation",
    callerWindowId: owner.windowId,
    mode: "reuse",
  }, {
    type: "intent.invoke",
    id: "correlation",
    request: { archetype: "note", payload: { secret: "bounded" } },
  }, (message) => results.push(message));

  const authorized = h.navigation[0];
  assert(
    authorized?.type === "intent.navigation.authorized",
    "ticket authorized",
  );
  assert(
    h.intents.acknowledge(owner, {
      type: "intent.navigation.ack",
      reservationId: "reservation",
      invocationId: "invocation",
      state: "committed",
    }),
    "caller commit is accepted",
  );
  assert(
    results.length === 0,
    "caller commit alone cannot consume target authority",
  );

  const target = {
    connectionId: "target-connection",
    windowId: String(authorized.targetWindowId),
  };
  const claim = {
    type: "intent.ticket.claim" as const,
    reservationId: "reservation",
    ticket: String(authorized.ticket),
    targetWindowId: String(authorized.targetWindowId),
    generation: Number(authorized.generation),
  };
  assert(
    h.intents.claim(target, claim)?.srcdoc === "verified",
    "target claims once",
  );
  assert(
    Number(results.length) === 1 && results[0].result?.handled,
    "both sides settle success",
  );
  assert(h.intents.claim(target, claim) === null, "ticket replay is inert");
  assert(
    !h.intents.acknowledge(owner, {
      type: "intent.navigation.ack",
      reservationId: "reservation",
      invocationId: "invocation",
      state: "committed",
    }),
    "late acknowledgement is inert",
  );
  assert(Number(results.length) === 1, "correlation terminalizes exactly once");
});

Deno.test("intent lifecycle tracer revokes replacement before late completion", async () => {
  const h = await intentHarness();
  const owner = {
    connectionId: "caller-connection",
    windowId: "caller-window",
  };
  const results: IntentReply[] = [];
  await h.intents.reserve(owner, {
    type: "intent.navigation.reserve",
    reservationId: "stale-reservation",
    invocationId: "stale-invocation",
    callerWindowId: owner.windowId,
    mode: "reuse",
  }, {
    type: "intent.invoke",
    id: "stale-correlation",
    request: { archetype: "note", payload: { secret: "must-not-leak" } },
  }, (message) => results.push(message));
  const authorized = h.navigation[0];
  h.replaceAccount();
  assert(
    results.length === 1 && results[0].result?.error === "failed",
    "replacement fails once",
  );
  assert(
    h.intents.claim({
      connectionId: "late-connection",
      windowId: String(authorized.targetWindowId),
    }, {
      type: "intent.ticket.claim",
      reservationId: "stale-reservation",
      ticket: String(authorized.ticket),
      targetWindowId: String(authorized.targetWindowId),
      generation: Number(authorized.generation),
    }) === null,
    "late target receives no payload",
  );
  assert(
    !h.intents.acknowledge(owner, {
      type: "intent.navigation.ack",
      reservationId: "stale-reservation",
      invocationId: "stale-invocation",
      state: "committed",
    }),
    "late caller completion is inert",
  );
  assert(results.length === 1, "replacement leaves no live correlation");
});

Deno.test("reconnect replacement fences stale attachment generations", () => {
  const timers = new Map<number, () => void>();
  let timerId = 0;
  let id = 0;
  const registry = new ConnectionRegistry({
    createId: () => `id-${++id}`,
    setTimeout: (callback) => {
      const next = ++timerId;
      timers.set(next, callback);
      return next;
    },
    clearTimeout: (target) => timers.delete(target),
  });
  const initial = registry.attach(() => {});
  registry.createWindow(initial.connectionId);
  registry.detach(initial.connectionId, initial.generation);
  const resumed = registry.attach(() => {}, initial.reconnectToken);
  assert(resumed.generation > initial.generation, "resume advances generation");
  const current = registry as ConnectionRegistry & {
    isCurrentAttachment(connectionId: string, generation: number): boolean;
  };
  assert(
    typeof current.isCurrentAttachment === "function",
    "registry exposes an exact attachment-generation fence",
  );
  assert(
    !current.isCurrentAttachment(initial.connectionId, initial.generation),
    "replaced socket generation is stale",
  );
  assert(
    current.isCurrentAttachment(resumed.connectionId, resumed.generation),
    "resumed socket generation is current",
  );
  registry.detach(initial.connectionId, initial.generation);
  assert(timers.size === 0, "late close cannot schedule successor expiry");
});

Deno.test("media lifecycle revokes before grant and terminalizes duplicate work", () => {
  const effects: Array<
    { recipient: MediaActorRef; message: { type: string } }
  > = [];
  const origin = { connectionId: "origin", windowId: "origin-window" };
  const target = { connectionId: "target", windowId: "target-window" };
  const coordinator = new MediaSessionCoordinator({
    createId: () => "media-session",
    deliver: (recipient, message) => {
      effects.push({ recipient, message });
      return true;
    },
  });
  coordinator.connect("account", origin);
  coordinator.connect("account", target);
  const created = coordinator.receive("account", origin, {
    type: "media.session.create",
    id: "create",
    owner: "napplet",
  });
  effects.length = 0;
  const transferred = coordinator.transfer(
    "account",
    target,
    "media-session",
    created.session!.generation,
    "transfer-correlation",
  );
  assert(transferred.accepted, "current transfer is accepted");
  assert(effects[0]?.message.type === "media.command", "old owner stops first");
  assert(
    effects[1]?.message.type === "runtime.media.grant",
    "new grant follows revoke",
  );
  const generation = transferred.session!.generation;
  effects.length = 0;
  const replay = coordinator.transfer(
    "account",
    target,
    "media-session",
    created.session!.generation,
    "transfer-correlation",
  );
  assert(replay.accepted && effects.length === 0, "exact duplicate is inert");
  const conflict = coordinator.stop(
    "account",
    target,
    "media-session",
    generation,
    "transfer-correlation",
  );
  assert(
    !conflict.accepted && conflict.reason === "request-id-conflict",
    "conflict denied",
  );
  coordinator.destroy();
  const stale = coordinator.stop(
    "account",
    target,
    "media-session",
    generation,
    "late-stop",
  );
  assert(
    !stale.accepted && stale.reason === "unknown-session",
    "shutdown is terminal",
  );
  assert(
    coordinator.current("account") === null,
    "terminal state is immediately observable",
  );
});
