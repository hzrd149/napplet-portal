import { loadBindAddress } from "../runtime/config.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const VARIABLES = [
  "NAPPLET_COORDINATE",
  "NOSTR_RELAYS",
  "REMOTE_SIGNER_RELAYS",
  "BLOSSOM_SERVERS",
  "PORTAL_RECONNECT_GRACE_MS",
  "PORTAL_BIND",
];

Deno.test("dev and production tasks load .env while quality tasks stay hermetic", async () => {
  const { tasks } = JSON.parse(await Deno.readTextFile("deno.json")) as {
    tasks: Record<string, string>;
  };

  for (const name of ["dev", "start"]) {
    assert(
      tasks[name]?.includes("--env-file"),
      `${name} must load environment variables from .env`,
    );
  }
  for (const name of ["check", "test", "build"]) {
    assert(
      !tasks[name]?.includes("--env-file"),
      `${name} must not depend on a local .env`,
    );
  }
  assert(
    tasks["start:server"]?.includes("runtime/bind.ts"),
    "production bind address must come from the validated resolver",
  );
});

Deno.test("committed .env.example documents every variable and holds no real value", async () => {
  const example = await Deno.readTextFile(".env.example");
  for (const variable of VARIABLES) {
    assert(
      new RegExp(`^#?\\s*${variable}=`, "m").test(example),
      `.env.example missing ${variable}`,
    );
  }
  assert(
    /^NAPPLET_COORDINATE=\s*$/m.test(example),
    ".env.example must leave NAPPLET_COORDINATE empty",
  );
  assert(
    !/naddr1|nsec1|npub1/.test(example),
    ".env.example must contain no real Nostr value",
  );

  const ignored = await new Deno.Command("git", {
    args: ["check-ignore", "--no-index", ".env", ".env.example"],
    stdout: "piped",
    stderr: "null",
  }).output();
  const paths = new TextDecoder().decode(ignored.stdout).split("\n");
  assert(paths.includes(".env"), ".env must stay uncommitted");
  assert(!paths.includes(".env.example"), ".env.example must stay committed");
});

Deno.test("bind resolver rejects non-loopback addresses before they are served", () => {
  const warnings: string[] = [];
  const push = (warning: string) => warnings.push(warning);

  assert(
    loadBindAddress({ PORTAL_BIND: "0.0.0.0" }, push) === "127.0.0.1",
    "non-loopback bind must fall back",
  );
  assert(warnings.length === 1, "rejected bind must warn exactly once");
  assert(
    loadBindAddress({ PORTAL_BIND: "::1" }, push) === "::1",
    "loopback IPv6 bind must be preserved",
  );
  assert(
    loadBindAddress({}, push) === "127.0.0.1",
    "missing bind must default to loopback",
  );
  assert(warnings.length === 1, "accepted binds must stay silent");
});
