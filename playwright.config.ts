import { defineConfig, devices } from "@playwright/test";

/**
 * Gate 2 browser/device smoke layer.
 *
 * Serves the REAL production build (nitro/Cloudflare worker output in
 * `.output`) through `wrangler dev` so the actual service worker, precache,
 * and SSR shell are exercised — not the dev server. Run `bun run build`
 * first (`test:e2e:build` does both in one command).
 *
 * Specs use the `.e2e.ts` suffix so the Vitest unit runner (which matches
 * `*.test.ts` / `*.spec.ts`) never picks them up.
 */

const PORT = 8788;
const BASE_URL = `http://127.0.0.1:${PORT}`;

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
    // A real click supplies user activation, so the default (gesture-gated)
    // autoplay policy is kept — this validates genuine gesture-driven audio
    // startup rather than papering over it.
    launchOptions: { args: ["--mute-audio"] },
  },
  webServer: {
    command: `bunx wrangler dev -c .output/server/wrangler.json --port ${PORT} --ip 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
      testMatch: ["**/lifecycle.e2e.ts", "**/preset-state.e2e.ts", "**/offline-pwa.e2e.ts"],
    },
    {
      name: "edge-desktop",
      use: { ...devices["Desktop Edge"], channel: "msedge" },
      testMatch: ["**/desktop-smoke.e2e.ts"],
    },
    {
      name: "emu-iphone-portrait",
      use: { ...devices["iPhone 13"] },
      testMatch: ["**/responsive.e2e.ts"],
    },
    {
      name: "emu-iphone-landscape",
      use: { ...devices["iPhone 13 landscape"] },
      testMatch: ["**/responsive.e2e.ts"],
    },
    {
      name: "emu-android-portrait",
      use: { ...devices["Pixel 7"] },
      testMatch: ["**/responsive.e2e.ts"],
    },
    {
      name: "emu-android-landscape",
      use: { ...devices["Pixel 7 landscape"] },
      testMatch: ["**/responsive.e2e.ts"],
    },
    {
      name: "emu-tablet-portrait",
      use: { ...devices["Galaxy Tab S4"] },
      testMatch: ["**/responsive.e2e.ts"],
    },
    {
      name: "emu-tablet-landscape",
      use: { ...devices["Galaxy Tab S4 landscape"] },
      testMatch: ["**/responsive.e2e.ts"],
    },
  ],
});
