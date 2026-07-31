// One release entry point composes both built-server transport proofs. Each imported
// module owns its isolated process, bounded readiness deadline, and finally teardown.
import "./media_transport_smoke_test.ts";
import "./runtime_reconnect_smoke_test.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("production multi-client suite retains ownership and reconnect gates", async () => {
  const [media, reconnect] = await Promise.all([
    Deno.readTextFile("tests/media_transport_smoke_test.ts"),
    Deno.readTextFile("tests/runtime_reconnect_smoke_test.ts"),
  ]);
  assert(
    media.includes("two-client production"),
    "two-client proof is included",
  );
  assert(
    media.includes("prior owner stop is received before the new-owner grant"),
    "ordered ownership is asserted",
  );
  assert(
    reconnect.includes("runtime.intent.ticket"),
    "intent correlation is exercised",
  );
  assert(reconnect.includes("reconnectToken"), "reconnect token is exercised");
  assert(reconnect.includes("resumed === true"), "grace resume is asserted");
});
