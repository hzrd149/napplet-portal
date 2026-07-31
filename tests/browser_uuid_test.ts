import { createBrowserUuid } from "../shell/browser_uuid.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("browser UUID generation works without crypto.randomUUID", () => {
  const original = Object.getOwnPropertyDescriptor(crypto, "randomUUID");
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: undefined,
  });

  try {
    assert(
      typeof crypto.getRandomValues === "function",
      "getRandomValues must remain the entropy source",
    );
    const values = new Set(Array.from({ length: 16 }, createBrowserUuid));
    assert(values.size === 16, "generated UUIDs must be distinct");
    for (const value of values) {
      assert(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
          .test(
            value,
          ),
        `expected an RFC 4122 UUID v4, received ${value}`,
      );
    }
  } finally {
    if (original) Object.defineProperty(crypto, "randomUUID", original);
    else delete (crypto as { randomUUID?: unknown }).randomUUID;
  }
});

Deno.test("hydrated shell does not call crypto.randomUUID directly", async () => {
  const shell = await Deno.readTextFile("islands/NappletShell.tsx");
  assert(
    !shell.includes("crypto.randomUUID"),
    "browser UUID generation must use the HTTP-compatible helper",
  );
});
