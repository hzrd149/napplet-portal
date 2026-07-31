import { defineConfig, devices } from "@playwright/test";

const port = 41_739;
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: ".",
  testMatch: "tests/browser/**/*.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: origin,
    browserName: "chromium",
    headless: true,
    launchOptions: {
      executablePath: "/snap/bin/chromium",
      args: ["--no-sandbox"],
    },
    trace: "retain-on-failure",
  },
  projects: [{
    name: "chromium-phone",
    use: {
      ...devices["Pixel 7"],
      browserName: "chromium",
    },
  }],
  webServer: {
    command: `deno serve -A --host=127.0.0.1 --port=${port} _fresh/server.js`,
    env: {
      PORTAL_BIND: "127.0.0.1",
      PORTAL_PORT: String(port),
      NAPPLET_COORDINATE: "",
    },
    url: origin,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
