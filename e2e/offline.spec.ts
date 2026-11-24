import { expect, test, type Page } from "@playwright/test";
import { firstTubeBase, openDrawer, startWall } from "./helpers";

/** The names of the caches on this origin, in order. */
const cacheNames = (page: Page): Promise<string[]> =>
  page.evaluate(async () => (await caches.keys()).toSorted((a, b) => a.localeCompare(b)));

/** Waits until the app's offline copy has been saved. */
async function waitForOfflineCopy(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(async () => (await cacheNames(page)).filter((name) => name.startsWith("bubble-wall-")))
    .toHaveLength(1);
}

test("opens and works with no network after the first visit", async ({ page, context }) => {
  await page.goto("./");
  await waitForOfflineCopy(page);

  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Tap to start" }).click();
  await expect
    .poll(async () => (await firstTubeBase(page)).reduce((sum, value) => sum + value, 0))
    .toBeGreaterThan(120);
  await openDrawer(page);
  await page.getByRole("button", { name: "Green", exact: true }).click();
  await expect(page.getByRole("button", { name: "Green", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // The manifest and an icon come from the saved copy too.
  const saved = await page.evaluate(async () => {
    const answers = await Promise.all([
      fetch("./manifest.webmanifest"),
      fetch("./icons/icon-192.png"),
    ]);
    return answers.map((answer) => answer.status);
  });
  expect(saved).toEqual([200, 200]);
});

test("talks to no other site, and nothing breaks the security policy", async ({
  page,
  baseURL,
}) => {
  const home = new URL(baseURL ?? "http://localhost").origin;
  const elsewhere: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== home) elsewhere.push(request.url());
  });
  await page.addInitScript(() => {
    const blocked: string[] = [];
    (window as unknown as { blocked: string[] }).blocked = blocked;
    document.addEventListener("securitypolicyviolation", (event) => {
      blocked.push(`${event.violatedDirective}: ${event.blockedURI}`);
    });
  });

  await startWall(page);
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
    "content",
    /default-src 'self'/,
  );
  // Use every part of the app that sets styles or makes anything.
  await openDrawer(page);
  await page.getByRole("button", { name: "Pink", exact: true }).click();
  for (const tab of ["Sounds", "Wall", "More"]) await page.getByRole("tab", { name: tab }).click();
  await page.locator("button.slot").first().click({ delay: 1200 });
  await page.getByRole("button", { name: "Lava" }).click();
  await waitForOfflineCopy(page);

  expect(elsewhere).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { blocked: string[] }).blocked)).toEqual(
    [],
  );
});

test("leaves the other apps' saved files alone and tidies up only its own", async ({ page }) => {
  // The Game Room and Marble Run keep caches on the same origin. An older copy of
  // this app is cleared away; theirs are not touched.
  await page.addInitScript(() => {
    void caches.open("marblerun-v12");
    void caches.open("games-shell");
    void caches.open("bubble-wall-0000000000000000");
  });
  await page.goto("./");
  await waitForOfflineCopy(page);

  const names = await cacheNames(page);
  expect(names).toContain("marblerun-v12");
  expect(names).toContain("games-shell");
  expect(names).not.toContain("bubble-wall-0000000000000000");
  expect(names).toHaveLength(3);
});
