import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** The colour of one point on the wall, given as shares of its width and height. */
export async function wallColor(
  page: Page,
  x: number,
  y: number,
): Promise<[number, number, number]> {
  return page.evaluate(
    ([shareX, shareY]) => {
      const canvas = document.querySelector<HTMLCanvasElement>("canvas.wall");
      const pen = canvas?.getContext("2d");
      if (!canvas || !pen) return [-1, -1, -1] as [number, number, number];
      const pixel = pen.getImageData(
        Math.floor(canvas.width * shareX),
        Math.floor(canvas.height * shareY),
        1,
        1,
      ).data;
      return [pixel.at(0) ?? 0, pixel.at(1) ?? 0, pixel.at(2) ?? 0] as [number, number, number];
    },
    [x, y] as const,
  );
}

/** Low in the first tube, where the light is brightest and no divider is in the way. */
export const firstTubeBase = (page: Page) => wallColor(page, 0.09, 0.97);

/** Opens the app and taps the start screen away. */
export async function startWall(page: Page): Promise<void> {
  await page.goto("./");
  await page.getByRole("button", { name: "Tap to start" }).click();
  await expect(page.locator(".start")).toHaveCount(0);
}

export async function openDrawer(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Remote drawer" }).click();
  await expect(page.locator("aside.drawer")).toHaveClass(/is-open/);
}

export async function expectNoViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}
