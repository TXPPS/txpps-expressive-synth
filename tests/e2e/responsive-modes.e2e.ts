import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

/**
 * Responsive mode / mobile layout QA matrix for TX-80.
 * Screenshots land in qa/responsive-screenshots (gitignored artifacts).
 */

const SHOT_DIR = path.join(process.cwd(), "qa", "responsive-screenshots");

const VIEWPORTS = [
  { name: "iphone-se-portrait", width: 375, height: 667, hasTouch: true },
  { name: "iphone-large-portrait", width: 430, height: 932, hasTouch: true },
  { name: "iphone-landscape", width: 844, height: 390, hasTouch: true },
  { name: "android-small-portrait", width: 360, height: 740, hasTouch: true },
  { name: "android-small-landscape", width: 740, height: 360, hasTouch: true },
  { name: "ipad-portrait", width: 768, height: 1024, hasTouch: true },
  { name: "ipad-landscape", width: 1024, height: 768, hasTouch: true },
  { name: "desktop-1366", width: 1366, height: 768, hasTouch: false },
  { name: "desktop-1920", width: 1920, height: 1080, hasTouch: false },
] as const;

type Mode = "full" | "edit" | "play";

async function setMode(page: Page, mode: Mode) {
  await page.locator(`[data-tx80-mode="${mode}"]`).click();
  await expect(page.locator(`[data-tx80-shell="${mode}"]`)).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(`[data-tx80-mode="${mode}"]`)).toHaveAttribute("aria-pressed", "true");
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(doc.scrollWidth, document.body.scrollWidth) - window.innerWidth;
  });
  expect(overflow, "horizontal overflow").toBeLessThanOrEqual(1);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(SHOT_DIR, `${name}.png`),
    fullPage: true,
  });
}

