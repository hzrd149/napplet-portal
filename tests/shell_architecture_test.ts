function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("shell keeps one exact-sandbox iframe and no backend authority", async () => {
  const shell = await Deno.readTextFile("islands/NappletShell.tsx");
  const frame = await Deno.readTextFile("components/NappletFrame.tsx");
  assert(frame.includes('sandbox="allow-scripts"'), "sandbox must be exact");
  assert(!frame.includes("allow-same-origin"), "opaque origin must remain");
  assert(
    shell.match(/<NappletFrame/g)?.length === 1,
    "persistent frame must have one render site",
  );
  for (
    const forbidden of [
      "applesauce",
      "account_store",
      "runtime/accounts",
      "relay_adapter",
      "@kehto/runtime",
    ]
  ) {
    assert(!shell.includes(forbidden), `island must not import ${forbidden}`);
  }
});

Deno.test("shell structure reserves content and safe-area navigation rows", async () => {
  const shell = await Deno.readTextFile("islands/NappletShell.tsx");
  const styles = await Deno.readTextFile("assets/styles.css");
  assert(
    shell.includes('nav aria-label="Primary"'),
    "primary nav must be semantic",
  );
  assert(
    shell.includes("aria-current="),
    "selected destination must be exposed",
  );
  assert(styles.includes("100dvh"), "shell must use dynamic viewport height");
  assert(
    styles.includes("safe-area-inset-bottom"),
    "nav must reserve safe area",
  );
  assert(
    styles.includes("prefers-reduced-motion"),
    "fade must respect reduced motion",
  );
});
