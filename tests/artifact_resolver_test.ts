import fixture from "./fixtures/supplied_napplet_contract.json" with {
  type: "json",
};
import {
  ArtifactResolutionError,
  InMemoryNappletArtifactCache,
  loadUnsafeLocalArtifact,
  PortalArtifactResolver,
} from "../runtime/artifacts.ts";
import { MAX_BINARY_PAYLOAD_BYTES } from "../runtime/binary_transport.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function expectCode(
  code: string,
  action: () => Promise<unknown>,
): Promise<void> {
  try {
    await action();
    throw new Error(`expected ${code}`);
  } catch (error) {
    assert(error instanceof ArtifactResolutionError, "expected named failure");
    assert(error.code === code, `expected ${code}, received ${error.code}`);
    assert(error.executableHtml === undefined, "failure must not expose HTML");
  }
}

Deno.test("missing coordinate returns configured-empty without network access", async () => {
  let calls = 0;
  const resolver = new PortalArtifactResolver({
    coordinate: "",
    relays: [],
    blossomServers: [],
    resolveManifest: () => {
      calls++;
      throw new Error("must not resolve");
    },
  });

  const result = await resolver.resolve();
  assert(result.state === "configured-empty", "empty coordinate must be inert");
  assert(calls === 0, "empty coordinate must not touch relays");
});

Deno.test("supplied manifest resolves once, merges sources, and holds version", async () => {
  let manifestCalls = 0;
  const fetchedUrls: string[] = [];
  const networkFetch = fetch;
  const resolver = new PortalArtifactResolver({
    coordinate: fixture.coordinate,
    relays: ["wss://relay.example/"],
    blossomServers: ["https://cache.example/"],
    cache: new InMemoryNappletArtifactCache(),
    resolveManifest: (_coordinate, relays) => {
      manifestCalls++;
      assert(relays[0] === "wss://relay.example/", "relay config must flow");
      return Promise.resolve(fixture.manifestEvent);
    },
    fetchBytes: async (url) => {
      fetchedUrls.push(url);
      if (url.startsWith("https://cache.example/")) {
        throw new Error("local cache miss");
      }
      const response = await networkFetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    },
  });

  const first = await resolver.resolve();
  assert(first.state === "ready", "valid supplied fixture must resolve");
  assert(
    first.identity.dTag === fixture.identity.identifier,
    "dTag must bind identity",
  );
  assert(
    first.identity.aggregateHash === fixture.identity.aggregateHash,
    "aggregate must bind identity",
  );
  assert(
    first.srcdoc.includes("Security Lab"),
    "verified HTML must reach srcdoc",
  );
  assert(
    fetchedUrls[0]?.startsWith("https://cache.example/"),
    "configured Blossom must be tried",
  );
  const second = await resolver.resolve();
  assert(second === first, "resolved version must be held until retry");
  assert(manifestCalls === 1, "held version must not re-resolve");
});

Deno.test("integrity failures and unsupported capabilities fail closed", async () => {
  const invalid = structuredClone(fixture.manifestEvent);
  invalid.sig = `0${invalid.sig.slice(1)}`;
  await expectCode("invalid-signature", () =>
    new PortalArtifactResolver({
      coordinate: fixture.coordinate,
      relays: [],
      blossomServers: [],
      resolveManifest: () => Promise.resolve(invalid),
    }).resolve());

  await expectCode("missing-capability", () =>
    new PortalArtifactResolver({
      coordinate: fixture.coordinate,
      relays: [],
      blossomServers: [],
      resolveManifest: () => Promise.resolve(fixture.manifestEvent),
      supportedDomains: ["identity", "relay", "outbox"],
    }).resolve());

  await expectCode("blob-hash-mismatch", () =>
    new PortalArtifactResolver({
      coordinate: fixture.coordinate,
      relays: [],
      blossomServers: [],
      resolveManifest: () => Promise.resolve(fixture.manifestEvent),
      fetchBytes: () => Promise.resolve(new TextEncoder().encode("altered")),
    }).resolve());
});

