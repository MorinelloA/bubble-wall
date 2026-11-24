import { expect, test, type Page } from "@playwright/test";
import { expectNoViolations, firstTubeBase, openDrawer, startWall } from "./helpers";

interface Probe {
  state: string;
  master: number;
}

/** Watches the audio contexts the page makes, and the first level made on each (the master). */
async function watchAudio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: { context: AudioContext; master?: GainNode }[] = [];
    const probeHost = window as unknown as { audioProbe: () => Probe[] | null };
    // Some browser builds have no Web Audio at all (Playwright's WebKit on Windows).
    if (!("AudioContext" in window)) {
      probeHost.audioProbe = () => null;
      return;
    }
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        const entry: { context: AudioContext; master?: GainNode } = { context: this };
        seen.push(entry);
        const createGain = this.createGain.bind(this);
        this.createGain = () => {
          const gain = createGain();
          entry.master ??= gain;
          return gain;
        };
      }
    };
    probeHost.audioProbe = () =>
      seen.map((entry) => ({
        state: entry.context.state,
        master: entry.master?.gain.value ?? -1,
      }));
  });
}

/** The contexts made so far, or null when this browser has no Web Audio. */
const probe = (page: Page): Promise<Probe[] | null> =>
  page.evaluate(() => (window as unknown as { audioProbe: () => Probe[] | null }).audioProbe());

const contexts = async (page: Page): Promise<Probe[]> => (await probe(page)) ?? [];

/** Whether this browser build can play sound at all. Playwright's WebKit on Windows cannot. */
const canPlaySound = async (page: Page): Promise<boolean> => (await probe(page)) !== null;

/** How many contexts are running with the master level up. */
const playing = async (page: Page): Promise<number> =>
  (await contexts(page)).filter((entry) => entry.state === "running" && entry.master > 0.05).length;

/** The loudest master level of any context, or 0 when there is none. */
const loudest = async (page: Page): Promise<number> =>
  Math.max(0, ...(await contexts(page)).map((entry) => entry.master));

test("no sound is made before the first tap", async ({ page }) => {
  await watchAudio(page);
  await page.goto("./");
  await expect(page.getByRole("button", { name: "Tap to start" })).toBeVisible();
  expect(await contexts(page)).toEqual([]);
});

test("sound starts with the start tap; where it cannot play, a hint says so", async ({ page }) => {
  await watchAudio(page);
  await startWall(page);
  const canPlay = await canPlaySound(page);
  // One running context with its level up where the browser has Web Audio, none where it has not.
  await expect.poll(() => playing(page)).toBe(canPlay ? 1 : 0);
  await expect(page.getByRole("button", { name: "Tap for sound" })).toBeVisible({
    visible: !canPlay,
  });
  // Either way the wall itself is running.
  await expect
    .poll(async () => (await firstTubeBase(page)).reduce((sum, value) => sum + value, 0))
    .toBeGreaterThan(120);
  expect((await contexts(page)).length).toBeLessThanOrEqual(1);
  await expectNoViolations(page);
});

test("the Sounds tab mixes sounds and passes the accessibility check", async ({ page }) => {
  await startWall(page);
  await openDrawer(page);
  await page.getByRole("tab", { name: "Sounds" }).click();

  const rain = page.getByRole("button", { name: "Rain" });
  await expect(rain).toHaveAttribute("aria-pressed", "false");
  await rain.click();
  await expect(rain).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("slider", { name: "Rain" })).toBeVisible();

  await page.getByRole("button", { name: "Noise", exact: true }).click();
  await page.getByRole("button", { name: "Pink noise" }).click();
  await expect(page.getByRole("button", { name: "Pink noise" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expectNoViolations(page);
});

test("switching the wall off fades the sound to nothing", async ({ page }) => {
  await watchAudio(page);
  await startWall(page);
  const canPlay = await canPlaySound(page);
  await expect.poll(() => loudest(page)).toBeGreaterThan(canPlay ? 0.05 : -1);
  await openDrawer(page);
  await page.getByRole("button", { name: "Off", exact: true }).click();
  await expect.poll(() => loudest(page)).toBeLessThan(0.01);
});