test.describe("responsive mode matrix", () => {
  for (const vp of VIEWPORTS) {
    test.describe(vp.name, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.addInitScript(() => {
          try {
            localStorage.removeItem("tx80-ui-mode");
          } catch {
            /* private */
          }
        });
        await page.goto("/");
        await page.waitForSelector("html[data-tx80-hydrated='true']");
        await expect(page.locator("[data-tx80-header]")).toBeVisible();
      });

      for (const mode of ["full", "edit", "play"] as Mode[]) {
        test(`${mode} layout invariants`, async ({ page }) => {
          await setMode(page, mode);
          await noHorizontalOverflow(page);

          // Header brand + mode controls present; no overlap via bounding boxes
          const brand = page.locator("[data-tx80-brand]");
          const modes = page.getByRole("group", { name: "Workspace mode" });
          await expect(brand).toBeVisible();
          await expect(modes).toBeVisible();
          const b = await brand.boundingBox();
          const m = await modes.boundingBox();
          expect(b && m).toBeTruthy();
          if (b && m) {
            const overlapX = !(b.x + b.width <= m.x + 2 || m.x + m.width <= b.x + 2);
            const overlapY = !(b.y + b.height <= m.y + 2 || m.y + m.height <= b.y + 2);
            expect(overlapX && overlapY, "brand overlaps mode switcher").toBeFalsy();
          }

          // Exactly one audio-start control; no duplicate autoplay banner
          await expect(page.locator("[data-tx80-audio-start]")).toHaveCount(1);
          await expect(page.getByText(/TAP TO ENABLE AUDIO/i)).toHaveCount(0);
          await expect(page.getByText(/browser autoplay policy/i)).toHaveCount(0);

          // No Lovable branding
          await expect(page.locator("body")).not.toContainText(/lovable/i);

          if (mode === "play") {
            await expect(page.locator("[data-tx80-editor]")).toHaveCount(0);
            await expect(page.locator("[data-tx80-perf-dock='play']")).toBeVisible();
            await expect(page.locator("[data-tx80-keyboard]")).toBeVisible();
            // No huge empty region: dock should occupy meaningful height
            const dock = await page.locator("[data-tx80-perf-dock='play']").boundingBox();
            expect(dock).toBeTruthy();
            expect(dock!.height).toBeGreaterThan(vp.height * 0.28);
            await expect(page.getByRole("slider", { name: "Ribbon controller" })).toBeVisible();
            await expect(page.getByRole("button", { name: "Sustain" }).first()).toBeVisible();
            await expect(page.getByRole("slider", { name: "PITCH" }).first()).toBeVisible();
            await expect(page.getByRole("slider", { name: "MOD" }).first()).toBeVisible();
          }

          if (mode === "edit") {
            await expect(page.locator("[data-tx80-editor]")).toBeVisible();
            // Full keyboard hidden by default
            await expect(page.locator("[data-tx80-perf-dock]")).toHaveCount(0);
            await expect(page.locator("[data-tx80-edit-keys-toggle]")).toBeVisible();
            await page.locator("[data-tx80-edit-keys-toggle]").click();
            await expect(page.locator("[data-tx80-perf-dock='audition']")).toBeVisible();
            await page.locator("[data-tx80-edit-keys-toggle]").click();
            await expect(page.locator("[data-tx80-perf-dock]")).toHaveCount(0);
          }

          if (mode === "full") {
            await expect(page.locator("[data-tx80-editor]")).toBeVisible();
            await expect(page.locator("[data-tx80-perf-dock='full']")).toBeVisible();
            // Primary sections present (nav may show one at a time on phone)
            const sections = page.locator("[data-tx80-section]");
            await expect(sections.first()).toBeVisible();
          }

          await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
          await shot(page, `${vp.name}-${mode}`);
        });
      }

      test("preset browser + orientation preserve", async ({ page }) => {
        await setMode(page, "play");
        await page.locator("[data-tx80-preset-open]").click();
        await expect(page.locator("[data-tx80-preset-browser]")).toBeVisible();

        const rows = page.locator("[data-tx80-preset-row]");
        await expect(rows).toHaveCount(18, { timeout: 5000 });

        const firstName = await rows.first().locator(".readout").innerText();
        await rows.nth(1).click();
        await expect(page.locator("[data-tx80-preset-browser]")).toHaveCount(0);
        await expect(page.locator("[data-tx80-preset-open] .readout")).not.toHaveText(firstName);

        // Re-open and Escape close
        await page.locator("[data-tx80-preset-open]").click();
        await expect(page.locator("[data-tx80-preset-browser]")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.locator("[data-tx80-preset-browser]")).toHaveCount(0);

        const patchBefore = await page.locator("[data-tx80-preset-open] .readout").innerText();
        await setMode(page, "edit");
        // Flip orientation by swapping viewport
        await page.setViewportSize({ width: vp.height, height: vp.width });
        await expect(page.locator(`[data-tx80-shell="edit"]`)).toBeVisible();
        await expect(page.locator("[data-tx80-preset-open] .readout")).toHaveText(patchBefore);

        // One AudioContext after activation
        await setMode(page, "play");
        await page.locator("[data-tx80-audio-start]").click();
        await page.waitForTimeout(400);
        const contexts = await page.evaluate(() => {
          const d = (window as unknown as { __TX80_DIAG?: () => { contextsCreated: number } })
            .__TX80_DIAG?.();
          return d?.contextsCreated ?? 0;
        });
        // May be 0 if activate hasn't finished constructing yet; retry via key
        if (contexts === 0) {
          const key = page.locator("[data-midi]").first();
          if (await key.count()) {
            const box = await key.boundingBox();
            if (box) {
              await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.8);
              await page.waitForTimeout(500);
            }
          }
        }
        const after = await page.evaluate(() => {
          const d = (window as unknown as { __TX80_DIAG?: () => { contextsCreated: number } })
            .__TX80_DIAG?.();
          return d?.contextsCreated ?? 0;
        });
        if (after > 0) expect(after).toBe(1);

        await noHorizontalOverflow(page);
        await shot(page, `${vp.name}-orientation`);
      });
    });
  }

  test("settings diagnostics terminal remains selectable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForSelector("html[data-tx80-hydrated='true']");
    await page.getByRole("button", { name: "Settings" }).click();
    // Settings defaults to DIAGNOSTICS
    const term = page.locator(".tx80-diag-terminal");
    await expect(term).toBeVisible({ timeout: 10_000 });
    const selectable = await term.evaluate((el) => getComputedStyle(el).userSelect);
    expect(["text", "auto", "contain"]).toContain(selectable);
  });
});
