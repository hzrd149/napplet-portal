import { expect, type Page, test } from "@playwright/test";

const CHROMIUM_ONLY =
  "Automated local Chromium evidence; physical iOS/Android remains NOT RUN.";
const TEST_NSEC =
  "nsec1qurswpc8qurswpc8qurswpc8qurswpc8qurswpc8qurswpc8qursl6edet";

function annotateDeviceBoundary(): void {
  test.info().annotations.push({
    type: "device-boundary",
    description: CHROMIUM_ONLY,
  });
}

function collectBrowserFailures(page: Page): string[] {
  const failures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(message.text());
  });
  page.on("pageerror", (error) => failures.push(error.stack ?? error.message));
  return failures;
}

test("phone tracer loads the built portal without browser or layout failures", async ({ page }) => {
  annotateDeviceBoundary();
  const browserFailures = collectBrowserFailures(page);
  const navigation = await page.goto("/");
  await expect(page).toHaveTitle("Napplet Portal");
  const hydrationNonce = await page.locator("script[type=module][nonce]")
    .evaluate((script) => (script as HTMLScriptElement).nonce);
  expect(hydrationNonce).toBeTruthy();
  const csp = navigation?.headers()["content-security-policy"] ?? "";
  expect(csp).toContain(`'nonce-${hydrationNonce}'`);
  expect(
    csp.split("; ").find((directive) => directive.startsWith("script-src ")),
  ).not.toContain("'unsafe-inline'");
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open account" }))
    .toBeVisible();
  expect(
    await page.evaluate(() =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
    ),
  ).toBeLessThanOrEqual(0);
  expect(browserFailures).toEqual([]);
});

test("portrait landscape accessibility focus and dialog return", async ({ page }) => {
  annotateDeviceBoundary();
  const browserFailures = collectBrowserFailures(page);
  await page.goto("/");
  for (
    const viewport of [{ width: 412, height: 915 }, { width: 915, height: 412 }]
  ) {
    await page.setViewportSize(viewport);
    expect(
      await page.evaluate(() => ({
        document: document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
        body: document.body.scrollWidth - document.body.clientWidth,
      })),
    ).toEqual({ document: 0, body: 0 });
  }
  const account = page.getByRole("button", { name: "Open account" });
  await account.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Account" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "System" })).toBeChecked();
  await dialog.getByRole("button", { name: "Close account" }).click();
  await expect(account).toBeFocused();
  expect(browserFailures).toEqual([]);
});

