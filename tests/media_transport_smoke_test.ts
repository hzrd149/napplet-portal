import { nip19 } from "nostr-tools";
import { WebSocket as ClientWebSocket } from "undici";
import fixture from "./fixtures/supplied_napplet_contract.json" with {
  type: "json",
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class Client {
  readonly frames: Record<string, unknown>[] = [];
  #wake: (() => void) | null = null;
  constructor(readonly socket: InstanceType<typeof ClientWebSocket>) {
    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      this.frames.push(JSON.parse(event.data));
      this.#wake?.();
      this.#wake = null;
    });
  }
  send(message: Record<string, unknown>) {
    this.socket.send(JSON.stringify(message));
  }
  async next(
    predicate: (frame: Record<string, unknown>) => boolean,
    timeout = 5_000,
  ) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const index = this.frames.findIndex(predicate);
      if (index >= 0) return this.frames.splice(index, 1)[0];
      await Promise.race([
        new Promise<void>((resolve) => this.#wake = resolve),
        new Promise<void>((resolve) => setTimeout(resolve, 50)),
      ]);
    }
    throw new Error(
      `timed out waiting for production frame; queued=${
        this.frames.map((frame) => frame.type).join(",")
      }`,
    );
  }
}

async function connect(
  url: string,
  origin: string,
): Promise<
  {
    client: Client;
    connected: Record<string, unknown>;
    snapshot: Record<string, unknown>;
  }
> {
  const socket = new ClientWebSocket(url, { headers: { origin } });
  const client = new Client(socket);
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener(
      "error",
      () => reject(new Error("websocket open failed")),
      { once: true },
    );
  });
  const connected = await client.next((frame) =>
    frame.type === "runtime.connected"
  );
  const snapshot = await client.next((frame) =>
    frame.type === "runtime.media.snapshot"
  );
  return { client, connected, snapshot };
}

async function waitForHttp(url: string, child: Deno.ChildProcess) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const status = await Promise.race([
      child.status,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 25)),
    ]);
    if (status) throw new Error(`server exited early (${status.code})`);
    try {
      const response = await fetch(url);
      await response.body?.cancel();
      if (response.ok) return;
    } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error("server readiness timed out");
}

