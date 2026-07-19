import { defineConfig, devices } from "@playwright/test";

/**
 * TX-80 browser regression layer (Gate 2+).
 *
 * Runs against the dev server (real app, real module graph — which also
 * lets tests assert that the quarantined src/audio engine never loads).
 * Specs use the `.e2e.ts` suffix so vitest never picks them up.
 */

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Optional Chromium executable override for sandboxed CI environments that
// pre-install a pinned browser (e.g. PLAYWRIGHT_CHROMIUM_EXECUTABLE=
// /opt/pw-browsers/chromium). Unset locally — the default download is used.
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "test-results/e2e-results.json" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 900 },
    // Touch enabled so multi-pointer ownership scenarios can use genuine
    // trusted touch events alongside the mouse pointer.
    hasTouch: true,
    // A real click supplies user activation, so the default (gesture-gated)
    // autoplay policy is kept — startup is validated as genuinely
    // gesture-driven rather than papered over.
    launchOptions: {
      args: ["--mute-audio"],
      ...(chromiumExecutable ? { executablePath: chromiumExecutable } : {}),
    },
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 }, hasTouch: true },
    },
    {
      // Mobile WebKit — closer to real iPhone Safari sticky/fixed + overflow behavior
      name: "mobile-webkit",
      use: {
        ...devices["iPhone 13 Pro"],
        viewport: { width: 430, height: 932 },
        hasTouch: true,
        isMobile: true,
      },
      testMatch: ["**/fixed-header.e2e.ts"],
    },
  ],
});
