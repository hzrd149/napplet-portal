export const CONTRACT_DOMAINS = [
  "shell",
  "identity",
  "relay",
  "outbox",
  "resource",
  "upload",
  "common",
  "storage",
  "intent",
  "media",
] as const;

export type ContractDomain = typeof CONTRACT_DOMAINS[number];
export type ContractDirection = "napplet-to-runtime" | "runtime-to-napplet";
export type ContractDisposition =
  | "SUPPORTED"
  | "EXPLICIT_DENY"
  | "OUT_OF_SCOPE_NOT_ADVERTISED";

export interface ContractRow {
  readonly packageSource: "@napplet/core@0.31.0" | "@napplet/nap@0.31.0";
  readonly discriminant: string;
  readonly direction: ContractDirection;
  readonly domain: ContractDomain;
  readonly grant: string;
  readonly decoder: string;
  readonly owner: string;
  readonly terminal: "result" | "event" | "fire-and-forget" | "handshake";
  readonly requirementIds: readonly string[];
  readonly test: string;
  readonly disposition: ContractDisposition;
  readonly advertised: boolean;
}

export interface ContractMatrixDomain {
  readonly domain: ContractDomain;
  readonly packageSource: ContractRow["packageSource"];
  readonly outbound: readonly string[];
  readonly inbound: readonly string[];
}

const REQUIREMENTS: Readonly<Record<ContractDomain, readonly string[]>> = {
  shell: ["SHL-01", "SHL-02", "SHL-03", "CON-01", "CON-02", "CON-03", "CON-04"],
  identity: ["QLT-01"],
  relay: ["QLT-01"],
  outbox: ["QLT-01"],
  resource: ["RES-01", "RES-02", "RES-03"],
  upload: ["UPL-01", "UPL-02", "UPL-03"],
  common: ["COM-01", "COM-02"],
  storage: ["STO-01", "STO-02", "STO-03"],
  intent: ["INT-01", "INT-02", "INT-03"],
  media: ["MED-01", "MED-02", "MED-03", "MED-04"],
};

const OWNER: Readonly<Record<ContractDomain, string>> = {
  shell: "components/NappletFrame.tsx:createIframeBridge",
  identity: "runtime/portal_runtime.ts:window runtime",
  relay: "runtime/relay_adapter.ts:RelayAdapter",
  outbox: "runtime/outbox.ts:OutboxAdapter",
  resource: "runtime/nap_dispatcher.ts:NapDispatcher",
  upload: "runtime/nap_dispatcher.ts:NapDispatcher",
  common: "runtime/common.ts:CommonService",
  storage: "runtime/storage.ts:StorageService",
  intent: "runtime/intent.ts:IntentService",
  media: "runtime/media_reducer.ts:reduceMediaAuthority",
};

const TEST: Readonly<Record<ContractDomain, string>> = {
  shell: "tests/iframe_bridge_test.ts",
  identity: "tests/runtime_contract_test.ts",
  relay: "tests/tracer_end_to_end_test.ts",
  outbox: "tests/identity_service_test.ts",
  resource: "tests/nap_dispatcher_test.ts",
  upload: "tests/nap_dispatcher_test.ts",
  common: "tests/common_runtime_integration_test.ts",
  storage: "tests/common_storage_runtime_test.ts",
  intent: "tests/intent_production_test.ts",
  media: "tests/media_transport_smoke_test.ts",
};

export function expandContractMatrix(
  matrix: readonly ContractMatrixDomain[],
): ContractRow[] {
  return matrix.flatMap((entry) => [
    ...entry.outbound.map((discriminant) =>
      row(entry, discriminant, "napplet-to-runtime")
    ),
    ...entry.inbound.map((discriminant) =>
      row(entry, discriminant, "runtime-to-napplet")
    ),
  ]);
}

function row(
  entry: ContractMatrixDomain,
  discriminant: string,
  direction: ContractDirection,
): ContractRow {
  const terminal = entry.domain === "shell"
    ? "handshake"
    : discriminant.endsWith(".result") || discriminant.endsWith(".error")
    ? "result"
    : direction === "runtime-to-napplet"
    ? "event"
    : [
        "resource.cancel",
        "media.session.update",
        "media.session.destroy",
        "media.state",
      ].includes(discriminant)
    ? "fire-and-forget"
    : "result";
  return Object.freeze({
    packageSource: entry.packageSource,
    discriminant,
    direction,
    domain: entry.domain,
    grant: entry.domain,
    decoder: entry.domain === "shell"
      ? "createIframeBridge.receive"
      : "decodeRuntimeForward",
    owner: OWNER[entry.domain],
    terminal,
    requirementIds: REQUIREMENTS[entry.domain],
    test: TEST[entry.domain],
    disposition: "SUPPORTED",
    advertised: true,
  });
}

