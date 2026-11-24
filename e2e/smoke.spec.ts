import { expect, test } from "@playwright/test";
import { expectNoViolations, firstTubeBase, openDrawer, startWall } from "./helpers";

test("opens on a start screen with nothing an accessibility check objects to", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("#app")).toHaveAttribute("data-ready", "true");
  await expect(page.getByRole("button", { name: "Tap to start" })).toBeVisible();
  await expectNoViolations(page);
});

test("the wall lights up after the start tap", async ({ page }) => {
  await startWall(page);
  await expect
    .poll(async () => (await firstTubeBase(page)).reduce((sum, value) => sum + value, 0))
    .toBeGreaterThan(120);
});

test("the remote changes the wall: a colour, then a show", async ({ page }) => {
  await startWall(page);
  await openDrawer(page);

  await page.getByRole("button", { name: "Green", exact: true }).click();
  await expect(page.getByRole("button", { name: "Green", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect
    .poll(async () => {
      const [red, green, blue] = await firstTubeBase(page);
      return green > 150 && green > red * 2 && green > blue * 2;
    })
    .toBe(true);

  await page.getByRole("button", { name: "Blue", exact: true }).click();
  await expect
    .poll(async () => {
      const [red, green, blue] = await firstTubeBase(page);
      return blue > 150 && blue > red * 2 && blue > green * 2;
    })
    .toBe(true);

  await page.getByRole("button", { name: "Smooth" }).click();
  await expect(page.getByRole("button", { name: "Smooth" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Blue", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("Off fades the wall to dark and On brings it back", async ({ page }) => {
  await startWall(page);
  await openDrawer(page);
  await page.getByRole("button", { name: "White" }).click();
  await page.getByRole("button", { name: "Off", exact: true }).click();
  await expect
    .poll(async () => (await firstTubeBase(page)).reduce((sum, value) => sum + value, 0))
    .toBeLessThan(15);
  await page.getByRole("button", { name: "On", exact: true }).click();
  await expect
    .poll(async () => (await firstTubeBase(page)).reduce((sum, value) => sum + value, 0))
    .toBeGreaterThan(400);
});

test("the open drawer passes the accessibility check on both tabs", async ({ page }) => {
  await startWall(page);
  await openDrawer(page);
  await expectNoViolations(page);
  await page.getByRole("tab", { name: "Wall" }).click();
  await expect(page.getByRole("button", { name: "Rainbow" })).toBeVisible();
  await expectNoViolations(page);
});

test("the drawer can be used with the keyboard alone", async ({ page }) => {
  await page.goto("./");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.locator(".start")).toHaveCount(0);

  await page.getByRole("button", { name: "Remote drawer" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: "Remote" })).toBeFocused();

  // Into the remote, along to Red (On, Off, Dimmer, Brighter come first), and press it.
  for (let presses = 0; presses < 5; presses += 1) await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Red", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Red", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.keyboard.press("Escape");
  await expect(page.locator("aside.drawer")).not.toHaveClass(/is-open/);
  await expect(page.getByRole("button", { name: "Remote drawer" })).toBeFocused();
});
