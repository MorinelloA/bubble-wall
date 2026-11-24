import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Brightness (0 to 765) of one point on the wall, given as shares of its width and height. */
export async function wallBrightness(page: Page, x: number, y: number): Promise<number> {
  return page.evaluate(
    ([shareX, shareY]) => {
      const canvas = document.querySelector<HTMLCanvasElement>("canvas.wall");
      const pen = canvas?.getContext("2d");
      if (!canvas || !pen) return -1;
      const pixel = pen.getImageData(
        Math.floor(canvas.width * shareX),
        Math.floor(canvas.height * shareY),
        1,
        1,
      ).data;
      return (pixel.at(0) ?? 0) + (pixel.at(1) ?? 0) + (pixel.at(2) ?? 0);
    },
    [x, y] as const,
  );
}

test("the app loads and is ready", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("#app")).toHaveAttribute("data-ready", "true");
});

test("the wall is lit", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("canvas.wall")).toBeVisible();
  // Low in the first tube, where the light is brightest.
  await expect.poll(() => wallBrightness(page, 0.09, 0.95)).toBeGreaterThan(60);
});

test("the first screen has no accessibility violations", async ({ page }) => {
  await page.goto("./");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