const PRODUCTION_MATRIX: readonly ContractMatrixDomain[] = [
  {
    domain: "shell",
    packageSource: "@napplet/core@0.31.0",
    outbound: ["shell.ready"],
    inbound: ["shell.init"],
  },
  {
    domain: "identity",
    packageSource: "@napplet/nap@0.31.0",
    outbound: [
      "identity.getPublicKey",
      "identity.getRelays",
      "identity.getProfile",
      "identity.getFollows",
      "identity.getList",
      "identity.getZaps",
      "identity.getMutes",
      "identity.getBlocked",
      "identity.getBadges",
    ],
    inbound: [
      "identity.getPublicKey.result",
      "identity.changed",
      "identity.getRelays.result",
      "identity.getProfile.result",
      "identity.getFollows.result",
      "identity.getList.result",
      "identity.getZaps.result",
      "identity.getMutes.result",
      "identity.getBlocked.result",
      "identity.getBadges.result",
    ],
  },
  {
    domain: "relay",
    packageSource: "@napplet/nap@0.31.0",
    outbound: [
      "relay.subscribe",
      "relay.close",
      "relay.publish",
      "relay.publishEncrypted",
      "relay.query",
    ],
    inbound: [
      "relay.event",
      "relay.eose",
      "relay.closed",
      "relay.publish.result",
      "relay.publishEncrypted.result",
      "relay.query.result",
    ],
  },
  {
    domain: "outbox",
    packageSource: "@napplet/nap@0.31.0",
    outbound: [
      "outbox.getEvent",
      "outbox.query",
      "outbox.subscribe",
      "outbox.close",
      "outbox.publish",
      "outbox.resolveRelays",
    ],
    inbound: [
      "outbox.getEvent.result",
      "outbox.query.result",
      "outbox.event",
      "outbox.closed",
      "outbox.publish.result",
      "outbox.resolveRelays.result",
    ],
  },
  {
    domain: "resource",
    packageSource: "@napplet/nap@0.31.0",
    outbound: [
      "resource.info",
      "resource.bytes",
      "resource.bytesMany",
      "resource.cancel",
    ],
    inbound: [
      "resource.info.result",
      "resource.info.error",
      "resource.bytes.result",
      "resource.bytes.error",
      "resource.bytesMany.result",
      "resource.bytesMany.error",
    ],
  },
  {
    domain: "upload",
    packageSource: "@napplet/nap@0.31.0",
    outbound: ["upload.info", "upload.upload", "upload.status"],
    inbound: [
      "upload.info.result",
      "upload.upload.result",
      "upload.status.result",
      "upload.status.changed",
    ],
  },
  {
    domain: "common",
    packageSource: "@napplet/nap@0.31.0",
    outbound: [
      "common.encodeNip19",
      "common.decodeNip19",
      "common.getProfile",
      "common.follows",
      "common.follow",
      "common.unfollow",
      "common.react",
      "common.report",
    ],
    inbound: [
      "common.encodeNip19.result",
      "common.decodeNip19.result",
      "common.getProfile.result",
      "common.follows.result",
      "common.follow.result",
      "common.unfollow.result",
      "common.react.result",
      "common.report.result",
    ],
  },
  {
    domain: "storage",
    packageSource: "@napplet/nap@0.31.0",
    outbound: ["storage.get", "storage.set", "storage.remove", "storage.keys"],
    inbound: [
      "storage.get.result",
      "storage.set.result",
      "storage.remove.result",
      "storage.keys.result",
    ],
  },
  {
    domain: "intent",
    packageSource: "@napplet/nap@0.31.0",
    outbound: ["intent.invoke", "intent.available", "intent.handlers"],
    inbound: [
      "intent.invoke.result",
      "intent.available.result",
      "intent.handlers.result",
      "intent.changed",
    ],
  },
  {
    domain: "media",
    packageSource: "@napplet/nap@0.31.0",
    outbound: [
      "media.session.create",
      "media.session.update",
      "media.session.destroy",
      "media.state",
      "media.capabilities",
    ],
    inbound: ["media.session.create.result", "media.command", "media.controls"],
  },
];

