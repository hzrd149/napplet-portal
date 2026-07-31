import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import {
  BlossomTransferAdapter,
  BlossomTransferService,
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

function settlementUploader(
  outcomes: Readonly<
    Record<
      string,
      "accepted" | "network-error" | "timeout" | "descriptor-mismatch"
    >
  >,
) {
  return {
    uploadRequired(server: URL, blob: Blob) {
      const outcome = outcomes[server.hostname];
      if (outcome !== "accepted") return Promise.reject(new Error(outcome));
      return Promise.resolve({
        ...descriptor(server),
        size: blob.size,
        mimeType: "text/plain",
      });
    },
  };
}

function assertClosedResult(result: Record<string, unknown>) {
  const allowed = new Set([
    "ok",
    "uploadId",
    "status",
    "rail",
    "url",
    "fallbackUrls",
    "sha256",
    "size",
    "mimeType",
    "error",
  ]);
  assertEquals(Object.keys(result).filter((key) => !allowed.has(key)), []);
  assert((result.error as string).length <= 512);
  assert(/^[\x20-\x7e]+$/.test(result.error as string));
}

Deno.test("all required and local acceptance preserves configured URL order", async () => {
  const service = new BlossomTransferService({
    uploader: settlementUploader({
      "one.example": "accepted",
      "two.example": "accepted",
      "127.0.0.1": "accepted",
    }),
  });
  const result = await service.upload({
    owner: "owner",
    blob: new Blob(["hey"]),
    requiredServers: [
      new URL("https://one.example/"),
      new URL("https://two.example/"),
    ],
    localServer: new URL("http://127.0.0.1:24242/"),
  });

  assertEquals(result.ok, true);
  assertEquals(result.status, "complete");
  assertEquals(result.url, `https://one.example/${HASH}`);
  assertEquals(result.fallbackUrls, [
    `https://two.example/${HASH}`,
    `http://127.0.0.1:24242/${HASH}`,
  ]);
  assertEquals(
    result.error,
    "required[0]=accepted;required[1]=accepted;local=accepted",
  );
  assertClosedResult(result as unknown as Record<string, unknown>);
});

Deno.test("optional local failure remains explicit without changing remote success", async () => {
  const service = new BlossomTransferService({
    uploader: settlementUploader({
      "one.example": "accepted",
      "127.0.0.1": "timeout",
    }),
  });
  const result = await service.upload({
    owner: "owner",
    blob: new Blob(["hey"]),
    requiredServers: [SERVER],
    localServer: new URL("http://127.0.0.1:24242/"),
  });

  assertEquals(result.ok, true);
  assertEquals(result.status, "complete");
  assertEquals(result.fallbackUrls, undefined);
  assertEquals(result.error, "required[0]=accepted;local=timeout");
  assertClosedResult(result as unknown as Record<string, unknown>);
});

Deno.test("partial required failure fails canonically and skips local", async () => {
  const service = new BlossomTransferService({
    uploader: settlementUploader({
      "one.example": "accepted",
      "two.example": "network-error",
    }),
  });
  const result = await service.upload({
    owner: "owner",
    blob: new Blob(["hey"]),
    requiredServers: [SERVER, new URL("https://two.example/")],
    localServer: new URL("http://127.0.0.1:24242/"),
  });

  assertEquals(result.ok, false);
  assertEquals(result.status, "failed");
  assertEquals(result.url, `https://one.example/${HASH}`);
  assertEquals(
    result.error,
    "required[0]=accepted;required[1]=network-error;local=not-attempted",
  );
  assertClosedResult(result as unknown as Record<string, unknown>);
});

Deno.test("full required failure reports every bounded ordinal outcome", async () => {
  const service = new BlossomTransferService({
    uploader: settlementUploader({
      "one.example": "timeout",
      "two.example": "descriptor-mismatch",
    }),
  });
  const result = await service.upload({
    owner: "owner",
    blob: new Blob(["hey"]),
    requiredServers: [SERVER, new URL("https://two.example/")],
  });

  assertEquals(result.ok, false);
  assertEquals(result.status, "failed");
  assertEquals(result.url, undefined);
  assertEquals(
    result.error,
    "required[0]=timeout;required[1]=descriptor-mismatch;local=not-attempted",
  );
  assertClosedResult(result as unknown as Record<string, unknown>);
  assertEquals(service.status("owner", result.uploadId)?.error, result.error);
  assertEquals(service.status("another-owner", result.uploadId), undefined);
});
