import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "jsr:@std/assert@1.0.16";
import { renderToString } from "npm:preact-render-to-string@^6.6.3";
import {
  capabilityChanges,
  type CatalogViewEntry,
  HomeView,
  UninstallDialog,
  UpdateReviewDialog,
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
  assertEquals(
    (render([entry()]).match(/catalog-card/g) ?? []).length > 0,
    true,
  );
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
  const props = {
    onOpen: (candidate: CatalogViewEntry) => launched = candidate,
  };
  props.onOpen(accepted);
  assertEquals(launched?.acceptedManifestEventId, acceptedManifestEventId);
});

Deno.test("catalog stream architecture updates cards without remounting the iframe", async () => {
  const shell = await Deno.readTextFile("islands/NappletShell.tsx");
  assertStringIncludes(shell, 'message.type === "runtime.catalog"');
  assertStringIncludes(shell, "setCatalog(");
  assertEquals(shell.match(/<NappletFrame/g)?.length, 1);
});

Deno.test("update review renders complete attested comparison and capability changes", () => {
  const candidate = entry({
    update: {
      publisher: "a".repeat(64),
      manifestEventId: "e".repeat(64),
      title: "Security Lab Next",
      version: "2.0.0",
      aggregateHash: "f".repeat(64),
      capabilities: ["relay.query", "outbox.publish"],
    },
  });
  const html = renderToString(
    <UpdateReviewDialog
      entry={candidate}
      open
      pending={false}
      error=""
      onApprove={() => undefined}
      onClose={() => undefined}
    />,
  );
  for (
    const copy of [
      "Review napplet update",
      "Publisher",
      "Coordinate",
      acceptedManifestEventId,
      "e".repeat(64),
      "Security Lab Next",
      "2.0.0",
      "f".repeat(64),
      "Added outbox.publish",
      "Approve update",
      "Keep current version",
    ]
  ) assertStringIncludes(html, copy);
  assertEquals(capabilityChanges(["relay.query"], ["relay.query"]), [
    "No capability changes",
  ]);
});

Deno.test("dialogs expose pending, retryable failure, and cache-retention copy", () => {
  const candidate = entry({
    update: {
      publisher: "a".repeat(64),
      manifestEventId: "e".repeat(64),
      aggregateHash: "f".repeat(64),
      capabilities: [],
    },
  });
  const update = renderToString(
    <UpdateReviewDialog
      entry={candidate}
      open
      pending
      error="The update could not be approved. Try again."
      onApprove={() => undefined}
      onClose={() => undefined}
    />,
  );
  assertStringIncludes(update, "Approving…");
  assertStringIncludes(update, "The update could not be approved. Try again.");
  const uninstall = renderToString(
    <UninstallDialog
      entry={entry()}
      open
      pending
      error="The napplet could not be uninstalled. Try again."
      onConfirm={() => undefined}
      onClose={() => undefined}
    />,
  );
  assertStringIncludes(uninstall, "Remove Security Lab");
  assertStringIncludes(
    uninstall,
    "Cached files may remain until normal cache cleanup.",
  );
  assertStringIncludes(uninstall, "Uninstalling…");
  assertStringIncludes(
    uninstall,
    "The napplet could not be uninstalled. Try again.",
  );
});

Deno.test("catalog dialogs are native, stale-safe, back-safe, and return focus", async () => {
  const home = await Deno.readTextFile("components/HomeView.tsx");
  const shell = await Deno.readTextFile("islands/NappletShell.tsx");
  assertStringIncludes(home, "<dialog");
  assertStringIncludes(home, "showModal()");
  assertStringIncludes(home, "invoker.current?.focus()");
  assertStringIncludes(
    home,
    "The installed catalog changed. Review the latest version before continuing.",
  );
  assertStringIncludes(shell, "closeCatalogDialog");
  assertStringIncludes(shell, "catalog.approve");
  assertStringIncludes(shell, "catalog.uninstall");
});
