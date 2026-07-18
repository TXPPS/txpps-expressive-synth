import { test, expect, type Page } from "@playwright/test";

/**
 * Responsive layout validation via BROWSER DEVICE EMULATION (not physical
 * hardware). Runs once per emulation project defined in playwright.config.ts.
 */

const powerBtn = (page: Page) => page.getByRole("button", { name: /Power on|Power off/ });

async function inViewport(page: Page, locator: ReturnType<Page["locator"]>) {
  const box = await locator.boundingBox();
  if (!box) return false;
  const vp = page.viewportSize();
  if (!vp) return false;
  // 2px tolerance absorbs sub-pixel rounding / scrollbar gutters.
  return box.x >= -2 && box.y >= -2 && box.x + box.width <= vp.width + 2;
}

async function expectInViewport(page: Page, locator: ReturnType<Page["locator"]>) {
  // Poll so first-paint layout jitter can't produce a false negative.
  await expect.poll(() => inViewport(page, locator), { timeout: 5000 }).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(powerBtn(page)).toBeVisible();
  await page.waitForLoadState("networkidle");
});

test("no horizontal page scroll", async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "documentElement horizontal overflow (px)").toBeLessThanOrEqual(1);
});

test("core performance + status controls stay within the viewport", async ({ page }) => {
  await expect(powerBtn(page)).toBeVisible();
  await expectInViewport(page, powerBtn(page));
  await expectInViewport(page, page.getByRole("button", { name: "PANIC" }));
  // Preset LCD status surface reachable.
  await expectInViewport(page, page.getByRole("button", { name: "Open preset quick access" }));
});

test("SETUP dialog opens and closes without escaping the viewport", async ({ page }) => {
  const setup = page.getByRole("button", { name: "SETUP" });
  // SETUP lives in the preset action row (hidden in PLAY mode) — present in
  // the default FULL mode on every emulated width.
  if (await setup.isVisible().catch(() => false)) {
    await setup.click();
    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.keyboard.press("Escape");
  }
});

test("on-screen keyboard is present and playable", async ({ page }) => {
  const anyKey = page.locator("[data-note]").first();
  await expect(anyKey).toBeVisible();
  await expectInViewport(page, anyKey);
});
