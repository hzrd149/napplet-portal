import { assertEquals } from "jsr:@std/assert@1.0.16";
import { parseRequirementTraceability } from "../runtime/nap_contract_registry.ts";

interface TraceabilityLedgerPaths {
  requirements: string;
  roadmap: string;
}

function parseArchivedVersion(name: string): number[] | undefined {
  const match = /^v(\d+)\.(\d+)(?:\.(\d+))?-REQUIREMENTS\.md$/.exec(name);
  return match
    ? [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)]
    : undefined;
}

function compareVersions(left: number[], right: number[]): number {
  for (let index = 0; index < 3; index += 1) {
    const difference = left[index] - right[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

async function resolveTraceabilityLedger(
  planningRoot = ".planning",
): Promise<TraceabilityLedgerPaths> {
  const active = {
    requirements: `${planningRoot}/REQUIREMENTS.md`,
    roadmap: `${planningRoot}/ROADMAP.md`,
  };

  try {
    await Deno.stat(active.requirements);
    return active;
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }

  const milestonesRoot = `${planningRoot}/milestones`;
  const candidates: { version: number[]; prefix: string }[] = [];
  for await (const entry of Deno.readDir(milestonesRoot)) {
    if (!entry.isFile) continue;
    const version = parseArchivedVersion(entry.name);
    if (!version) continue;
    const prefix = entry.name.slice(0, -"-REQUIREMENTS.md".length);
    try {
      const roadmap = await Deno.stat(`${milestonesRoot}/${prefix}-ROADMAP.md`);
      if (roadmap.isFile) candidates.push({ version, prefix });
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }
  candidates.sort((left, right) =>
    compareVersions(right.version, left.version)
  );
  const latest = candidates[0];
  if (!latest) {
    throw new Deno.errors.NotFound(
      "No active or complete archived requirement traceability ledger found",
    );
  }
  return {
    requirements: `${milestonesRoot}/${latest.prefix}-REQUIREMENTS.md`,
    roadmap: `${milestonesRoot}/${latest.prefix}-ROADMAP.md`,
  };
}

Deno.test("all 33 v1.1 requirements map exactly once with honest evidence status", async () => {
  const ledger = await resolveTraceabilityLedger();
  const requirements = await Deno.readTextFile(ledger.requirements);
  const roadmap = await Deno.readTextFile(ledger.roadmap);
  const result = parseRequirementTraceability(requirements, roadmap);
  assertEquals(result.ids.length, 33);
  assertEquals(result.duplicates, []);
  assertEquals(result.unmapped, []);
  assertEquals(result.illegalStatuses, []);
  assertEquals(result.roadmapMismatches, []);
  assertEquals(result.claimContradictions, []);
});

Deno.test("v1.1 traceability uses the active ledger before archival", async () => {
  const planningRoot = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(`${planningRoot}/REQUIREMENTS.md`, "active");
    assertEquals(await resolveTraceabilityLedger(planningRoot), {
      requirements: `${planningRoot}/REQUIREMENTS.md`,
      roadmap: `${planningRoot}/ROADMAP.md`,
    });
  } finally {
    await Deno.remove(planningRoot, { recursive: true });
  }
});

Deno.test("traceability uses the newest complete versioned ledger after archival", async () => {
  const planningRoot = await Deno.makeTempDir();
  try {
    await Deno.mkdir(`${planningRoot}/milestones`);
    for (const version of ["v1.2", "v1.10"]) {
      await Deno.writeTextFile(
        `${planningRoot}/milestones/${version}-REQUIREMENTS.md`,
        version,
      );
      await Deno.writeTextFile(
        `${planningRoot}/milestones/${version}-ROADMAP.md`,
        version,
      );
    }
    await Deno.writeTextFile(
      `${planningRoot}/milestones/v2.0-REQUIREMENTS.md`,
      "incomplete archive",
    );
    assertEquals(await resolveTraceabilityLedger(planningRoot), {
      requirements: `${planningRoot}/milestones/v1.10-REQUIREMENTS.md`,
      roadmap: `${planningRoot}/milestones/v1.10-ROADMAP.md`,
    });
  } finally {
    await Deno.remove(planningRoot, { recursive: true });
  }
});
