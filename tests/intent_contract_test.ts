import {
  decodeArchetypeDeclarations,
  type VerifiedCatalogArtifact,
} from "../runtime/catalog.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("archetype declaration codec accepts only canonical signed tags", () => {
  const declarations = decodeArchetypeDeclarations([
    ["archetype", "note", "napplet:note/open"],
    ["archetype", "note", "napplet:note/open"],
    ["archetype", "note", "napplet:note/edit"],
    ["archetype", "note", "napplet:note/open", "kind:1"],
    ["archetype", "NAP-01", "napplet:NAP-01/open"],
    ["archetype", "note", "napplet:article/open"],
    ["archetype", "note", "napplet:note/open?draft=1"],
    ["archetype", "note", "napplet:note/open#draft"],
    ["archetype", "note", "napplet:note/"],
  ]);
  assert(
    declarations.length === 2,
    "duplicates collapse and malformed tags omit",
  );
  assert(
    JSON.stringify(declarations) === JSON.stringify([
      { archetype: "note", action: "open", convention: "napplet:note/open" },
      { archetype: "note", action: "edit", convention: "napplet:note/edit" },
    ]),
    "accepted declarations retain stable signed order",
  );
  assert(
    Object.isFrozen(declarations) && declarations.every(Object.isFrozen),
    "declarations are deeply immutable",
  );
});

Deno.test("archetype declaration is part of verified artifact identity", () => {
  const artifact: VerifiedCatalogArtifact = {
    manifestEventId: "a".repeat(64),
    title: "Notes",
    version: "1",
    capabilities: [],
    declarations: decodeArchetypeDeclarations([
      ["archetype", "note", "napplet:note/open"],
    ]),
    launch: {
      dTag: "notes",
      aggregateHash: "b".repeat(64),
      srcdoc: "<main>verified</main>",
    },
  };
  assert(artifact.declarations[0].action === "open", "contract is typed");
});
