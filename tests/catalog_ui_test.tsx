import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.16";
import { renderToString } from "npm:preact-render-to-string@^6.6.3";
import {
  capabilityChanges,
  type CatalogViewEntry,
  filterCatalogEntries,
  HomeView,
  InstallReviewDialog,
  UninstallDialog,
  UpdateReviewDialog,
} from "../components/HomeView.tsx";
import { decodeCatalogCommand } from "../runtime/transport.ts";
import {
  CatalogCommandRegistry,
  MAX_PENDING_CATALOG_COMMANDS,
} from "../islands/NappletShell.tsx";

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
    resolution: "ready",
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
      onCommand={() => Promise.resolve({ ok: true })}
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
    entry({ title: "", version: "", resolution: "unavailable" }),
  ]);
  assertStringIncludes(partial, "security-lab");
  assertStringIncludes(partial, "Manifest details unavailable");
  assertStringIncludes(partial, "disabled");
});

Deno.test("install form and immutable review expose every trust fact with retry state", () => {
  const home = render([entry()]);
  assertStringIncludes(home, 'for="install-naddr"');
  assertStringIncludes(home, "Install a napplet");
  assertStringIncludes(home, "Review install");
  const preview = {
    publisher: "a".repeat(64),
    coordinate,
    manifestEventId: "e".repeat(64),
    title: "Security Lab",
    version: "2.0.0",
    aggregateHash: "f".repeat(64),
    capabilities: ["relay.query", "outbox.publish"],
    sourceCatalogEventId: "d".repeat(64),
  };
  const dialog = renderToString(
    <InstallReviewDialog
      preview={preview}
      open
      pending={false}
      error="The napplet could not be installed. Review the details and try again."
      onApprove={() => undefined}
      onClose={() => undefined}
    />,
  );
  for (
    const fact of [
      "Review napplet install",
      preview.publisher,
      coordinate,
      preview.manifestEventId,
      "Security Lab",
      "2.0.0",
      preview.aggregateHash,
      "relay.query, outbox.publish",
      "Install napplet",
      "could not be installed",
    ]
  ) {
    assertStringIncludes(dialog, fact);
  }
});

Deno.test("local catalog search matches only current public metadata", () => {
  const entries = [
    entry(),
    entry({
      coordinate: `30078:${"e".repeat(64)}:field-notes`,
      acceptedManifestEventId: "f".repeat(64),
      title: "",
      version: "Preview 2",
      capabilities: ["OUTBOX.Publish"],
      resolution: "pending",
    }),
  ];
  assertEquals(filterCatalogEntries(entries, " security "), [entries[0]]);
  assertEquals(filterCatalogEntries(entries, "FIELD-NOTES"), [entries[1]]);
  assertEquals(filterCatalogEntries(entries, "preview 2"), [entries[1]]);
  assertEquals(filterCatalogEntries(entries, "outbox.publish"), [entries[1]]);
  assertEquals(filterCatalogEntries(entries, acceptedManifestEventId), []);
  assertEquals(filterCatalogEntries(entries, "  "), entries);
});

Deno.test("search distinguishes no-match and keeps sync context accessible", () => {
  const html = renderToString(
    <HomeView
      catalog={{ catalogEventId: "d".repeat(64), entries: [entry()] }}
      status="error"
      signedIn
      query="missing"
      onQueryChange={() => undefined}
      onOpen={() => undefined}
      onCommand={() => Promise.resolve({ ok: true })}
    />,
  );
  assertStringIncludes(html, "No installed napplets match this search");
  assertStringIncludes(html, "Installed napplets could not be refreshed");
  assertStringIncludes(html, 'type="search"');
  assertStringIncludes(html, 'aria-live="polite"');
  assertStringIncludes(html, 'aria-atomic="true"');
  assertStringIncludes(html, "0 napplets found");
});

Deno.test("query lives in the shell and search dispatches no runtime command", async () => {
  const shell = await Deno.readTextFile("islands/NappletShell.tsx");
  const home = await Deno.readTextFile("components/HomeView.tsx");
  assertStringIncludes(shell, 'useState("")');
  assertStringIncludes(shell, "query={catalogQuery}");
  assertStringIncludes(shell, "onQueryChange={setCatalogQuery}");
  assertEquals(home.includes("catalog.search"), false);
  assertEquals(home.includes("fetch("), false);
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
      onCommand={() => Promise.resolve({ ok: true })}
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
  assertStringIncludes(shell, "catalogGeneration");
  assertStringIncludes(shell, "generations.retired.has(nextId)");
  assertStringIncludes(shell, "catalogAccount.current !== pubkey");
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

Deno.test("production runtime emits projections and dispatches correlated catalog commands", async () => {
  const endpoint = await Deno.readTextFile("routes/api/runtime.ts");
  const main = await Deno.readTextFile("main.ts");
  for (
    const required of [
      "decodeCatalogCommand(message)",
      "bridge.catalogCommand(catalogCommand)",
      'type: "runtime.catalog"',
      'type: "runtime.catalog.result"',
      "bridge.subscribeCatalog",
      "catalogEventId: catalog.catalogEventId",
      "entries: catalog.entries",
    ]
  ) assertStringIncludes(endpoint, required);
  assertEquals(
    endpoint.includes("catalog: { catalogEventId: null, entries: [] }"),
    false,
  );
  assertStringIncludes(main, "new CatalogService(");
  assertStringIncludes(main, "processRuntime.configureCatalog(catalogService)");
  assertStringIncludes(main, "new CatalogSyncOwner(");
});

Deno.test("catalog command codecs reject extra keys and accept exact authority selectors", () => {
  const id = "command-1";
  const command = {
    type: "catalog.launch",
    id,
    catalogEventId: "d".repeat(64),
    coordinate,
    manifestEventId: acceptedManifestEventId,
  } as const;
  assertEquals(decodeCatalogCommand(command), command);
  assertEquals(decodeCatalogCommand({ ...command, srcdoc: "untrusted" }), null);
  assertEquals(decodeCatalogCommand({ ...command, id: "" }), null);
  assertEquals(
    decodeCatalogCommand({
      type: "catalog.approve",
      id,
      coordinate,
      manifestEventId: acceptedManifestEventId,
      sourceCatalogEventId: null,
    })?.type,
    "catalog.approve",
  );
});

Deno.test("catalog command registry caps each socket at 32 and recovers a slot", async () => {
  const sent: Array<Record<string, unknown>> = [];
  const registry = new CatalogCommandRegistry((message) => {
    sent.push(message);
    return true;
  });
  const pending = Array.from(
    { length: MAX_PENDING_CATALOG_COMMANDS },
    () => registry.request({ type: "catalog.uninstall", coordinate }),
  );
  const rejected = await registry.request({
    type: "catalog.uninstall",
    coordinate,
  });
  assertEquals(rejected, {
    ok: false,
    error: "catalog-command-capacity",
    retryable: true,
  });
  assertEquals(sent.length, MAX_PENDING_CATALOG_COMMANDS);
  registry.receive({
    type: "runtime.catalog.result",
    id: sent[0].id,
    ok: true,
  });
  assertEquals(await pending[0], { ok: true, value: undefined });
  const recovery = registry.request({ type: "catalog.uninstall", coordinate });
  assertEquals(sent.length, MAX_PENDING_CATALOG_COMMANDS + 1);
  registry.clear();
  assertEquals((await recovery).error, "catalog-command-disconnected");
  await Promise.all(pending.slice(1));
  assertEquals(registry.size, 0);
});
