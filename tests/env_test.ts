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
  "NAPPLET_UNSAFE_SKIP_VERIFICATION",
  "NAPPLET_UNSAFE_LOCAL_ARTIFACT_PATH",
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

Deno.test("bind resolver preserves valid custom addresses", () => {
  const warnings: string[] = [];
  const push = (warning: string) => warnings.push(warning);

  assert(
    loadBindAddress({ PORTAL_BIND: "0.0.0.0" }, push) === "0.0.0.0",
    "wildcard IPv4 bind must be preserved",
  );
  assert(
    loadBindAddress({ PORTAL_BIND: "192.168.1.20" }, push) ===
      "192.168.1.20",
    "custom IPv4 bind must be preserved",
  );
  assert(
    loadBindAddress({ PORTAL_BIND: "::1" }, push) === "::1",
    "IPv6 bind must be preserved",
  );
  assert(
    loadBindAddress({ PORTAL_BIND: "localhost" }, push) === "localhost",
    "hostname bind must be preserved",
  );
  assert(warnings.length === 0, "valid binds must stay silent");
});

Deno.test("bind resolver rejects URL and host-port values", () => {
  const warnings: string[] = [];
  const push = (warning: string) => warnings.push(warning);

  assert(
    loadBindAddress({ PORTAL_BIND: "http://127.0.0.1" }, push) ===
      "127.0.0.1",
    "URL bind must fall back",
  );
  assert(
    loadBindAddress({ PORTAL_BIND: "127.0.0.1:8000" }, push) === "127.0.0.1",
    "host-port bind must fall back",
  );
  assert(
    loadBindAddress({}, push) === "127.0.0.1",
    "missing bind must default to loopback",
  );
  assert(warnings.length === 2, "rejected binds must warn exactly once each");
});

Deno.test("production bind bootstrap rejects unsafe mode on a public bind", async () => {
  const output = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-env=PORTAL_BIND,NAPPLET_UNSAFE_SKIP_VERIFICATION,NAPPLET_UNSAFE_LOCAL_ARTIFACT_PATH",
      "runtime/bind.ts",
    ],
    env: {
      PORTAL_BIND: "0.0.0.0",
      NAPPLET_UNSAFE_SKIP_VERIFICATION: "true",
      NAPPLET_UNSAFE_LOCAL_ARTIFACT_PATH: "/private/operator/napplet.html",
    },
    stdout: "piped",
    stderr: "piped",
  }).output();
  const stderr = new TextDecoder().decode(output.stderr);
  assert(!output.success, "production startup must fail before serving");
  assert(
    stderr.includes("loopback"),
    "startup rejection must explain the loopback requirement",
  );
  assert(
    !stderr.includes("/private/operator/napplet.html"),
    "startup rejection must not disclose the local artifact path",
  );
});
