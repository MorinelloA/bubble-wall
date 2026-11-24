import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the app loads and is ready", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("#app")).toHaveAttribute("data-ready", "true");
});

test("the first screen has no accessibility violations", async ({ page }) => {
  await page.goto("./");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
