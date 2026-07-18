import { test, expect, type Page } from "@playwright/test";

/**
 * Offline / PWA validation against the REAL production build served by
 * `wrangler dev` (actual sw.js, precache, SSR shell) — not the dev server.
 */

const powerBtn = (page: Page) => page.getByRole("button", { name: /Power on|Power off/ });

async function waitForController(page: Page) {
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) throw new Error("no serviceWorker");
    await navigator.serviceWorker.ready;
  });
}

test("service worker registers, controls the page, and precache is populated", async ({ page }) => {
  await page.goto("/");
  await expect(powerBtn(page)).toBeVisible();
  await waitForController(page);
  // A reload lets the freshly-activated worker control the navigation.
  await page.reload();
  await expect(powerBtn(page)).toBeVisible();

  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  expect(controlled).toBe(true);

  const cacheState = await page.evaluate(async () => {
    const names = await caches.keys();
    const tx = names.filter((n) => n.startsWith("tx27-"));
    let entries = 0;
    if (tx.length) {
      const c = await caches.open(tx[0]);
      entries = (await c.keys()).length;
    }
    return { names: tx, entries };
  });
  expect(cacheState.names.length).toBeGreaterThanOrEqual(1);
  expect(cacheState.entries).toBeGreaterThanOrEqual(5);
});

test("all runtime assets on first load are same-origin (no remote CDN)", async ({ page }) => {
  const cross: string[] = [];
  const origin = new URL("/", "http://127.0.0.1:8788").origin;
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (u.origin !== origin && u.protocol !== "data:" && u.protocol !== "blob:") {
      cross.push(req.url());
    }
  });
  await page.goto("/");
  await expect(powerBtn(page)).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(cross, `unexpected cross-origin requests: ${cross.join(", ")}`).toHaveLength(0);
});

test("app reloads and stays usable while offline", async ({ page, context }) => {
  await page.goto("/");
  await expect(powerBtn(page)).toBeVisible();
  await waitForController(page);
  await page.reload();
  await expect(powerBtn(page)).toBeVisible();

  // Persist a marker to prove state survives the offline reload.
  await page.evaluate(() => localStorage.setItem("tx27-e2e-offline-marker", "1"));

  await context.setOffline(true);
  await page.reload();
  await expect(powerBtn(page)).toBeVisible({ timeout: 15_000 });
  const marker = await page.evaluate(() => localStorage.getItem("tx27-e2e-offline-marker"));
  expect(marker).toBe("1");

  await context.setOffline(false);
});

test("served sw.js carries an injected content-hash cache version + build id", async ({
  request,
}) => {
  const res = await request.get("/sw.js");
  expect(res.status()).toBe(200);
  const body = await res.text();
  const version = body.match(/CACHE_VERSION\s*=\s*"([^"]+)"/)?.[1];
  const build = body.match(/BUILD_ID\s*=\s*"([^"]+)"/)?.[1];
  // Placeholders would remain if injection failed.
  expect(version).toBeTruthy();
  expect(version).not.toContain("__");
  expect(version!.length).toBeGreaterThanOrEqual(8);
  expect(build).toBeTruthy();
  expect(build).not.toContain("__");
  // Old-versioned caches are cleaned in the activate handler.
  expect(body).toContain("caches.delete");
});