Deno.test("valid executable HTML can traverse local Blossom without bypassing verification", async () => {
  const networkFetch = fetch;
  const remoteUrl = `${
    fixture.artifact.servers[0].replace(/\/$/, "")
  }/${fixture.artifact.sha256}`;
  const remote = await networkFetch(remoteUrl);
  assert(remote.ok, "fixture blob must be available");
  const fixtureBytes = new Uint8Array(await remote.arrayBuffer());
  const calls: string[] = [];
  const resolver = new PortalArtifactResolver({
    coordinate: fixture.coordinate,
    relays: [],
    blossomServers: fixture.artifact.servers,
    resolveManifest: () => Promise.resolve(fixture.manifestEvent),
    blossomFetch: (input, init) => {
      calls.push(`${init?.method ?? "GET"} ${String(input)}`);
      if (init?.method === "HEAD") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(new Response(fixtureBytes));
    },
  });

  const result = await resolver.resolve();
  assert(
    result.state === "ready" && result.srcdoc.includes("Security Lab"),
    "verified local bytes must resolve",
  );
  assert(
    calls.some((call) => call.startsWith("GET http://127.0.0.1:24242/")),
    "blob must traverse local cache",
  );
  assert(
    calls.some((call) => call.includes("as=" + fixture.manifestEvent.pubkey)),
    "manifest signer must attest the author hint",
  );

  await expectCode("blob-unavailable", () =>
    new PortalArtifactResolver({
      coordinate: fixture.coordinate,
      relays: [],
      blossomServers: fixture.artifact.servers,
      resolveManifest: () => Promise.resolve(fixture.manifestEvent),
      blossomFetch: (_input, init) =>
        init?.method === "HEAD"
          ? Promise.resolve(new Response(null, { status: 204 }))
          : Promise.resolve(new Response("malformed cache bytes")),
    }).resolve());
});

Deno.test("unsafe local artifact loads explicit HTML bytes with distinct identity", async () => {
  const directory = await Deno.makeTempDir();
  const path = `${directory}/local-napplet.html`;
  const source = "<!doctype html><html><body>local test</body></html>";
  await Deno.writeTextFile(path, source);
  try {
    const artifact = await loadUnsafeLocalArtifact(fixture, path);
    const expectedHash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source)),
      ),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    assert(artifact.verification === "unsafe-local", "mode must stay explicit");
    assert(artifact.indexHtml === source, "exact local bytes must be loaded");
    assert(
      artifact.aggregateHash === expectedHash,
      "unsafe identity must hash the actual local bytes",
    );
    assert(
      artifact.manifest.requires.join(",") ===
        fixture.requiredDomains.join(","),
      "unsafe mode must retain the fixture capability boundary",
    );
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("unsafe local artifact retains HTML MIME and size boundaries", async () => {
  const directory = await Deno.makeTempDir();
  const exactPath = `${directory}/exact.html`;
  const invalidPath = `${directory}/invalid.txt`;
  const oversizedPath = `${directory}/oversized.html`;
  const prefix = "<!doctype html>";
  await Deno.writeTextFile(
    exactPath,
    prefix + " ".repeat(MAX_BINARY_PAYLOAD_BYTES - prefix.length),
  );
  await Deno.writeTextFile(invalidPath, "<html></html>");
  await Deno.writeTextFile(
    oversizedPath,
    prefix + " ".repeat(MAX_BINARY_PAYLOAD_BYTES + 1 - prefix.length),
  );
  try {
    const boundary = await loadUnsafeLocalArtifact(fixture, exactPath);
    assert(
      new TextEncoder().encode(boundary.indexHtml).byteLength ===
        MAX_BINARY_PAYLOAD_BYTES,
      "exact size limit remains eligible",
    );
    await expectCode(
      "invalid-mime",
      () => loadUnsafeLocalArtifact(fixture, invalidPath),
    );
    await expectCode(
      "artifact-too-large",
      () => loadUnsafeLocalArtifact(fixture, oversizedPath),
    );
    await expectCode(
      "blob-unavailable",
      () => loadUnsafeLocalArtifact(fixture, `${directory}/missing.html`),
    );
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});
