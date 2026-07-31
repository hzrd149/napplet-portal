function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function freePort(): number {
  const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  return port;
}

class BufferedConnection {
  #buffer = new Uint8Array();
  constructor(readonly connection: Deno.TcpConn) {}

  async until(marker: Uint8Array): Promise<Uint8Array> {
    while (true) {
      const index = this.#find(marker);
      if (index >= 0) return this.#take(index + marker.length);
      await this.#fill();
    }
  }

  async exact(length: number): Promise<Uint8Array> {
    while (this.#buffer.length < length) await this.#fill();
    return this.#take(length);
  }

  async #fill(): Promise<void> {
    const chunk = new Uint8Array(4096);
    const read = await this.connection.read(chunk);
    if (read === null) throw new Error("socket closed before message");
    const next = new Uint8Array(this.#buffer.length + read);
    next.set(this.#buffer);
    next.set(chunk.subarray(0, read), this.#buffer.length);
    this.#buffer = next;
  }

  #take(length: number): Uint8Array {
    const value = this.#buffer.slice(0, length);
    this.#buffer = this.#buffer.slice(length);
    return value;
  }

  #find(marker: Uint8Array): number {
    outer: for (
      let index = 0;
      index <= this.#buffer.length - marker.length;
      index++
    ) {
      for (let offset = 0; offset < marker.length; offset++) {
        if (this.#buffer[index + offset] !== marker[offset]) continue outer;
      }
      return index;
    }
    return -1;
  }
}

async function connectRuntime(
  port: number,
  reconnectToken?: string,
): Promise<{ stream: BufferedConnection; message: Record<string, unknown> }> {
  const connection = await Deno.connect({ hostname: "127.0.0.1", port });
  const stream = new BufferedConnection(connection);
  const path = reconnectToken
    ? `/api/runtime?reconnect=${encodeURIComponent(reconnectToken)}`
    : "/api/runtime";
  const request = [
    `GET ${path} HTTP/1.1`,
    `Host: 127.0.0.1:${port}`,
    `Origin: http://127.0.0.1:${port}`,
    "Upgrade: websocket",
    "Connection: Upgrade",
    "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
    "Sec-WebSocket-Version: 13",
    "",
    "",
  ].join("\r\n");
  await connection.write(new TextEncoder().encode(request));
  const header = new TextDecoder().decode(
    await stream.until(new Uint8Array([13, 10, 13, 10])),
  );
  assert(
    header.startsWith("HTTP/1.1 101"),
    `upgrade failed: ${header.split("\r\n")[0]}`,
  );
  const first = await stream.exact(2);
  let length = first[1] & 0x7f;
  if (length === 126) {
    const extended = await stream.exact(2);
    length = (extended[0] << 8) | extended[1];
  } else if (length === 127) {
    const extended = await stream.exact(8);
    length = Number(new DataView(extended.buffer).getBigUint64(0));
  }
  const payload = await stream.exact(length);
  return {
    stream,
    message: JSON.parse(new TextDecoder().decode(payload)) as Record<
      string,
      unknown
    >,
  };
}

async function waitForHttp(
  url: string,
  process: Deno.ChildProcess,
): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const status = await Promise.race([
      process.status,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 25)),
    ]);
    if (status) throw new Error(`server exited early (${status.code})`);
    try {
      const response = await fetch(url);
      await response.body?.cancel();
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("server readiness timed out");
}

Deno.test({
  name: "built Fresh server resumes one runtime WebSocket namespace",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const build = new Deno.Command(Deno.execPath(), {
      args: ["task", "build"],
      stdout: "piped",
      stderr: "piped",
    });
    const built = await build.output();
    assert(
      built.success,
      `production build failed: ${new TextDecoder().decode(built.stderr)}`,
    );

    const port = freePort();
    const bind = `127.0.0.1:${port}`;
    const origin = `http://${bind}`;
    const child = new Deno.Command("setsid", {
      args: [Deno.execPath(), "task", "start"],
      env: { PORTAL_BIND: "127.0.0.1", PORTAL_PORT: String(port) },
      stdout: "piped",
      stderr: "piped",
    }).spawn();
    const sockets = new Set<Deno.TcpConn>();
    try {
      await waitForHttp(`${origin}/`, child);
      const first = await connectRuntime(port);
      sockets.add(first.stream.connection);
      const connected = first.message;
      assert(connected.type === "runtime.connected", "first socket connects");
      assert(
        typeof connected.connectionId === "string",
        "connection id exists",
      );
      assert(typeof connected.windowId === "string", "window id exists");
      assert(typeof connected.reconnectToken === "string", "token exists");
      first.stream.connection.close();
      sockets.delete(first.stream.connection);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const second = await connectRuntime(
        port,
        String(connected.reconnectToken),
      );
      sockets.add(second.stream.connection);
      const resumed = second.message;
      assert(resumed.type === "runtime.connected", "second socket connects");
      assert(resumed.resumed === true, "attachment is resumed");
      assert(
        resumed.connectionId === connected.connectionId,
        "connection namespace remains",
      );
      assert(
        resumed.windowId === connected.windowId,
        "window namespace remains",
      );
      assert(sockets.size === 1, "handoff leaves one live client socket");
    } finally {
      for (const socket of sockets) socket.close();
      await new Deno.Command("kill", {
        args: ["-TERM", "--", `-${child.pid}`],
        stdout: "null",
        stderr: "null",
      }).output();
      await child.status;
      await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
    }
  },
});