test("system light dark and reduced motion remain portal-owned", async ({ page }) => {
  annotateDeviceBoundary();
  const browserFailures = collectBrowserFailures(page);
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Open account" }).click();
  await page.getByRole("radio", { name: "Light" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("radio", { name: "Dark" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.locator("html").evaluate((root) => root.style.colorScheme))
    .toBe("dark");
  expect(
    await page.evaluate(() =>
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ),
  ).toBe(true);
  expect(browserFailures).toEqual([]);
});

test("history reconnect visibility and reserved intent lifecycle use browser primitives", async ({ context, page }) => {
  annotateDeviceBoundary();
  const browserFailures = collectBrowserFailures(page);
  const signIn = await page.request.post("/api/signin/nsec", {
    data: { nsec: TEST_NSEC },
  });
  expect(signIn.ok()).toBe(true);
  await page.goto("/");
  await expect(
    page.getByRole("button", {
      name:
        /Connection status: (The napplet is being verified|The portal is ready)/,
    }),
  ).toBeVisible();
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Runtime settings" }))
    .toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/settings$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await context.setOffline(true);
  await expect(page.getByRole("button", { name: /offline/ })).toBeVisible();
  await context.setOffline(false);
  await page.bringToFront();
  await expect(page.getByRole("button", {
    name:
      /Connection status: (The connection was interrupted and is recovering|Recovery is paused while this tab is hidden|The napplet is being verified|The portal is ready)/,
  })).toBeVisible({ timeout: 10_000 });

  const popupPromise = page.waitForEvent("popup");
  await page.evaluate(() =>
    globalThis.open("/intent/reserved#invalid", "intent-test")
  );
  const popup = await popupPromise;
  const popupFailures = collectBrowserFailures(popup);
  await popup.waitForLoadState("networkidle");
  await expect(popup.getByText("Invalid navigation reservation."))
    .toBeVisible();
  await expect(popup).toHaveURL(/\/intent\/reserved$/);
  expect(await popup.evaluate(() => opener)).toBeNull();
  await popup.close();
  expect(popup.isClosed()).toBe(true);
  expect([...browserFailures, ...popupFailures]).toEqual([]);
});

test("two browser pages revoke the prior media owner before granting transfer", async ({ context, page }) => {
  annotateDeviceBoundary();
  const second = await context.newPage();
  const browserFailures = collectBrowserFailures(page);
  const secondBrowserFailures = collectBrowserFailures(second);
  await Promise.all([page.goto("/settings"), second.goto("/settings")]);
  expect(
    await page.evaluate(async (nsec) => {
      const response = await fetch("/api/signin/nsec", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nsec,
        }),
      });
      return response.ok;
    }, TEST_NSEC),
  ).toBe(true);

  const openPeer = async (target: Page) => {
    await target.evaluate(() => {
      const socket = new WebSocket(
        `${location.origin.replace("http", "ws")}/api/runtime`,
      );
      const frames: Record<string, unknown>[] = [];
      const waiters: (() => void)[] = [];
      socket.addEventListener("message", (event) => {
        frames.push(JSON.parse(String(event.data)));
        waiters.splice(0).forEach((wake) => wake());
      });
      (globalThis as typeof globalThis & { __peer: unknown }).__peer = {
        socket,
        frames,
        waiters,
      };
    });
    const next = (type: string, nestedType?: string) =>
      target.evaluate(async ({ type, nestedType }) => {
        const peer = (globalThis as typeof globalThis & {
          __peer: {
            frames: Record<string, unknown>[];
            waiters: (() => void)[];
          };
        }).__peer;
        const deadline = Date.now() + 8_000;
        while (Date.now() < deadline) {
          const index = peer.frames.findIndex((frame) =>
            frame.type === type &&
            (!nestedType ||
              (frame.message as Record<string, unknown> | undefined)?.type ===
                nestedType)
          );
          if (index >= 0) return peer.frames.splice(index, 1)[0];
          await Promise.race([
            new Promise<void>((resolve) => peer.waiters.push(resolve)),
            new Promise((resolve) => setTimeout(resolve, 50)),
          ]);
        }
        throw new Error(
          `timed out waiting for ${type}/${nestedType ?? ""}; queued=${
            peer.frames.map((frame) =>
              `${String(frame.type)}:${
                String(
                  (frame.message as Record<string, unknown> | undefined)
                    ?.type ?? "",
                )
              }`
            ).join(",")
          }`,
        );
      }, { type, nestedType });
    const connected = await next("runtime.connected") as {
      connectionId: string;
      windowId: string;
    };
    await next("runtime.media.snapshot");
    return {
      connected,
      next,
      send: (message: Record<string, unknown>) =>
        target.evaluate((message) => {
          const peer = (globalThis as typeof globalThis & {
            __peer: { socket: WebSocket };
          }).__peer;
          peer.socket.send(JSON.stringify(message));
        }, message),
      close: () =>
        target.evaluate(() => {
          const peer = (globalThis as typeof globalThis & {
            __peer: { socket: WebSocket };
          }).__peer;
          peer.socket.close();
        }),
    };
  };

  const [a, b] = await Promise.all([openPeer(page), openPeer(second)]);
  try {
    for (const peer of [a, b]) {
      await peer.send({
        type: "runtime.start",
        coordinate:
          "naddr1qvzqqqyf8ypzpem34u9stj8ftlxldl4n2qz5f5hmrnxns3uga86fpwe7u28ga4n0qqx8xetrw4exjare94kxzcsuktmwx",
      });
      await peer.next("runtime.artifact");
    }
    await b.send({
      type: "runtime.forward",
      ...b.connected,
      message: {
        type: "media.controls",
        sessionId: "eligibility",
        controls: [],
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    await a.send({
      type: "runtime.forward",
      ...a.connected,
      message: {
        type: "media.session.create",
        id: "create-browser",
        owner: "napplet",
        sessionId: "browser-session",
        metadata: { title: "Browser acceptance", artist: "Napplet Portal" },
        capabilities: ["play", "pause", "stop"],
        autoplay: true,
      },
    });
    await a.next("runtime.event", "media.session.create.result");
    await a.next("runtime.media.grant");
    const initial = await a.next("runtime.media.snapshot");
    await b.next("runtime.media.snapshot");
    const session = initial.session as Record<string, unknown>;
    await a.send({
      type: "runtime.forward",
      ...a.connected,
      generation: session.generation,
      message: {
        type: "media.state",
        sessionId: "browser-session",
        status: "playing",
      },
    });
    await b.next("runtime.media.snapshot");
    await b.send({
      type: "runtime.media.transfer",
      id: "transfer-browser",
      sessionId: "browser-session",
      generation: session.generation,
    });
    const stop = await a.next("runtime.event", "media.command");
    const grant = await b.next("runtime.media.grant");
    expect((stop.message as Record<string, unknown>).action).toBe("stop");
    expect(Number(grant.generation)).toBe(Number(session.generation) + 1);
  } finally {
    await Promise.all([a.close(), b.close()]);
  }
  expect([...browserFailures, ...secondBrowserFailures]).toEqual([]);
});
