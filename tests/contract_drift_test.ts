import {
  type ContractDriftInput,
  generateContractDriftReport,
} from "../runtime/contract_report.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const baseInput: ContractDriftInput = {
  generatedAt: "2026-07-30T00:00:00.000Z",
  pinned: {
    "@kehto/runtime": "0.20.1",
    "@napplet/core": "0.31.0",
    "@napplet/nap": "0.31.0",
  },
  siblingRevision: "reference-revision",
  contracts: [
    {
      contract: "relay",
      siblingPath: "relay/types.ts",
      expectedMarkers: ["RelaySubscribeMessage", "RelayClosedMessage"],
      adapterCoverage: [
        "runtime/relay_adapter.ts",
        "tests/runtime_contract_test.ts",
      ],
    },
  ],
};

Deno.test("contract drift report records matching and mismatching references without throwing", async () => {
  const matching = await generateContractDriftReport(
    baseInput,
    () =>
      Promise.resolve(
        "interface RelaySubscribeMessage {} interface RelayClosedMessage {}",
      ),
  );
  const mismatching = await generateContractDriftReport(
    baseInput,
    () => Promise.resolve("interface RelaySubscribeMessage {}"),
  );

  assert(matching.entries[0]?.status === "matching", "markers should match");
  assert(
    mismatching.entries[0]?.status === "mismatch",
    "missing marker is drift",
  );
  assert(
    mismatching.entries[0]?.missingMarkers[0] === "RelayClosedMessage",
    "report must name the missing contract marker",
  );
  assert(
    mismatching.authority === "pinned-packages",
    "sibling drift must never become executable authority",
  );
});

Deno.test("contract drift report converts missing and unreadable siblings into stable entries", async () => {
  for (
    const error of [
      new Deno.errors.NotFound("missing"),
      new Deno.errors.PermissionDenied("unreadable"),
    ]
  ) {
    const report = await generateContractDriftReport(baseInput, () => {
      throw error;
    });
    assert(report.entries[0]?.status === "unavailable", "I/O drift is data");
    assert(
      report.entries[0]?.detail ===
        (error instanceof Deno.errors.NotFound ? "missing" : "unreadable"),
      "availability detail must be stable and sanitized",
    );
  }
});

Deno.test("parallel drift generation is deterministic and isolated", async () => {
  const [one, two] = await Promise.all([
    generateContractDriftReport(baseInput, () => Promise.resolve("")),
    generateContractDriftReport(
      baseInput,
      () => Promise.resolve("RelaySubscribeMessage RelayClosedMessage"),
    ),
  ]);
  assert(one.entries[0]?.status === "mismatch", "first run keeps its input");
  assert(two.entries[0]?.status === "matching", "second run keeps its input");
  assert(
    JSON.stringify(one.pinned) === JSON.stringify(two.pinned),
    "pins stable",
  );
});
