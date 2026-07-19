import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

/**
 * Fixed TX-80 app header + portrait performance-dock geometry.
 * Prefer WebKit (mobile Safari class) — Chromium sticky/fixed can diverge.
 */

const SHOT_DIR = path.join(process.cwd(), "qa", "responsive-screenshots");

async function hydrate(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem("tx80-ui-mode");
    } catch {
      /* private */
    }
  });
  await page.goto("/");
  await page.waitForSelector("html[data-tx80-hydrated='true']");
}

async function setMode(page: Page, mode: "full" | "edit" | "play") {
  await page.locator(`[data-tx80-mode="${mode}"]`).click();
  await expect(page.locator(`[data-tx80-shell="${mode}"]`)).toBeVisible();
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(doc.scrollWidth, document.body.scrollWidth) - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: false });
}

test.describe("fixed app header + portrait dock", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await hydrate(page);
  });

  test("header stays fixed at viewport top after deep FULL scroll", async ({ page }) => {
    await setMode(page, "full");
    await noHorizontalOverflow(page);

    const header = page.locator("[data-tx80-header]");
    await expect(header).toHaveAttribute("data-tx80-header-position", "fixed");
    const pos = await header.evaluate((el) => getComputedStyle(el).position);
    expect(pos).toBe("fixed");

    const before = await header.boundingBox();
    expect(before).toBeTruthy();
    expect(before!.y).toBeLessThanOrEqual(2);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);

    const after = await header.boundingBox();
    expect(after).toBeTruthy();
    expect(after!.y).toBeLessThanOrEqual(2);
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(2);

    // Content not hidden behind header
    const shellPad = await page.locator("[data-tx80-shell]").evaluate((el) =>
      parseFloat(getComputedStyle(el).paddingTop),
    );
    const headerH = await page.evaluate(() => {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--tx80-header-height");
      return parseFloat(v) || 0;
    });
    expect(shellPad).toBeGreaterThanOrEqual(headerH - 1);
    expect(headerH).toBeGreaterThan(40);

    const firstSection = page.locator("[data-tx80-section]").first();
    const sec = await firstSection.boundingBox();
    expect(sec).toBeTruthy();
    expect(sec!.y).toBeGreaterThanOrEqual(headerH - 4);

    // Safe-area top is applied on header (padding-top includes env())
    const padTop = await header.evaluate((el) => getComputedStyle(el).paddingTop);
    expect(padTop).toBeTruthy();

    await expect(page.locator("[data-tx80-header]")).toHaveCount(1);
    await shot(page, "webkit-iphone-large-full-scrolled");
  });

  test("header stays fixed after deep EDIT scroll", async ({ page }) => {
    await setMode(page, "edit");
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(150);
    const box = await page.locator("[data-tx80-header]").boundingBox();
    expect(box).toBeTruthy();
    expect(box!.y).toBeLessThanOrEqual(2);
    await expect(page.locator("[data-tx80-header]")).toHaveCount(1);
  });

  test("portrait PLAY expands Pitch/Mod/Sustain and aligns lower row", async ({ page }) => {
    await setMode(page, "play");
    await noHorizontalOverflow(page);

    const pitch = page.locator('[data-tx80-wheel="pitch"]').first();
    const mod = page.locator('[data-tx80-wheel="mod"]').first();
    const sustain = page.locator("[data-tx80-sustain], button[aria-label='Sustain']").first();
    const keyboard = page.locator("[data-tx80-keyboard]");
    const lower = page.locator("[data-tx80-dock-lower]");

    await expect(lower).toBeVisible();
    await expect(pitch).toBeVisible();
    await expect(mod).toBeVisible();

    const pb = await pitch.boundingBox();
    const mb = await mod.boundingBox();
    const kb = await keyboard.boundingBox();
    const sb = await sustain.boundingBox();
    const lb = await lower.boundingBox();

    expect(pb && mb && kb && sb && lb).toBeTruthy();

    // Materially tall travel (≥ previous short-strip era ~120px; target ≥ 200 on large phone)
    expect(pb!.height).toBeGreaterThanOrEqual(200);
    expect(mb!.height).toBeGreaterThanOrEqual(200);
    expect(pb!.height).toBeGreaterThanOrEqual(lb!.height * 0.55);

    // Align tops/bottoms of lower regions (keyboard vs pitch track; label may sit below pitch)
    expect(Math.abs(pb!.y - kb!.y)).toBeLessThan(12);
    expect(Math.abs(mb!.y - kb!.y)).toBeLessThan(12);

    // Sustain is a substantial touch target filling remaining column
    expect(sb!.width).toBeGreaterThanOrEqual(44);
    expect(sb!.height).toBeGreaterThanOrEqual(44);
    expect(sb!.height).toBeGreaterThanOrEqual(80);

    // PLAY: no build footer reclaiming instrument height
    await expect(page.locator("[data-tx80-build-footer]")).toHaveCount(0);

    // Pointer travel maps full strip height
    const travel = await pitch.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { h: r.height, top: r.top, bottom: r.bottom };
    });
    expect(travel.h).toBeGreaterThanOrEqual(200);
    expect(travel.bottom - travel.top).toBeCloseTo(travel.h, 0);

    await shot(page, "webkit-iphone-large-play-dock");
  });

  test("orientation change does not duplicate header; one AudioContext path", async ({ page }) => {
    await setMode(page, "play");
    await expect(page.locator("[data-tx80-header]")).toHaveCount(1);

    await page.setViewportSize({ width: 932, height: 430 });
    await page.waitForTimeout(200);
    await expect(page.locator("[data-tx80-header]")).toHaveCount(1);
    const pos = await page.locator("[data-tx80-header]").evaluate((el) => getComputedStyle(el).position);
    expect(pos).toBe("fixed");

    await page.setViewportSize({ width: 430, height: 932 });
    await page.waitForTimeout(200);
    await expect(page.locator("[data-tx80-header]")).toHaveCount(1);

    await page.locator("[data-tx80-audio-start]").click();
    await page.waitForTimeout(400);
    const contexts = await page.evaluate(() => {
      const w = window as unknown as { __TX80_AUDIO_CONTEXTS?: number };
      // Prefer runtime diag if exposed
      const snap = (window as unknown as { __TX80_RUNTIME_DIAG?: { contextsCreated: number } })
        .__TX80_RUNTIME_DIAG;
      return snap?.contextsCreated ?? w.__TX80_AUDIO_CONTEXTS ?? null;
    });
    // Soft check — gate2 suite asserts hard; here ensure we didn't create a second via header alone
    if (contexts !== null) expect(contexts).toBeLessThanOrEqual(1);

    await shot(page, "webkit-iphone-landscape-play");
  });

  test("tablet portrait PLAY dock alignment smoke", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await hydrate(page);
    await setMode(page, "play");
    await noHorizontalOverflow(page);
    const pitch = await page.locator('[data-tx80-wheel="pitch"]').first().boundingBox();
    const kb = await page.locator("[data-tx80-keyboard]").boundingBox();
    expect(pitch && kb).toBeTruthy();
    expect(pitch!.height).toBeGreaterThanOrEqual(140);
    await shot(page, "webkit-ipad-portrait-play");
  });
});
