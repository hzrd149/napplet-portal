import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import {
  BlossomTransferAdapter,
  type BlossomUploadSdk,
} from "../runtime/blossom_transfer.ts";

const HASH = "a".repeat(64);
const SERVER = new URL("https://one.example/");

function descriptor(server = SERVER) {
  return {
    sha256: HASH,
    size: 3,
    type: "text/plain",
    url: new URL(HASH, server).href,
  };
}

Deno.test("adapter hashes bytes and scopes backend authorization to server and hash", async () => {
  const signed: Record<string, unknown>[] = [];
  const sdk: BlossomUploadSdk = {
    sniffMimeType: () => "text/plain",
    sha256: () => Promise.resolve(HASH),
    createUploadAuth: async (signer, hash, options) => {
      assertEquals(hash, HASH);
      assertEquals(options.servers, [SERVER.hostname]);
      const event = await signer({
        kind: 24242,
        created_at: 1,
        content: "Upload blob",
        tags: [["x", hash], ["server", SERVER.hostname]],
      });
      return event;
    },
    encodeAuthorizationHeader: () => "Nostr token",
    uploadBlob: (_server, blob, options) => {
      assertEquals(blob.size, 3);
      assertEquals(options.authorization, "Nostr token");
      assert(options.signal);
      return Promise.resolve(descriptor());
    },
    parseUploadResponse: (value) => value as ReturnType<typeof descriptor>,
  };
  const adapter = new BlossomTransferAdapter({
    sdk,
    signEvent: (template) => {
      signed.push(template as unknown as Record<string, unknown>);
      return Promise.resolve({
        ...template,
        id: "b".repeat(64),
        pubkey: "c".repeat(64),
        sig: "d".repeat(128),
      });
    },
    now: () => 1_000,
  });

  const result = await adapter.uploadRequired(
    SERVER,
    new Blob(["hey"], { type: "application/octet-stream" }),
  );

  assertEquals(result.url, new URL(HASH, SERVER).href);
  assertEquals(result.sha256, HASH);
  assertEquals(result.mimeType, "text/plain");
  assertEquals(signed.length, 1);
  assertEquals(signed[0].kind, 24242);
});

Deno.test("adapter rejects a descriptor that does not match the requested bytes", async () => {
  const sdk: BlossomUploadSdk = {
    sniffMimeType: () => "text/plain",
    sha256: () => Promise.resolve(HASH),
    createUploadAuth: () => Promise.resolve({}),
    encodeAuthorizationHeader: () => "Nostr token",
    uploadBlob: () => Promise.resolve({ ...descriptor(), size: 4 }),
    parseUploadResponse: (value) => value as ReturnType<typeof descriptor>,
  };
  const adapter = new BlossomTransferAdapter({
    sdk,
    signEvent: () => Promise.resolve({} as never),
  });

  await assertRejects(
    () => adapter.uploadRequired(SERVER, new Blob(["hey"])),
    Error,
    "descriptor-mismatch",
  );
});