export const CONTRACT_REGISTRY: readonly ContractRow[] = Object.freeze(
  expandContractMatrix(PRODUCTION_MATRIX),
);

function key(row: ContractRow): string {
  return `${row.direction}:${row.discriminant}`;
}

export function auditContractParity(
  canonical: readonly ContractRow[],
  registry: readonly ContractRow[],
) {
  const blockers: string[] = [];
  const canonicalMap = new Map(canonical.map((item) => [key(item), item]));
  const registryMap = new Map(registry.map((item) => [key(item), item]));
  for (const id of canonicalMap.keys()) {
    if (!registryMap.has(id)) blockers.push(`missing:${id}`);
  }
  for (const id of registryMap.keys()) {
    if (!canonicalMap.has(id)) blockers.push(`invented:${id}`);
  }
  for (const [id, expected] of canonicalMap) {
    const actual = registryMap.get(id);
    if (!actual) continue;
    for (
      const field of [
        "packageSource",
        "domain",
        "grant",
        "decoder",
        "owner",
        "terminal",
        "test",
        "disposition",
        "advertised",
      ] as const
    ) {
      if (!actual[field] || actual[field] !== expected[field]) {
        blockers.push(`mismatch:${id}:${field}`);
      }
    }
    if (!actual.requirementIds.length) {
      blockers.push(`missing-evidence:${id}:requirementIds`);
    }
    if ((actual.disposition as string) === "SILENT_IGNORE") {
      blockers.push(`silent-ignore:${id}`);
    }
    if (actual.advertised && actual.disposition !== "SUPPORTED") {
      blockers.push(`advertised-unsupported:${id}`);
    }
    if (!actual.advertised && actual.grant !== "none") {
      blockers.push(`unadvertised-grant:${id}`);
    }
  }
  if (blockers.length) throw new Error(blockers.join("\n"));
  return {
    blockers,
    canonicalCount: canonical.length,
    registeredCount: registry.length,
    domains: new Set(canonical.map((row) => row.domain)).size,
  };
}

export function hasContractGrant(
  grants: readonly string[],
  discriminant: string,
): boolean {
  const row = CONTRACT_REGISTRY.find((candidate) =>
    candidate.direction === "napplet-to-runtime" &&
    candidate.discriminant === discriminant &&
    candidate.disposition === "SUPPORTED" && candidate.advertised
  );
  return Boolean(
    row && grants.some((grant) =>
      grant === row.discriminant || grant === row.domain
    ),
  );
}

export function parseRequirementTraceability(
  requirements: string,
  roadmap: string,
) {
  const requirementSection = requirements.split("## Future Requirements")[0];
  const ids = [
    ...requirementSection.matchAll(/^- \[[ x]\] \*\*([A-Z]+-\d{2})\*\*:/gm),
  ].map((match) => match[1]);
  const traceability = requirements.split("## Traceability")[1] ?? "";
  const mappings = [
    ...traceability.matchAll(
      /^\| ([A-Z0-9, -]+) \| Phase (\d+) \| (Complete|Pending) \|$/gm,
    ),
  ]
    .flatMap((match) =>
      match[1].split(", ").map((id) => ({
        id,
        phase: Number(match[2]),
        status: match[3],
      }))
    );
  const counts = new Map<string, number>();
  for (const mapping of mappings) {
    counts.set(mapping.id, (counts.get(mapping.id) ?? 0) + 1);
  }
  const roadmapMap = new Map<string, number>();
  let phase = 0;
  for (const line of roadmap.split("\n")) {
    const heading = line.match(/^### Phase (\d+):/);
    if (heading) phase = Number(heading[1]);
    const req = line.match(/^\*\*Requirements:\*\* (.+)$/);
    if (req) { for (const id of req[1].split(", ")) roadmapMap.set(id, phase); }
  }
  return {
    ids,
    duplicates: ids.filter((id) => counts.get(id) !== 1),
    unmapped: ids.filter((id) => !counts.has(id)),
    illegalStatuses: mappings.filter((item) =>
      !["Complete", "Pending"].includes(item.status)
    ),
    roadmapMismatches: mappings.filter((item) =>
      roadmapMap.get(item.id) !== item.phase
    ),
    claimContradictions: mappings.filter((item) =>
      requirementSection.includes(`- [x] **${item.id}**:`) &&
      item.status !== "Complete"
    ).map((item) => item.id),
  };
}
