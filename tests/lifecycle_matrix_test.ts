import {
  ConnectionRegistry,
  PendingCorrelations,
} from "../runtime/connections.ts";
import {
  CONTRACT_DOMAINS,
  CONTRACT_REGISTRY,
  type ContractDomain,
} from "../runtime/nap_contract_registry.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class FakeClock {
  readonly timers = new Map<number, () => void>();
  #next = 1;

  setTimeout = (callback: () => void): number => {
    const id = this.#next++;
    this.timers.set(id, callback);
    return id;
  };

  clearTimeout = (id: number): void => {
    this.timers.delete(id);
  };

  flush(): void {
    const callbacks = [...this.timers.values()];
    this.timers.clear();
    callbacks.forEach((callback) => callback());
  }
}

Deno.test("lifecycle tracer streams partial truth through reconnect and teardown", () => {
  const clock = new FakeClock();
  const delivered: string[] = [];
  const closed: string[] = [];
  let id = 0;
  const registry = new ConnectionRegistry({
    graceMs: 100,
    createId: () => `id-${++id}`,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
  });
  const first = registry.attach((message) => delivered.push(String(message)));
  const window = registry.createWindow(first.connectionId);
  const stream = (name: string) => ({
    emit: (value: string) => registry.send(first.connectionId, value),
    unsubscribe: () => closed.push(name),
  });

  const partial = stream("partial");
  registry.trackSubscription(
    first.connectionId,
    window.windowId,
    "stream",
    partial,
  );
  partial.emit("partial");
  assert(delivered.join(",") === "partial", "partial truth is immediate");

  registry.detach(first.connectionId, first.generation);
  partial.emit("stale");
  assert(delivered.join(",") === "partial", "detached delivery stays stale");
  const resumed = registry.attach(
    (message) => delivered.push(String(message)),
    first.reconnectToken,
  );
  assert(resumed.resumed, "logical connection resumes inside grace");
  partial.emit("updating");
  assert(
    delivered.join(",") === "partial,updating",
    "updates continue in order after reconnect",
  );

  const replacement = stream("replacement");
  registry.trackSubscription(
    first.connectionId,
    window.windowId,
    "stream",
    replacement,
  );
  assert(closed.join(",") === "partial", "replacement closes stale work");
  registry.detach(first.connectionId, first.generation);
  assert(
    registry.isCurrentAttachment(first.connectionId, resumed.generation),
    "a stale close cannot detach the replacement attachment",
  );
  registry.detach(first.connectionId, resumed.generation);
  clock.flush();
  assert(closed.join(",") === "partial,replacement", "expiry closes work");
  assert(registry.subscriptionCount === 0, "expiry leaves no subscriptions");

  const pending = new PendingCorrelations({
    timeoutMs: 100,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    onTimeout: () => {},
  });
  pending.register("late");
  assert(Number(pending.pendingCount) === 1, "correlation is pending");
  pending.destroy();
  assert(Number(pending.pendingCount) === 0, "shutdown leaves no pending work");
  assert(clock.timers.size === 0, "shutdown clears deterministic timers");
});

const LIFECYCLE_STATES = [
  "normal",
  "empty",
  "partial",
  "stale",
  "denied",
  "timeout",
  "reconnect",
  "replacement",
  "shutdown",
  "mixed-settlement",
] as const;

type LifecycleState = typeof LIFECYCLE_STATES[number];

const DOMAIN_EVIDENCE: Record<
  ContractDomain,
  Partial<Record<LifecycleState, string>>
