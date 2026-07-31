import { expect, test } from "@playwright/test";

test("phone tracer loads the built portal without browser or layout failures", async ({ page }) => {
  const browserFailures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserFailures.push(message.text());
  });
  page.on("pageerror", (error) => browserFailures.push(error.message));

  await page.goto("/");
  await expect(page).toHaveTitle("Napplet Portal");
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open account" }))
    .toBeVisible();

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(browserFailures).toEqual([]);
});
