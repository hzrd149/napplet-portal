export type ContractDriftStatus = "matching" | "mismatch" | "unavailable";

export interface ContractDriftEntry {
  readonly contract: string;
  readonly status: ContractDriftStatus;
  readonly detail: "available" | "missing" | "unreadable";
  readonly pinnedPackages: Readonly<Record<string, string>>;
  readonly siblingRevision: string | null;
  readonly missingMarkers: readonly string[];
  readonly adapterCoverage: readonly string[];
}

export interface ContractDriftReport {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly authority: "pinned-packages";
  readonly blocking: false;
  readonly pinned: Readonly<Record<string, string>>;
  readonly siblingRevision: string | null;
  readonly entries: readonly ContractDriftEntry[];
}

export interface ContractDriftContract {
  readonly contract: string;
  readonly siblingPath: string;
  readonly expectedMarkers: readonly string[];
  readonly adapterCoverage: readonly string[];
  readonly pinnedPackages?: readonly string[];
  readonly siblingRevision?: string | null;
}

export interface ContractDriftInput {
  readonly generatedAt: string;
  readonly pinned: Readonly<Record<string, string>>;
  readonly siblingRevision: string | null;
  readonly contracts: readonly ContractDriftContract[];
}

export async function generateContractDriftReport(
  input: ContractDriftInput,
  readText: (path: string) => Promise<string> = Deno.readTextFile,
): Promise<ContractDriftReport> {
  const entries = await Promise.all(input.contracts.map(async (contract) => {
    try {
      const source = await readText(contract.siblingPath);
      const missingMarkers = contract.expectedMarkers.filter((marker) =>
        !source.includes(marker)
      );
      return {
        contract: contract.contract,
        status: missingMarkers.length === 0 ? "matching" : "mismatch",
        detail: "available",
        pinnedPackages: Object.fromEntries(
          (contract.pinnedPackages ?? Object.keys(input.pinned)).map((name) => [
            name,
            input.pinned[name],
          ]),
        ),
        siblingRevision: contract.siblingRevision ?? input.siblingRevision,
        missingMarkers,
        adapterCoverage: contract.adapterCoverage,
      } satisfies ContractDriftEntry;
    } catch (error) {
      return {
        contract: contract.contract,
        status: "unavailable",
        detail: error instanceof Deno.errors.NotFound
          ? "missing"
          : "unreadable",
        pinnedPackages: Object.fromEntries(
          (contract.pinnedPackages ?? Object.keys(input.pinned)).map((name) => [
            name,
            input.pinned[name],
          ]),
        ),
        siblingRevision: contract.siblingRevision ?? input.siblingRevision,
        missingMarkers: [...contract.expectedMarkers],
        adapterCoverage: contract.adapterCoverage,
      } satisfies ContractDriftEntry;
    }
  }));
  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt,
    authority: "pinned-packages",
    blocking: false,
    pinned: input.pinned,
    siblingRevision: input.siblingRevision,
    entries,
  };
}

async function siblingRevision(path: string): Promise<string | null> {
  try {
    const command = new Deno.Command("git", {
      args: ["-C", path, "rev-parse", "HEAD"],
      stdout: "piped",
      stderr: "null",
    });
    const result = await command.output();
    return result.success
      ? new TextDecoder().decode(result.stdout).trim() || null
      : null;
  } catch {
    return null;
  }
}

if (import.meta.main) {
  const output = Deno.args[0] ??
    ".planning/phases/02-backend-runtime-expansion/02-CONTRACT-DRIFT.json";
  const report = await generateContractDriftReport({
    generatedAt: new Date().toISOString(),
    pinned: {
      "@kehto/runtime": "0.20.1",
      "@napplet/core": "0.31.0",
      "@napplet/nap": "0.31.0",
    },
    siblingRevision: null,
    contracts: [
      {
        contract: "kehto-runtime-relay",
        siblingPath: "../kehto/packages/runtime/src/relay-handler.ts",
        expectedMarkers: ["relay.eose", "relay.closed"],
        pinnedPackages: ["@kehto/runtime", "@napplet/core", "@napplet/nap"],
        siblingRevision: await siblingRevision("../kehto"),
        adapterCoverage: [
          "runtime/relay_adapter.ts",
          "tests/end_to_end_test.ts",
        ],
      },
      {
        contract: "napplet-core-nostr",
        siblingPath: "../napplet/packages/core/src/types/nostr.ts",
        expectedMarkers: ["NostrEvent", "RelayEventResult", "NostrFilter"],
        pinnedPackages: ["@napplet/core"],
        siblingRevision: await siblingRevision("../napplet"),
        adapterCoverage: [
          "runtime/transport.ts",
          "tests/runtime_contract_test.ts",
        ],
      },
      {
        contract: "napplet-nap-relay-outbox",
        siblingPath: "../napplet/packages/nap/src/relay/types.ts",
        expectedMarkers: ["RelaySubscribeMessage", "RelayClosedMessage"],
        pinnedPackages: ["@napplet/core", "@napplet/nap"],
        siblingRevision: await siblingRevision("../napplet"),
        adapterCoverage: ["runtime/relay_adapter.ts", "runtime/outbox.ts"],
      },
    ],
  });
  await Deno.writeTextFile(output, `${JSON.stringify(report, null, 2)}\n`);
}