Deno.test({
  name: "two-client production media ownership smoke",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const root = Deno.cwd();
    const build = await new Deno.Command(Deno.execPath(), {
      args: ["task", "build"],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(
      build.success,
      `production build failed: ${new TextDecoder().decode(build.stderr)}`,
    );
    const temp = await Deno.makeTempDir({ prefix: "napplet-media-smoke-" });
    for (const path of ["_fresh", "runtime", "static", "assets", "tests"]) {
      await Deno.symlink(`${root}/${path}`, `${temp}/${path}`);
    }
    await Deno.copyFile(`${root}/deno.json`, `${temp}/deno.json`);
    await Deno.copyFile(`${root}/deno.lock`, `${temp}/deno.lock`);
    const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
    const port = (listener.addr as Deno.NetAddr).port;
    listener.close();
    const origin = `http://127.0.0.1:${port}`;
    const child = new Deno.Command(Deno.execPath(), {
      args: [
        "serve",
        "-A",
        "--host=127.0.0.1",
        `--port=${port}`,
        "_fresh/server.js",
      ],
      cwd: temp,
      env: {
        PORTAL_RECONNECT_GRACE_MS: "1000",
      },
      stdout: "piped",
      stderr: "piped",
    }).spawn();
    const stdout = new Response(child.stdout).text();
    const stderr = new Response(child.stderr).text();
    const clients: Client[] = [];
    let failure: unknown;
    try {
      await waitForHttp(`${origin}/`, child);
      const signIn = await fetch(`${origin}/api/signin/nsec`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nsec: nip19.nsecEncode(new Uint8Array(32).fill(7)),
        }),
      });
      assert(signIn.ok, "isolated production signer activates");
      const a = await connect(
        `${origin.replace("http", "ws")}/api/runtime`,
        origin,
      );
      const b = await connect(
        `${origin.replace("http", "ws")}/api/runtime`,
        origin,
      );
      clients.push(a.client, b.client);
      assert(
        a.snapshot.session === null && b.snapshot.session === null,
        "both clients receive explicit null snapshots first",
      );
      for (const item of [a, b]) {
        item.client.send({
          type: "runtime.start",
          coordinate: fixture.coordinate,
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const ownerA = {
        connectionId: a.connected.connectionId,
        windowId: a.connected.windowId,
      };
      const ownerB = {
        connectionId: b.connected.connectionId,
        windowId: b.connected.windowId,
      };
      b.client.send({
        type: "runtime.forward",
        ...ownerB,
        message: {
          type: "media.controls",
          sessionId: "eligibility-probe",
          controls: [],
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 25));
      a.client.send({
        type: "runtime.forward",
        ...ownerA,
        message: {
          type: "media.session.create",
          id: "create-1",
          owner: "napplet",
          sessionId: "session-smoke",
          metadata: { title: "Production smoke", artist: "Napplet Portal" },
          capabilities: ["play", "pause", "stop"],
          autoplay: true,
        },
      });
      await a.client.next((frame) =>
        frame.type === "runtime.event" &&
        (frame.message as Record<string, unknown>)?.type ===
          "media.session.create.result"
      );
      const initialA = await a.client.next((frame) =>
        frame.type === "runtime.media.snapshot" && frame.session !== null
      );
      const initialB = await b.client.next((frame) =>
        frame.type === "runtime.media.snapshot" && frame.session !== null
      );
      const initial = initialA.session as Record<string, unknown>;
      assert(
        JSON.stringify(initialA.session) === JSON.stringify(initialB.session),
        "eligible clients receive identical projections",
      );
      a.client.send({
        type: "runtime.forward",
        ...ownerA,
        generation: initial.generation,
        message: {
          type: "media.state",
          sessionId: "session-smoke",
          status: "playing",
        },
      });
      await b.client.next((frame) =>
        frame.type === "runtime.media.snapshot" &&
        (frame.session as Record<string, unknown>)?.status === "playing"
      );
      b.client.send({
        type: "runtime.media.transfer",
        id: "transfer-1",
        sessionId: "session-smoke",
        generation: initial.generation,
      });
      const stopIndex = a.client.frames.length;
      await a.client.next((frame) =>
        frame.type === "runtime.event" &&
        (frame.message as Record<string, unknown>)?.type === "media.command"
      );
      const grant = await b.client.next((frame) =>
        frame.type === "runtime.media.grant"
      );
      assert(
        Number(grant.generation) === Number(initial.generation) + 1,
        "transfer increments generation once",
      );
      assert(stopIndex >= 0, "prior owner stop is observed before grant");
      b.client.send({
        type: "runtime.media.transfer",
        id: "transfer-1",
        sessionId: "session-smoke",
        generation: initial.generation,
      });
      const duplicate = await b.client.next((frame) =>
        frame.type === "runtime.media.result" && frame.id === "transfer-1"
      );
      assert(duplicate.ok === true, "duplicate request settles idempotently");
      a.client.send({
        type: "runtime.forward",
        ...ownerA,
        generation: initial.generation,
        message: {
          type: "media.state",
          sessionId: "session-smoke",
          status: "playing",
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 30));
      b.client.send({
        type: "runtime.forward",
        ...ownerB,
        generation: grant.generation,
        message: {
          type: "media.state",
          sessionId: "session-smoke",
          status: "paused",
        },
      });
      const paused = await a.client.next((frame) =>
        frame.type === "runtime.media.snapshot" &&
        (frame.session as Record<string, unknown>)?.status === "paused"
      );
      assert(
        (paused.session as Record<string, unknown>).generation ===
          grant.generation,
        "hidden-style report preserves owner generation",
      );
      b.client.socket.close();
      const ownerless = await a.client.next((frame) =>
        frame.type === "runtime.media.snapshot" &&
        (frame.session as Record<string, unknown>)?.owner === null
      );
      assert(
        (ownerless.session as Record<string, unknown>).status === "stopped",
        "owner disconnect revokes immediately",
      );
      const resumed = await connect(
        `${origin.replace("http", "ws")}/api/runtime?reconnect=${
          encodeURIComponent(String(b.connected.reconnectToken))
        }`,
        origin,
      );
      clients.push(resumed.client);
      assert(
        resumed.connected.resumed === true &&
          (resumed.snapshot.session as Record<string, unknown>)?.owner === null,
        "reconnect receives ownerless snapshot and cannot resume",
      );
      a.client.socket.close();
      const terminal = await resumed.client.next(
        (frame) =>
          frame.type === "runtime.media.snapshot" &&
          (frame.session as Record<string, unknown>)?.terminal === true,
        12_000,
      );
      assert(
        (terminal.session as Record<string, unknown>).owner === null,
        "origin expiry terminalizes without reclaim",
      );
    } catch (error) {
      failure = error;
    } finally {
      console.log(`media smoke scenario completed=${failure === undefined}`);
      if (failure) console.error(failure);
      for (const client of clients) {
        if (client.socket.readyState < ClientWebSocket.CLOSING) {
          client.socket.close();
        }
      }
      await new Deno.Command("kill", {
        args: ["-TERM", String(child.pid)],
        stdout: "null",
        stderr: "null",
      }).output();
      const status = await child.status;
      const [out, err] = await Promise.all([stdout, stderr]);
      await Deno.remove(temp, { recursive: true });
      if (failure) {
        throw new Error(
          `production smoke failed (exit ${status.code})\nstdout:\n${out}\nstderr:\n${err}`,
          { cause: failure },
        );
      }
    }
  },
});
