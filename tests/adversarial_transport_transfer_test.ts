import {
  ActiveBinaryRequests,
} from "../runtime/binary_transport.ts";
import {
  ResourceDestinationPolicy,
} from "../runtime/resource_policy.ts";
import {
  ResourceService,
  ResourceServiceError,
} from "../runtime/resource_service.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("resource boundary tracer denies private URL and stale ownership without effects", async () => {
  let fetchCalls = 0;
  const service = new ResourceService({
    policy: new ResourceDestinationPolicy({
      resolveDns: (_hostname, recordType) =>
        Promise.resolve(recordType === "A" ? ["169.254.169.254"] : []),
    }),
    fetch: () => {
      fetchCalls++;
      return Promise.resolve(new Response("secret"));
    },
  });

  let projected = "";
  await service.bytes("https://metadata.example/latest/token").then(
    () => {
      throw new Error("private destination must be denied");
    },
    (error) => {
      assert(error instanceof ResourceServiceError, "stable service error");
      projected = `${error.code}:${error.message}`;
    },
  );
  assert(fetchCalls === 0, "denial occurs before network effects");
  assert(
    projected === "blocked-by-policy:resource unavailable",
    "denial projection is stable and sanitized",
  );
  assert(!projected.includes("metadata.example"), "destination is not leaked");
  assert(!projected.includes("token"), "path and secret hints are not leaked");

  const active = new ActiveBinaryRequests(2);
  const current = {
    connectionId: "connection-a",
    windowId: "window-a",
    generation: 2,
  };
  assert(active.open(current, "transfer-a"), "current owner opens transfer");
  assert(
    !active.settle({ ...current, generation: 1 }, "transfer-a"),
    "stale generation cannot settle current transfer",
  );
  assert(
    !active.settle({ ...current, connectionId: "connection-b" }, "transfer-a"),
    "foreign connection cannot settle current transfer",
  );
  assert(active.settle(current, "transfer-a"), "exact owner settles transfer");
});
