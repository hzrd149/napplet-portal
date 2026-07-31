import { assertEquals } from "jsr:@std/assert@1.0.16";
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
  assertEquals(result.claimContradictions, []);
});
