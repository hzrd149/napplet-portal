import { assertEquals, assertThrows } from "jsr:@std/assert";
import matrix from "./fixtures/v1_1_contract_matrix.json" with { type: "json" };
import {
  auditContractParity,
  CONTRACT_REGISTRY,
  type ContractRow,
} from "../runtime/nap_contract_registry.ts";

Deno.test("pinned 0.31.0 ten-domain matrix exactly matches production registry", () => {
  assertEquals(auditContractParity(matrix as ContractRow[], CONTRACT_REGISTRY), {
    blockers: [],
    canonicalCount: matrix.length,
    registeredCount: CONTRACT_REGISTRY.length,
    domains: 10,
  });
});

Deno.test("contract parity blocks every malformed or silent disposition", () => {
  const canonical = matrix as ContractRow[];
  const row = canonical[0];
  const mutations: ContractRow[][] = [
    canonical.slice(1),
    [...canonical, { ...row, discriminant: `${row.discriminant}.invented` }],
    canonical.map((item, index) => index ? item : { ...item, direction: "runtime-to-napplet" }),
    canonical.map((item, index) => index ? item : { ...item, test: "" }),
    canonical.map((item, index) => index ? item : { ...item, disposition: "SILENT_IGNORE" as never }),
  ];
  for (const registry of mutations) {
    assertThrows(() => auditContractParity(canonical, registry));
  }
});

Deno.test("every advertised row is supported and every non-advertised row is absent from grants", () => {
  for (const row of CONTRACT_REGISTRY) {
    if (row.advertised) assertEquals(row.disposition, "SUPPORTED");
    if (row.disposition === "OUT_OF_SCOPE_NOT_ADVERTISED") {
      assertEquals(row.advertised, false);
      assertEquals(row.grant, "none");
    }
  }
});
