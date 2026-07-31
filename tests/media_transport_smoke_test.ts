function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test({
  name: "two-client production media ownership smoke",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => assert(false, "production media harness not implemented"),
});
