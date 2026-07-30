import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.16";
import { loadRuntimeConfig } from "../runtime/config.ts";
import { RuntimeSettingsService } from "../runtime/settings.ts";
import { SettingsStore } from "../runtime/settings_store.ts";

Deno.test("settings use runtime defaults when the snapshot is absent", async () => {
  const directory = await Deno.makeTempDir();
  try {
    const defaults = loadRuntimeConfig({}, () => undefined);
    const service = await RuntimeSettingsService.create(
      new SettingsStore(`${directory}/settings.json`),
      defaults,
    );

    assertEquals(service.settings.relays, defaults.relays);
    assertEquals(service.settings.blossomServers, defaults.blossomServers);
    service.destroy();
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("settings reject corrupt and unsupported snapshots", async () => {
  const directory = await Deno.makeTempDir();
  const path = `${directory}/settings.json`;
  try {
    await Deno.writeTextFile(path, "not-json");
    await assertRejects(() => new SettingsStore(path).read(), Error);
    await Deno.writeTextFile(path, JSON.stringify({ version: 2 }));
    await assertRejects(() => new SettingsStore(path).read(), Error);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("settings canonicalize, persist queued writes, and emit reactively", async () => {
  const directory = await Deno.makeTempDir();
  const path = `${directory}/settings.json`;
  try {
    const defaults = loadRuntimeConfig({}, () => undefined);
    const store = new SettingsStore(path);
    const service = await RuntimeSettingsService.create(store, defaults);
    const emissions: string[][] = [];
    const subscription = service.settings$.subscribe((settings) => {
      emissions.push([...settings.relays]);
    });

    const first = service.save({
      relays: ["wss://relay.example", "wss://relay.example/"],
      remoteSignerRelays: ["wss://signer.example"],
      blossomServers: ["https://blossom.example"],
    });
    const second = service.save({
      relays: ["wss://last.example"],
      remoteSignerRelays: [],
      blossomServers: ["https://last.example/cache"],
    });
    await Promise.all([first, second]);

    assertEquals(service.settings.relays, ["wss://last.example/"]);
    assertEquals((await store.read())?.relays, ["wss://last.example/"]);
    assertEquals(emissions.at(-1), ["wss://last.example/"]);
    assertEquals(emissions.includes(["wss://relay.example/"]), false);

    subscription.unsubscribe();
    service.destroy();
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});
