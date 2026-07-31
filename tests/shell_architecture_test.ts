function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("signer launch and QR encode the exact same Nostr Connect URI", async () => {
  const { qrcode } = await import("@libs/qrcode");
  const { createSignerLaunch } = await import("../islands/SignInFlow.tsx");
  const uri = "nostrconnect://napplet-portal?relay=wss%3A%2F%2Frelay.example";
  const launch = createSignerLaunch(uri);
  assert(launch.href === uri, "signer target must preserve the exact URI");
  assert(
    launch.qrSvg ===
      qrcode(uri, { output: "svg", ecl: "MEDIUM", border: 2 }),
    "QR and signer target must encode the same URI",
  );

  const shell = await Deno.readTextFile("islands/SignInFlow.tsx");
  assert(
    shell.includes("href={launch.href || undefined}"),
    "launch must be a link",
  );
  assert(
    shell.includes("Connect signer"),
    "signer action must use the approved label",
  );
});

Deno.test("shell receives the server-owned remote signer URI", async () => {
  const shell = await Deno.readTextFile("islands/SignInFlow.tsx");
  assert(
    shell.includes('message.type === "signer.pending"'),
    "shell must wait for the server-owned Nostr Connect URI",
  );
  assert(
    !shell.includes("nostrconnect://napplet-portal?relay="),
    "browser must not invent the remote signer relay",
  );
});

Deno.test("sign-in flow starts one QR signer session on load", async () => {
  const shell = await Deno.readTextFile("islands/SignInFlow.tsx");
  assert(
    shell.includes("/api/signin/connect"),
    "QR sign-in must use the signer-only WebSocket route",
  );
  assert(
    shell.includes('type: "signer.start"'),
    "sign-in flow must start the remote signer session",
  );
  assert(
    shell.includes("started.current"),
    "sign-in flow must guard against duplicate signer sessions",
  );
});

Deno.test("awaiting signer exposes explicit accessible cancellation", async () => {
  const shell = await Deno.readTextFile("islands/SignInFlow.tsx");
  assert(shell.includes("Cancel"), "awaiting view must expose Cancel");
  assert(
    shell.includes('type: "signer.cancel"'),
    "Cancel must dispatch an explicit runtime command",
  );
  assert(
    shell.includes("Start QR sign-in"),
    "cancelled state must allow a fresh attempt",
  );
});

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
    styles.includes("grid-row: 2"),
    "napplet iframe must occupy the flexible content row",
  );
  assert(
    styles.includes("height: 100%"),
    "napplet iframe must have a full-height containing block",
  );
  assert(
    styles.includes("prefers-reduced-motion"),
    "fade must respect reduced motion",
  );
});

Deno.test("socket loss preserves signer identity and projects connection truth", async () => {
  const shell = await Deno.readTextFile("islands/NappletShell.tsx");
  const connection = await Deno.readTextFile("shell/connection.ts");
  assert(
    shell.includes("hasMountedNapplet.current = Boolean(srcdoc)"),
    "close handler must not depend on stale first-render srcdoc",
  );
  assert(
    connection.includes('phase: canRetry ? "failed" : "retrying"') &&
      shell.includes('snapshot.phase === "failed"'),
    "transport loss must use quiet recovery before actionable failure",
  );
  assert(
    !shell.includes('current ? { ...current, status: "offline" } : null'),
    "backend transport loss must not mislabel signer identity offline",
  );
});

Deno.test("startup account restore failure is handled", async () => {
  const main = await Deno.readTextFile("main.ts");
  assert(
    main.includes("signerService.restore().catch"),
    "startup restore must not create an unhandled rejection",
  );
  assert(
    main.includes("restoredSignerAccounts = undefined") &&
      main.includes("throw error"),
    "failed account restoration must clear the cached promise",
  );
  assert(
    main.includes("startup account restore failed"),
    "startup restore failure must be sanitized and logged",
  );
});

Deno.test("process account restore cache follows sign-in mutations", async () => {
  const main = await Deno.readTextFile("main.ts");
  assert(
    main.includes("function cacheRestoredSignerAccounts"),
    "successful sign-in paths must refresh the module restore cache",
  );
  assert(
    main.includes("pending.connected.then(cacheRestoredSignerAccounts)"),
    "remote signer approval must refresh restored account cache",
  );
  assert(
    main.includes(
      "cacheRestoredSignerAccounts(await signerAccounts.signInBunker",
    ) &&
      main.includes("cacheRestoredSignerAccounts(") &&
      main.includes("await signerAccounts.signInNsec"),
    "bunker and nsec sign-in must refresh restored account cache",
  );
  assert(
    main.includes("signOut: () =>") &&
      main.includes("restoredSignerAccounts = undefined"),
    "sign-out must invalidate restored account cache",
  );
});

Deno.test("approved sign-in, Home, Profile, notice, and sign-out copy is present", async () => {
  const shell = await Deno.readTextFile("islands/NappletShell.tsx");
  const signin = await Deno.readTextFile("islands/SignInFlow.tsx");
  const home = await Deno.readTextFile("components/HomeView.tsx");
  const profile = await Deno.readTextFile("components/ProfileView.tsx");
  for (
    const copy of [
      "Connect signer",
      "Use bunker URI",
      "Use nsec",
      "Not recommended",
    ]
  ) assert(signin.includes(copy), `missing approved copy: ${copy}`);
  for (
    const copy of [
      "Retry Connection",
      "Retry Napplet",
      "Waiting for updates",
      "Public data will keep updating",
    ]
  ) assert(shell.includes(copy), `missing approved copy: ${copy}`);
  assert(
    home.includes("No napplets installed"),
    "empty synchronized catalog copy required",
  );
  assert(profile.includes("Signer offline"), "offline signer state required");
  assert(shell.includes("<HomeView"), "Home must remain presentational");
  assert(shell.includes("<ProfileView"), "Profile must remain presentational");
});

Deno.test("installed catalog mutations stay outside iframe authority", async () => {
  const shell = await Deno.readTextFile("islands/NappletShell.tsx");
  const home = await Deno.readTextFile("components/HomeView.tsx");
  assert(
    shell.includes('type: "catalog.approve"') &&
      shell.includes('type: "catalog.uninstall"'),
    "shell must send explicit correlated catalog commands",
  );
  assert(
    home.includes("Connect a signer to change installed napplets."),
    "signer-free public catalog must visibly disable mutations",
  );
  assert(
    !home.includes("postMessage"),
    "catalog controls must not ask the napplet iframe for identity",
  );
});

Deno.test("runtime settings navigation preserves the mounted iframe and browser Back profile state", async () => {
  const shell = await Deno.readTextFile("islands/NappletShell.tsx");
  const profile = await Deno.readTextFile("components/ProfileView.tsx");
  assert(profile.includes("Runtime settings"), "Profile needs settings action");
  assert(
    shell.includes('type View = "napplet" | "home" | "profile" | "settings"'),
    "settings must be an in-shell view",
  );
  assert(
    shell.includes("history.pushState(") &&
      shell.includes("{ view: next },") &&
      shell.includes('next === "settings"') && shell.includes('"/settings"'),
    "settings must use browser history without unloading the shell",
  );
  assert(
    shell.includes('next === "settings"'),
    "Back must restore settings/profile history",
  );
  assert(
    shell.match(/<NappletFrame/g)?.length === 1,
    "settings navigation must retain one persistent iframe mount",
  );
});
