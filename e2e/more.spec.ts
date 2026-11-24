import { expect, test } from "@playwright/test";
import { expectNoViolations, openDrawer, startWall } from "./helpers";

test("what he sets is still there after the app is closed and opened again", async ({ page }) => {
  await startWall(page);
  await openDrawer(page);
  await page.getByRole("button", { name: "Red", exact: true }).click();
  await page.getByRole("tab", { name: "Wall" }).click();
  await page.getByRole("button", { name: "Three tubes" }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("tab", { name: "Sounds" }).click();
  await page.getByRole("button", { name: "Rain" }).click();

  // Leaving the page saves at once; nothing waits on a timer.
  await page.reload();
  await page.getByRole("button", { name: "Tap to start" }).click();
  await openDrawer(page);
  await expect(page.getByRole("button", { name: "Red", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("tab", { name: "Wall" }).click();
  await expect(page.getByRole("button", { name: "Three tubes" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("tab", { name: "Sounds" }).click();
  await expect(page.getByRole("button", { name: "Rain" })).toHaveAttribute("aria-pressed", "true");
});

test("a favourite is saved by holding and brought back by tapping", async ({ page }) => {
  await startWall(page);
  await openDrawer(page);
  await page.getByRole("button", { name: "Pink", exact: true }).click();
  await page.getByRole("tab", { name: "More" }).click();

  const first = page.locator("button.slot").first();
  await expect(first).toHaveAccessibleName("Favourite 1. Empty. Hold to save");
  await first.click({ delay: 1300 });
  await expect(first).toHaveAccessibleName("Favourite 1. Tap to use, hold to save again");

  await page.getByRole("tab", { name: "Remote" }).click();
  await page.getByRole("button", { name: "Green", exact: true }).click();
  await page.getByRole("tab", { name: "More" }).click();
  await first.click();
  await page.getByRole("tab", { name: "Remote" }).click();
  await expect(page.getByRole("button", { name: "Pink", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("the More tab has scenes and a timer, and passes the accessibility check", async ({
  page,
}) => {
  await startWall(page);
  await openDrawer(page);
  await page.getByRole("tab", { name: "More" }).click();

  await page.getByRole("button", { name: "Night Light" }).click();
  await expect(page.getByRole("progressbar")).toBeHidden();
  await page.getByRole("button", { name: "5 minutes", exact: true }).click();
  await expect(page.getByRole("button", { name: "5 minutes", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("progressbar", { name: "Time left on the timer" })).toBeVisible();
  await expectNoViolations(page);

  await page.getByRole("tab", { name: "Remote" }).click();
  await expect(page.getByRole("button", { name: "Indigo" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("the grown-up area opens on a three-second hold and can lock the remote", async ({ page }) => {
  await startWall(page);
  const lock = page.getByRole("button", { name: "Grown-ups: hold for three seconds" });
  const dialog = page.getByRole("dialog", { name: "Grown-up settings" });

  await lock.click();
  await expect(dialog).toBeHidden();
  await lock.click({ delay: 3300 });
  await expect(dialog).toBeVisible();
  await expectNoViolations(page);

  await dialog.getByRole("button", { name: "Lock the remote" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Remote drawer" })).toBeHidden();

  // The lock is still reachable, so a grown-up can undo it.
  await lock.click({ delay: 3300 });
  await dialog.getByRole("button", { name: "Lock the remote" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Remote drawer" })).toBeVisible();
});
