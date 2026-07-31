import { assertEquals } from "jsr:@std/assert@1.0.16";
import { parseRequirementTraceability } from "../runtime/nap_contract_registry.ts";

interface TraceabilityLedgerPaths {
  requirements: string;
  roadmap: string;
}

async function resolveV11TraceabilityLedger(
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

  return {
    requirements: `${planningRoot}/milestones/v1.1-REQUIREMENTS.md`,
    roadmap: `${planningRoot}/milestones/v1.1-ROADMAP.md`,
  };
}

Deno.test("all 33 v1.1 requirements map exactly once with honest evidence status", async () => {
  const ledger = await resolveV11TraceabilityLedger();
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
    assertEquals(await resolveV11TraceabilityLedger(planningRoot), {
      requirements: `${planningRoot}/REQUIREMENTS.md`,
      roadmap: `${planningRoot}/ROADMAP.md`,
    });
  } finally {
    await Deno.remove(planningRoot, { recursive: true });
  }
});

Deno.test("v1.1 traceability uses its versioned ledger after archival", async () => {
  const planningRoot = await Deno.makeTempDir();
  try {
    assertEquals(await resolveV11TraceabilityLedger(planningRoot), {
      requirements: `${planningRoot}/milestones/v1.1-REQUIREMENTS.md`,
      roadmap: `${planningRoot}/milestones/v1.1-ROADMAP.md`,
    });
  } finally {
    await Deno.remove(planningRoot, { recursive: true });
  }
});
