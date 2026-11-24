import { defineConfig, devices } from "@playwright/test";

// Runs against the production build, in the two engines that matter: WebKit is
// what the iPad uses, Chromium is the second opinion.
//
// Set BASE_URL to test a copy that is already being served, such as the whole
// site run locally (http://localhost:8788/bubble-wall/) or the live address.
// It must end with a slash: the tests open "./".
const served = process.env.BASE_URL;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: served ?? "http://localhost:4173",
    viewport: { width: 1024, height: 768 },
    hasTouch: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], viewport: { width: 1024, height: 768 } },
    },
  ],
  ...(served
    ? {}
    : {
        webServer: {
          command: "npm run preview",
          url: "http://localhost:4173",
          reuseExistingServer: false,
          timeout: 60_000,
        },
      }),
});
