import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "jsr:@std/assert@1.0.16";
import { renderToString } from "npm:preact-render-to-string@^6.6.3";
import {
  type CatalogViewEntry,
  HomeView,
} from "../components/HomeView.tsx";

const coordinate = `30078:${"a".repeat(64)}:security-lab`;
const acceptedManifestEventId = "b".repeat(64);

function entry(
  overrides: Partial<CatalogViewEntry> = {},
): CatalogViewEntry {
  return {
    coordinate,
    acceptedManifestEventId,
    title: "Security Lab",
    version: "1.0.0",
    capabilities: ["relay.query"],
    launch: {
      dTag: "security-lab",
      aggregateHash: "c".repeat(64),
      srcdoc: "<h1>verified</h1>",
    },
    ...overrides,
  };
}

function render(
  entries: readonly CatalogViewEntry[],
  status: "loading" | "ready" | "stale" | "error" = "ready",
) {
  return renderToString(
    <HomeView
      catalog={{ catalogEventId: "d".repeat(64), entries }}
      status={status}
      signedIn
      onOpen={() => undefined}
      onCommand={() => undefined}
    />,
  );
}

Deno.test("installed catalog covers empty, loading, stale, error, populated, and partial states", () => {
  assertStringIncludes(render([], "ready"), "No napplets installed");
  assertStringIncludes(
    render([], "loading"),
    "Syncing installed napplets…",
  );
  assertStringIncludes(
    render([entry()], "stale"),
    "Showing synchronized napplets while updates continue.",
  );
  assertStringIncludes(
    render([entry()], "error"),
    "Installed napplets could not be refreshed. Showing the last synchronized catalog.",
  );
  const populated = render([entry()]);
  assertStringIncludes(populated, "Security Lab");
  assertStringIncludes(populated, "Accepted version 1.0.0");
  assertStringIncludes(populated, acceptedManifestEventId);
  const partial = render([
    entry({ title: "", version: "", launch: undefined }),
  ]);
  assertStringIncludes(partial, "security-lab");
  assertStringIncludes(partial, "Manifest details unavailable");
  assertStringIncludes(partial, "disabled");
});

Deno.test("zero, one, and many catalog entries use stable coordinate keys", () => {
  assertStringIncludes(render([]), "No napplets installed");
  assertEquals((render([entry()]).match(/catalog-card/g) ?? []).length > 0, true);
  const many = render([
    entry(),
    entry({
      coordinate: `30078:${"e".repeat(64)}:notes`,
      acceptedManifestEventId: "f".repeat(64),
      title: "Notes",
    }),
  ]);
  assertStringIncludes(many, "Security Lab");
  assertStringIncludes(many, "Notes");
});

Deno.test("accepted manifest identity is the only launch authority", () => {
  let launched: CatalogViewEntry | undefined;
  const accepted = entry();
  const html = renderToString(
    <HomeView
      catalog={{ catalogEventId: "d".repeat(64), entries: [accepted] }}
      status="ready"
      signedIn
      onOpen={(candidate) => launched = candidate}
      onCommand={() => undefined}
    />,
  );
  assertStringIncludes(html, `data-manifest-id="${acceptedManifestEventId}"`);
  const props = { onOpen: (candidate: CatalogViewEntry) => launched = candidate };
  props.onOpen(accepted);
  assertEquals(launched?.acceptedManifestEventId, acceptedManifestEventId);
});

Deno.test("catalog stream architecture updates cards without remounting the iframe", async () => {
  const shell = await Deno.readTextFile("islands/NappletShell.tsx");
  assertStringIncludes(shell, 'message.type === "runtime.catalog"');
  assertStringIncludes(shell, "setCatalog(");
  assertEquals(shell.match(/<NappletFrame/g)?.length, 1);
});
