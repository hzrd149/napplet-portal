import { assertEquals } from "jsr:@std/assert";
import { parseRequirementTraceability } from "../runtime/nap_contract_registry.ts";

Deno.test("all 33 v1.1 requirements map exactly once with honest evidence status", async () => {
  const requirements = await Deno.readTextFile(".planning/REQUIREMENTS.md");
  const roadmap = await Deno.readTextFile(".planning/ROADMAP.md");
  const result = parseRequirementTraceability(requirements, roadmap);
  assertEquals(result.ids.length, 33);
  assertEquals(result.duplicates, []);
  assertEquals(result.unmapped, []);
  assertEquals(result.illegalStatuses, []);
  assertEquals(result.roadmapMismatches, []);
  assertEquals(result.claimContradictions, [
    "CAT-01",
    "CAT-02",
    "CAT-03",
    "CAT-04",
    "COM-01",
    "COM-02",
    "STO-01",
    "STO-02",
    "STO-03",
    "MED-01",
    "MED-02",
    "MED-03",
    "MED-04",
  ]);
});