> = {
  shell: {
    normal: "tests/iframe_bridge_test.ts",
    empty: "tests/runtime_contract_test.ts",
    stale: "tests/connection_controller_test.ts",
    denied: "tests/adversarial_browser_lifecycle_test.ts",
    timeout: "tests/connection_controller_test.ts",
    reconnect: "tests/runtime_reconnect_smoke_test.ts",
    replacement: "tests/connection_controller_test.ts",
    shutdown: "tests/websocket_session_test.ts",
  },
  identity: {
    normal: "tests/runtime_contract_test.ts",
    empty: "tests/identity_service_test.ts",
    partial: "tests/identity_service_test.ts",
    stale: "tests/adversarial_authority_test.ts",
    denied: "tests/adversarial_authority_test.ts",
    timeout: "tests/connection_controller_test.ts",
    reconnect: "tests/runtime_reconnect_smoke_test.ts",
    replacement: "tests/adversarial_authority_test.ts",
    shutdown: "tests/websocket_session_test.ts",
  },
  relay: {
    normal: "tests/relay_stream_test.ts",
    empty: "tests/relay_stream_test.ts",
    partial: "tests/relay_stream_test.ts",
    stale: "tests/tracer_end_to_end_test.ts",
    denied: "tests/relay_policy_test.ts",
    timeout: "tests/relay_stream_test.ts",
    reconnect: "tests/lifecycle_matrix_test.ts",
    replacement: "tests/lifecycle_matrix_test.ts",
    shutdown: "tests/lifecycle_matrix_test.ts",
    "mixed-settlement": "tests/outbox_test.ts",
  },
  outbox: {
    normal: "tests/outbox_test.ts",
    empty: "tests/outbox_test.ts",
    partial: "tests/outbox_test.ts",
    stale: "tests/adversarial_authority_test.ts",
    denied: "tests/adversarial_authority_test.ts",
    timeout: "tests/outbox_test.ts",
    reconnect: "tests/lifecycle_matrix_test.ts",
    replacement: "tests/lifecycle_matrix_test.ts",
    shutdown: "tests/lifecycle_matrix_test.ts",
    "mixed-settlement": "tests/outbox_test.ts",
  },
  resource: {
    normal: "tests/resource_service_test.ts",
    empty: "tests/resource_service_test.ts",
    partial: "tests/resource_service_test.ts",
    stale: "tests/adversarial_transport_transfer_test.ts",
    denied: "tests/resource_policy_test.ts",
    timeout: "tests/binary_transport_test.ts",
    reconnect: "tests/adversarial_transport_transfer_test.ts",
    replacement: "tests/adversarial_transport_transfer_test.ts",
    shutdown: "tests/binary_transport_test.ts",
    "mixed-settlement": "tests/resource_service_test.ts",
  },
  upload: {
    normal: "tests/upload_service_test.ts",
    empty: "tests/upload_service_test.ts",
    partial: "tests/upload_service_test.ts",
    stale: "tests/adversarial_transport_transfer_test.ts",
    denied: "tests/resource_policy_test.ts",
    timeout: "tests/binary_transport_test.ts",
    reconnect: "tests/adversarial_transport_transfer_test.ts",
    replacement: "tests/adversarial_transport_transfer_test.ts",
    shutdown: "tests/binary_transport_test.ts",
    "mixed-settlement": "tests/upload_service_test.ts",
  },
  common: {
    normal: "tests/common_runtime_integration_test.ts",
    empty: "tests/common_service_test.ts",
    partial: "tests/common_service_test.ts",
    stale: "tests/adversarial_authority_test.ts",
    denied: "tests/adversarial_authority_test.ts",
    timeout: "tests/common_service_test.ts",
    reconnect: "tests/lifecycle_matrix_test.ts",
    replacement: "tests/adversarial_authority_test.ts",
    shutdown: "tests/websocket_session_test.ts",
    "mixed-settlement": "tests/common_service_test.ts",
  },
  storage: {
    normal: "tests/storage_service_test.ts",
    empty: "tests/storage_service_test.ts",
    partial: "tests/common_storage_runtime_test.ts",
    stale: "tests/adversarial_storage_test.ts",
    denied: "tests/adversarial_storage_test.ts",
    timeout: "tests/storage_service_test.ts",
    reconnect: "tests/lifecycle_matrix_test.ts",
    replacement: "tests/adversarial_storage_test.ts",
    shutdown: "tests/storage_service_test.ts",
    "mixed-settlement": "tests/storage_service_test.ts",
  },
  intent: {
    normal: "tests/intent_runtime_test.ts",
    empty: "tests/intent_runtime_test.ts",
    partial: "tests/intent_production_test.ts",
    stale: "tests/adversarial_browser_lifecycle_test.ts",
    denied: "tests/adversarial_authority_test.ts",
    timeout: "tests/intent_runtime_test.ts",
    reconnect: "tests/runtime_reconnect_smoke_test.ts",
    replacement: "tests/adversarial_browser_lifecycle_test.ts",
    shutdown: "tests/intent_runtime_test.ts",
    "mixed-settlement": "tests/intent_runtime_test.ts",
  },
  media: {
    normal: "tests/media_transport_smoke_test.ts",
    empty: "tests/media_lifecycle_test.ts",
    partial: "tests/media_transport_smoke_test.ts",
    stale: "tests/media_generation_regression_test.ts",
    denied: "tests/media_authority_test.ts",
    timeout: "tests/media_transport_smoke_test.ts",
    reconnect: "tests/media_transport_smoke_test.ts",
    replacement: "tests/media_lifecycle_test.ts",
    shutdown: "tests/media_lifecycle_test.ts",
  },
};

Deno.test("every supported contract row joins complete lifecycle evidence", async () => {
  const missing: string[] = [];
  for (const domain of CONTRACT_DOMAINS) {
    for (const state of LIFECYCLE_STATES) {
      const file = DOMAIN_EVIDENCE[domain][state];
      if (!file) {
        missing.push(`${domain}:${state}`);
        continue;
      }
      try {
        await Deno.stat(file);
      } catch {
        missing.push(`${domain}:${state}:${file}`);
      }
    }
  }
  for (const row of CONTRACT_REGISTRY) {
    if (row.disposition !== "SUPPORTED") continue;
    if (!DOMAIN_EVIDENCE[row.domain].normal) {
      missing.push(`${row.direction}:${row.discriminant}:normal`);
    }
  }
  assert(
    missing.length === 0,
    `missing lifecycle evidence:\n${missing.join("\n")}`,
  );
});
