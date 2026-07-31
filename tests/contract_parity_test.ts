import { assertEquals, assertThrows } from "jsr:@std/assert";
import matrix from "./fixtures/v1_1_contract_matrix.json" with { type: "json" };
import {
  auditContractParity,
  CONTRACT_REGISTRY,
  type ContractRow,
  expandContractMatrix,
} from "../runtime/nap_contract_registry.ts";

const canonical = expandContractMatrix(matrix as never);

Deno.test("pinned 0.31.0 ten-domain matrix exactly matches production registry", () => {
  assertEquals(auditContractParity(canonical, CONTRACT_REGISTRY), {
    blockers: [],
    canonicalCount: canonical.length,
    registeredCount: CONTRACT_REGISTRY.length,
    domains: 10,
  });
});

Deno.test("fixture literals are extracted exactly from pinned NAP declarations", async () => {
  for (const domain of matrix.filter((entry) => entry.domain !== "shell")) {
    const moduleUrl = import.meta.resolve(`@napplet/nap/${domain.domain}`);
    const declarationUrl = new URL("./types.d.ts", moduleUrl);
    const declaration = await Deno.readTextFile(declarationUrl);
    const extracted = [...declaration.matchAll(/type: '([^']+)'/g)]
      .map((match) => match[1]).filter((value) =>
        value.startsWith(`${domain.domain}.`)
      );
    assertEquals(
      [...new Set(extracted)].sort(),
      [...domain.outbound, ...domain.inbound].sort(),
    );
  }
});

Deno.test("contract parity blocks every malformed or silent disposition", () => {
  const row = canonical[0];
  const mutations: ContractRow[][] = [
    canonical.slice(1),
    [...canonical, { ...row, discriminant: `${row.discriminant}.invented` }],
    canonical.map((item, index) =>
      index ? item : { ...item, direction: "runtime-to-napplet" }
    ),
    canonical.map((item, index) => index ? item : { ...item, test: "" }),
    canonical.map((item, index) =>
      index ? item : { ...item, disposition: "SILENT_IGNORE" as never }
    ),
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
